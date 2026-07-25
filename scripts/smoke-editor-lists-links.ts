/**
 * Smoke: Plate lists + links MVP — plugins registered, reader/export aware,
 * merge validation accepts list/link docs.
 * Run: DATABASE_URL="file:./smoke-editor-lists-links.db" pnpm exec tsx scripts/smoke-editor-lists-links.ts
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
const DB_PATH = path.join(ROOT, "prisma", "smoke-editor-lists-links.db");

const listLinkDoc = [
  { type: "h2", id: "h1", children: [{ text: "Lists and links" }] },
  {
    type: "p",
    id: "p-bullet-1",
    listStyleType: "disc",
    indent: 1,
    children: [{ text: "First bullet" }],
  },
  {
    type: "p",
    id: "p-bullet-2",
    listStyleType: "disc",
    indent: 1,
    children: [
      { text: "See " },
      {
        type: "a",
        url: "https://example.com/docs",
        children: [{ text: "the docs" }],
      },
      { text: "." },
    ],
  },
  {
    type: "p",
    id: "p-num-1",
    listStyleType: "decimal",
    indent: 1,
    listStart: 1,
    children: [{ text: "Step one" }],
  },
];

async function main() {
  const plateSrc = readFileSync("src/editor/plate.tsx", "utf8");
  assert.match(plateSrc, /ListPluginConfigured/);
  assert.match(plateSrc, /LinkPluginConfigured/);
  assert.match(plateSrc, /IndentListPluginConfigured/);

  const toolbarSrc = readFileSync("src/app/pages/test-editor.tsx", "utf8");
  assert.match(toolbarSrc, /toggleBulletedList/);
  assert.match(toolbarSrc, /toggleNumberedList/);
  assert.match(toolbarSrc, /promptUpsertLink/);

  assert.ok(
    (DOCUMENT_READER_NODE_TYPES as readonly string[]).includes(
      ELEMENT_TYPES.LINK,
    ),
    "reader checklist includes link type",
  );

  assert.equal(serializeNode(listLinkDoc[1]), "- First bullet");
  assert.equal(
    serializeNode(listLinkDoc[2]),
    "- See [the docs](https://example.com/docs).",
  );
  assert.equal(serializeNode(listLinkDoc[3]), "1. Step one");
  const md = serializeNodes(listLinkDoc);
  assert.match(md, /## Lists and links/);
  assert.match(md, /\[the docs\]\(https:\/\/example\.com\/docs\)/);

  const structure = validateDocumentStructureForMerge(listLinkDoc);
  assert.equal(
    structure.success,
    true,
    "structure merge accepts list+link doc",
  );
  const merge = validateDocumentForMerge(listLinkDoc);
  assert.equal(
    merge.success,
    true,
    "client merge validate accepts list+link doc",
  );

  process.env.DATABASE_URL = "file:./smoke-editor-lists-links.db";
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
      summary: "list+link proposal",
      content_json: listLinkDoc,
    });
    assert.equal(
      okRs.ok,
      true,
      `list+link RevSet should pass: ${JSON.stringify(okRs)}`,
    );

    console.log("smoke-editor-lists-links: ok");
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
