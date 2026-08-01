/**
 * Smoke: Plate blockquotes — plugin registered, reader/export aware,
 * merge validation accepts blockquote docs.
 * Run: DATABASE_URL="file:./smoke-editor-blockquotes.db" pnpm exec tsx scripts/smoke-editor-blockquotes.ts
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
import { validateDocumentStructureForMerge } from "../src/doc/structuralValidation";
import { validateDocumentForMerge } from "../src/doc/validation";
import { serializeNode, serializeNodes } from "../src/doc/plainTextExport";
import { DOCUMENT_READER_NODE_TYPES } from "../src/doc/DocumentReader";
import { ELEMENT_TYPES } from "../src/editor/model";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "prisma", "smoke-editor-blockquotes.db");

const blockquoteDoc = [
  { type: "h2", id: "h1", children: [{ text: "Quotes" }] },
  {
    type: "blockquote",
    id: "bq-1",
    children: [{ text: "Knowledge is a commons." }],
  },
  {
    type: "p",
    id: "p-1",
    children: [{ text: "After the quote." }],
  },
];

async function main() {
  const plateSrc = readFileSync("src/editor/plate.tsx", "utf8");
  assert.match(plateSrc, /BlockquotePlugin/);

  const toolbarSrc = readFileSync("src/app/pages/test-editor.tsx", "utf8");
  assert.match(toolbarSrc, /toggleBlockquote/);
  assert.match(toolbarSrc, /isBlockquoteActive/);

  assert.ok(
    (DOCUMENT_READER_NODE_TYPES as readonly string[]).includes(
      ELEMENT_TYPES.BLOCKQUOTE,
    ),
    "reader checklist includes blockquote type",
  );

  assert.equal(serializeNode(blockquoteDoc[1]), "> Knowledge is a commons.");
  const md = serializeNodes(blockquoteDoc);
  assert.match(md, /## Quotes/);
  assert.match(md, /> Knowledge is a commons\./);

  const structure = validateDocumentStructureForMerge(blockquoteDoc);
  assert.equal(
    structure.success,
    true,
    "structure merge accepts blockquote doc",
  );
  const merge = validateDocumentForMerge(blockquoteDoc);
  assert.equal(
    merge.success,
    true,
    "client merge validate accepts blockquote doc",
  );

  process.env.DATABASE_URL = "file:./smoke-editor-blockquotes.db";
  await fs.rm(DB_PATH, { force: true });
  await fs.rm(`${DB_PATH}-journal`, { force: true });

  const prismaCli = path.join(
    ROOT,
    "node_modules",
    "prisma",
    "build",
    "index.js",
  );
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

    const okRs = await createRevSet({
      thread_id: "thread-us-voter-reg-rfc",
      author_id: "user-alice",
      summary: "blockquote proposal",
      content_json: blockquoteDoc,
    });
    assert.equal(
      okRs.ok,
      true,
      `blockquote RevSet should pass: ${JSON.stringify(okRs)}`,
    );

    console.log("smoke-editor-blockquotes: ok");
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
