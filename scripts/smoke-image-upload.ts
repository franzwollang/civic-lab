/**
 * Smoke: image upload pipeline — POST multipart, GET bytes, relax webp-only,
 * RevSet accepts uploaded /uploads/images/… PNG src.
 * Run: DATABASE_URL="file:./smoke-image-upload.db" pnpm exec tsx scripts/smoke-image-upload.ts
 */
import assert from "node:assert/strict";
import { promises as fs } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { execFile } from "child_process";
import { promisify } from "util";
import { readFileSync } from "node:fs";
import { seedIfEmpty } from "../prisma/seed";
import { setPrisma, createRevSet } from "../server/db";
import { app } from "../server/index";
import { UPLOADS_IMAGES_DIR } from "../server/uploads";
import {
  checkImageSrc,
  IMAGE_UPLOAD_PATH_PREFIX,
  isAllowedImageSrc,
  resolveImageSrc,
} from "../src/lib/imageSrc";
import { validateDocumentStructureForMerge } from "../src/doc/structuralValidation";
import { serializeNode } from "../src/doc/plainTextExport";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "prisma", "smoke-image-upload.db");

/** Minimal 1×1 PNG */
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function json(res: Response) {
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text) as unknown };
  } catch {
    return { status: res.status, body: text };
  }
}

async function main() {
  // Source markers (upload routes live in server/routes/uploads.ts)
  const uploadsRouteSrc = readFileSync(
    path.join(ROOT, "server/routes/uploads.ts"),
    "utf8",
  );
  assert.match(uploadsRouteSrc, /\/api\/uploads\/images/);
  assert.match(uploadsRouteSrc, /\/uploads\/images\/:filename/);
  const indexSrc = readFileSync(path.join(ROOT, "server/index.ts"), "utf8");
  assert.match(indexSrc, /registerUploadRoutes/);

  const voidSrc = readFileSync(
    path.join(ROOT, "src/editor/void-blocks.tsx"),
    "utf8",
  );
  assert.match(voidSrc, /uploadImage/);
  assert.match(voidSrc, /Choose image/);

  const concept = readFileSync(path.join(ROOT, "CONCEPT.md"), "utf8");
  assert.doesNotMatch(
    concept,
    /Image upload pipeline \(keep `\*\.webp\*\`-only until upload exists\)/,
  );
  assert.match(concept, /image_block/);
  assert.doesNotMatch(concept, /\.webp`-only until upload exists/);

  // Lib rules
  assert.equal(isAllowedImageSrc("https://x.test/a.png"), true);
  assert.equal(isAllowedImageSrc("/uploads/images/img-1.webp"), true);
  assert.equal(isAllowedImageSrc("data:image/jpeg;base64,xx"), true);
  assert.equal(isAllowedImageSrc("https://x.test/a.bmp"), false);
  assert.equal(checkImageSrc("").reason, "empty");
  assert.match(
    resolveImageSrc("/uploads/images/foo.png"),
    /\/uploads\/images\/foo\.png$/,
  );

  process.env.DATABASE_URL = "file:./smoke-image-upload.db";
  await fs.rm(DB_PATH, { force: true });
  await fs.rm(`${DB_PATH}-journal`, { force: true });

  const prismaCli = path.join(ROOT, "node_modules", "prisma", "build", "index.js");
  await execFileAsync(
    process.execPath,
    [prismaCli, "db", "push", "--skip-generate"],
    { cwd: ROOT, env: { ...process.env }, maxBuffer: 10 * 1024 * 1024 },
  );

  const prisma = new PrismaClient();
  try {
    const seeded = await seedIfEmpty(prisma);
    if (seeded !== "seeded") throw new Error(`expected seeded, got ${seeded}`);
    setPrisma(prisma);

    const form = new FormData();
    form.append(
      "file",
      new Blob([PNG_1X1], { type: "image/png" }),
      "pixel.png",
    );
    const uploaded = await json(
      await app.request("/api/uploads/images", { method: "POST", body: form }),
    );
    assert.equal(uploaded.status, 200, JSON.stringify(uploaded.body));
    const body = uploaded.body as {
      url: string;
      filename: string;
      mime: string;
      bytes: number;
    };
    assert.ok(body.url.startsWith(IMAGE_UPLOAD_PATH_PREFIX));
    assert.equal(body.mime, "image/png");
    assert.ok(body.bytes > 0);
    assert.match(body.filename, /^img-[0-9a-f-]+\.png$/i);

    const getRes = await app.request(body.url);
    assert.equal(getRes.status, 200);
    assert.equal(getRes.headers.get("content-type"), "image/png");
    const got = Buffer.from(await getRes.arrayBuffer());
    assert.deepEqual(got, PNG_1X1);

    // Reject unsupported mime
    const badForm = new FormData();
    badForm.append(
      "file",
      new Blob([Uint8Array.from([1, 2, 3])], { type: "image/bmp" }),
      "x.bmp",
    );
    const bad = await json(
      await app.request("/api/uploads/images", {
        method: "POST",
        body: badForm,
      }),
    );
    assert.equal(bad.status, 415);

    // Path traversal blocked
    const trav = await app.request("/uploads/images/../package.json");
    assert.ok(trav.status === 404 || trav.status === 400);

    const doc = [
      { type: "h2", id: "h1", children: [{ text: "Figure" }] },
      {
        type: "image_block",
        id: "img-up",
        src: body.url,
        alt: "Pixel",
        caption: "1×1",
        children: [{ text: "" }],
      },
    ];
    const structural = validateDocumentStructureForMerge(doc);
    assert.equal(structural.success, true, JSON.stringify(structural.issues));

    const md = serializeNode(doc[1] as never);
    assert.equal(md, `![Pixel](${body.url})\n1×1`);

    const rev = await createRevSet({
      thread_id: "thread-us-voter-reg-rfc",
      author_id: "user-alice",
      summary: "uploaded image",
      content_json: doc,
    });
    assert.equal(rev.ok, true, JSON.stringify(rev));

    // File landed on disk
    const onDisk = path.join(UPLOADS_IMAGES_DIR, body.filename);
    const diskBytes = await fs.readFile(onDisk);
    assert.deepEqual(diskBytes, PNG_1X1);

    console.log("smoke-image-upload: ok");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
