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
import {
  validateDocumentStructureForMerge,
} from "../src/doc/structuralValidation";
import { validateDocumentForMerge } from "../src/doc/validation";
import { serializeNode, serializeNodes } from "../src/doc/plainTextExport";
import {
  DOCUMENT_READER_NODE_TYPES,
} from "../src/doc/DocumentReader";
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
  // Source wiring
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

  // Export
  const bullet = serializeNode(listLinkDoc[1]);
  assert.equal(bullet, "- First bullet");
  const linked = serializeNode(listLinkDoc[2]);
  assert.equal(linked, "- See [the docs](https://example.com/docs).");
  const numbered = serializeNode(listLinkDoc[3]);
  assert.equal(numbered, "1. Step one");
  const md = serializeNodes(listLinkDoc);
  assert.match(md, /## Lists and links/);
  assert.match(md, /\[the docs\]\(https:\/\/example\.com\/docs\)/);

  // Validation (structure + merge)
  const structure = validateDocumentStructureForMerge(listLinkDoc);
  assert.equal(structure.success, true, "structure merge accepts list+link doc");
  const merge = validateDocumentForMerge(listLinkDoc);
  assert.equal(merge.success, true, "client merge validate accepts list+link doc");

  // DB: RevSet create accepts document with list props + link inline
  await fs.rm(DB_PATH, { force: true });
  process.env.DATABASE_URL = "file:./smoke-editor-lists-links.db";
  await execFileAsync(
    "pnpm",
    ["exec", "prisma", "db", "push", "--skip-generate", "--accept-data-loss"],
    {
      cwd: ROOT,
      env: { ...process.env, DATABASE_URL: "file:./smoke-editor-lists-links.db" },
    },
  );
  const prisma = new PrismaClient();
  setPrisma(prisma);
  await seedIfEmpty(prisma);

  const leaf = await prisma.thread.findFirst({
    where: { state: "rfc", parent_thread_id: null },
    include: { targets: true },
  });
  assert.ok(leaf, "need an RFC leaf thread");
  const artifactId = leaf!.targets[0]?.artifact_id;
  assert.ok(artifactId, "leaf has artifact target");

  const rev = await createRevSet({
    thread_id: leaf!.id,
    artifact_id: artifactId!,
    content_json: listLinkDoc,
    created_by: "user-alice",
  });
  assert.ok(rev.id, "RevSet created for list+link doc");
  assert.equal(
    (rev as { content_invalid?: boolean }).content_invalid,
    undefined,
  );

  await prisma.$disconnect();
  await fs.rm(DB_PATH, { force: true });
  console.log("smoke-editor-lists-links: OK");
}

main().catch(async (err) => {
  console.error(err);
  try {
    await fs.rm(DB_PATH, { force: true });
  } catch {
    /* ignore */
  }
  process.exit(1);
});
