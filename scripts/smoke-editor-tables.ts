/**
 * Smoke: Plate tables MVP — plugin registered, reader/export aware,
 * structural validation accepts well-formed tables, RevSet round-trip.
 * Run: DATABASE_URL="file:./smoke-editor-tables.db" pnpm exec tsx scripts/smoke-editor-tables.ts
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
const DB_PATH = path.join(ROOT, "prisma", "smoke-editor-tables.db");

const tableDoc = [
  { type: "h2", id: "h1", children: [{ text: "Scores" }] },
  {
    type: "table",
    id: "tbl-1",
    children: [
      {
        type: "tr",
        children: [
          {
            type: "th",
            children: [{ type: "p", children: [{ text: "Name" }] }],
          },
          {
            type: "th",
            children: [{ type: "p", children: [{ text: "Value" }] }],
          },
        ],
      },
      {
        type: "tr",
        children: [
          {
            type: "td",
            children: [{ type: "p", children: [{ text: "Alpha" }] }],
          },
          {
            type: "td",
            children: [{ type: "p", children: [{ text: "1" }] }],
          },
        ],
      },
      {
        type: "tr",
        children: [
          {
            type: "td",
            children: [{ type: "p", children: [{ text: "Beta" }] }],
          },
          {
            type: "td",
            children: [{ type: "p", children: [{ text: "2" }] }],
          },
        ],
      },
    ],
  },
  {
    type: "p",
    id: "p-1",
    children: [{ text: "After the table." }],
  },
];

const emptyTableDoc = [
  { type: "h2", id: "h1", children: [{ text: "Empty" }] },
  { type: "table", id: "tbl-empty", children: [] },
];

async function main() {
  const plateSrc = readFileSync("src/editor/plate.tsx", "utf8");
  assert.match(plateSrc, /tablePlugins/);
  assert.match(plateSrc, /from "\.\/tablePlugins"/);

  const pluginSrc = readFileSync("src/editor/tablePlugins.tsx", "utf8");
  assert.match(pluginSrc, /TablePlugin/);
  assert.match(pluginSrc, /TableRowPlugin/);
  assert.match(pluginSrc, /TableCellPlugin/);
  assert.match(pluginSrc, /TableCellHeaderPlugin/);

  const toolbarSrc = readFileSync("src/app/pages/test-editor.tsx", "utf8");
  assert.match(toolbarSrc, /insertSimpleTable/);

  assert.ok(
    (DOCUMENT_READER_NODE_TYPES as readonly string[]).includes(
      ELEMENT_TYPES.TABLE,
    ),
    "reader checklist includes table type",
  );
  assert.ok(
    (DOCUMENT_READER_NODE_TYPES as readonly string[]).includes(
      ELEMENT_TYPES.TABLE_ROW,
    ),
  );
  assert.ok(
    (DOCUMENT_READER_NODE_TYPES as readonly string[]).includes(
      ELEMENT_TYPES.TABLE_CELL,
    ),
  );
  assert.ok(
    (DOCUMENT_READER_NODE_TYPES as readonly string[]).includes(
      ELEMENT_TYPES.TABLE_CELL_HEADER,
    ),
  );

  const tableMd = serializeNode(tableDoc[1]);
  assert.match(tableMd, /\| Name \| Value \|/);
  assert.match(tableMd, /\| --- \| --- \|/);
  assert.match(tableMd, /\| Alpha \| 1 \|/);
  assert.match(tableMd, /\| Beta \| 2 \|/);

  const md = serializeNodes(tableDoc);
  assert.match(md, /## Scores/);
  assert.match(md, /\| Alpha \| 1 \|/);
  assert.match(md, /After the table\./);

  const structure = validateDocumentStructureForMerge(tableDoc);
  assert.equal(
    structure.success,
    true,
    `structure merge accepts table doc: ${JSON.stringify(structure.issues)}`,
  );
  const merge = validateDocumentForMerge(tableDoc);
  assert.equal(
    merge.success,
    true,
    "client merge validate accepts table doc",
  );

  const emptyStructure = validateDocumentStructureForMerge(emptyTableDoc);
  assert.equal(emptyStructure.success, false, "empty table must fail structure");
  assert.ok(
    emptyStructure.issues.some((i) => i.message.includes("at least one row")),
  );

  process.env.DATABASE_URL = "file:./smoke-editor-tables.db";
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
      summary: "table proposal",
      content_json: tableDoc,
    });
    assert.equal(
      okRs.ok,
      true,
      `table RevSet should pass: ${JSON.stringify(okRs)}`,
    );

    console.log("smoke-editor-tables: ok");
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
