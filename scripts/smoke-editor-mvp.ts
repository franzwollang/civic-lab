/**
 * Smoke: Editor MVP residual cut — term scope defaults + merge-strict content gate.
 * Run: DATABASE_URL="file:./smoke-editor-mvp.db" pnpm exec tsx scripts/smoke-editor-mvp.ts
 */
import assert from "node:assert/strict";
import { promises as fs } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { execFile } from "child_process";
import { promisify } from "util";
import { readFileSync } from "node:fs";
import { seedIfEmpty } from "../prisma/seed";
import {
  setPrisma,
  createRevSet,
  getTerms,
} from "../server/db";
import { resolveDefaultTermScope } from "../src/lib/termScope";
import {
  validateDocumentStructure,
  validateDocumentStructureForMerge,
} from "../src/doc/structuralValidation";
import { validateDocumentForMerge } from "../src/doc/validation";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "prisma", "smoke-editor-mvp.db");

const validDoc = [
  { type: "h2", id: "h1", children: [{ text: "Title" }] },
  { type: "p", id: "p1", children: [{ text: "Hello" }] },
];

const warningOnlyDoc = [
  {
    type: "p",
    id: "p1",
    children: [
      {
        type: "term_inline",
        term_ref: "missing-term-id",
        children: [{ text: "orphan" }],
      },
    ],
  },
];

async function main() {
  // Pure helpers
  assert.deepEqual(resolveDefaultTermScope({}), { kind: "global" });
  assert.deepEqual(
    resolveDefaultTermScope({ dossierId: "electoral-1" }),
    { kind: "dossier", ref: "electoral-1" },
  );
  assert.deepEqual(
    resolveDefaultTermScope({ countryCode: "US" }),
    { kind: "country", ref: "US" },
  );
  assert.deepEqual(
    resolveDefaultTermScope({ dossierId: "us-elections-1", countryCode: "US" }),
    { kind: "dossier", ref: "us-elections-1" },
    "dossier wins over country when both present",
  );

  const mergeFn = validateDocumentForMerge(validDoc);
  assert.equal(mergeFn.success, true, "client merge validate accepts valid doc");

  // Dead plugin removed
  try {
    await fs.access(path.join(ROOT, "src/editor/math-plugin.ts"));
    throw new Error("math-plugin.ts should be deleted");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }

  const termSrc = readFileSync(
    "src/app/components/evidence/term-dialogs.tsx",
    "utf8",
  );
  assert.match(termSrc, /scope: draft\.scope/);
  assert.doesNotMatch(
    termSrc,
    /scope:\s*\{\s*kind:\s*"global"\s*\}/,
    "save path must not hardcode global scope",
  );

  const dbSrc = readFileSync("server/db.ts", "utf8");
  assert.match(dbSrc, /validateDocumentStructureForMerge/);
  assert.match(dbSrc, /content_invalid/);

  process.env.DATABASE_URL = "file:./smoke-editor-mvp.db";
  await fs.rm(DB_PATH, { force: true });
  await fs.rm(`${DB_PATH}-journal`, { force: true });

  const prismaCli = path.join(ROOT, "node_modules", "prisma", "build", "index.js");
  await execFileAsync(
    process.execPath,
    [prismaCli, "db", "push", "--skip-generate"],
    { cwd: ROOT, env: { ...process.env }, maxBuffer: 10 * 1024 * 1024 },
  );

  const prisma = new PrismaClient();
  setPrisma(prisma);
  try {
    const seeded = await seedIfEmpty(prisma);
    if (seeded !== "seeded") {
      throw new Error(`expected seeded, got ${seeded}`);
    }

    // Unsupported image format is a hard structural error — blocked on RevSet propose.
    const badImage = await createRevSet({
      thread_id: "thread-us-voter-reg-rfc",
      author_id: "user-alice",
      summary: "bad image proposal",
      content_json: [
        { type: "h2", id: "h1", children: [{ text: "Bad" }] },
        {
          type: "image_block",
          id: "img1",
          src: "https://example.com/photo.bmp",
          children: [{ text: "" }],
        },
      ],
    });
    assert.equal(badImage.ok, false, "unsupported image RevSet should fail");
    if (!badImage.ok) {
      assert.equal(badImage.error.code, "content_invalid");
    }

    // PNG URL is allowed after the upload pipeline (webp-only constraint lifted).
    const okPng = await createRevSet({
      thread_id: "thread-us-voter-reg-rfc",
      author_id: "user-alice",
      summary: "png image proposal",
      content_json: [
        { type: "h2", id: "h2", children: [{ text: "Ok" }] },
        {
          type: "image_block",
          id: "img2",
          src: "https://example.com/photo.png",
          alt: "Photo",
          children: [{ text: "" }],
        },
      ],
    });
    assert.equal(okPng.ok, true, "png image RevSet should succeed");

    // Warning-class missing term → ok on normal structure, fail on merge-strict.
    const emptyTerms = { terms: new Map<string, { status?: string }>() };
    const warnNormal = validateDocumentStructure(warningOnlyDoc, {
      registry: emptyTerms,
    });
    const warnMerge = validateDocumentStructureForMerge(warningOnlyDoc, {
      registry: emptyTerms,
    });
    assert.equal(warnNormal.success, true, "warnings alone do not fail save path");
    assert.ok(
      warnNormal.issues.some((i) => i.severity === "warning"),
      "missing term is a warning on save path",
    );
    assert.equal(warnMerge.success, false, "merge-strict fails on warnings");
    assert.ok(
      warnMerge.issues.every((i) => i.severity === "error"),
      "merge-strict promotes all issues to error",
    );

    // Valid proposal still works.
    const okRs = await createRevSet({
      thread_id: "thread-us-voter-reg-rfc",
      author_id: "user-alice",
      summary: "valid editor-mvp proposal",
      content_json: validDoc,
    });
    assert.equal(okRs.ok, true, `valid RevSet should pass: ${JSON.stringify(okRs)}`);

    // Seeded terms still load (scope plumbing intact).
    const terms = await getTerms();
    assert.ok(terms.items.length >= 1, "seeded terms present");
    assert.ok(
      terms.items.every((t) => {
        const scope = (t as { scope?: { kind?: string } }).scope;
        return scope && typeof scope.kind === "string";
      }),
      "terms carry scope",
    );

    console.log("smoke-editor-mvp: ok");
  } finally {
    await prisma.$disconnect();
    await fs.rm(DB_PATH, { force: true });
    await fs.rm(`${DB_PATH}-journal`, { force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
