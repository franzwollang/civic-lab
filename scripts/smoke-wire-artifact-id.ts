/**
 * Smoke: wire JSON dual-emits artifact_id + page_id; Zod accepts either.
 * Run: pnpm exec tsx scripts/smoke-wire-artifact-id.ts
 */
import assert from "node:assert/strict";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";
import { seedIfEmpty } from "../prisma/seed";
import { pageRevisionSchema, saveRevisionInput } from "../src/api/schemas";
import { artifactIdOf } from "../src/doc/types";
import {
  listArtifacts,
  listArtifactRevisions,
  setPrisma,
} from "../server/db";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DB = path.join(ROOT, "prisma", "smoke-wire-artifact-id.db");

const baseRevision = {
  revision_id: "rev-smoke-1",
  parent_revision_id: null,
  created_at: new Date().toISOString(),
  author: "local",
  content_json: [{ type: "p", id: "p1", children: [{ text: "hi" }] }],
  blocks: [
    {
      block_id: "p1",
      type: "p",
      order: 0,
      hash: "abc",
      text_preview: "hi",
    },
  ],
  doc_root_hash: "root",
  schema_version: 2,
};

async function main() {
  // Schema: page_id only → dual-emit after transform
  const legacyOnly = pageRevisionSchema.safeParse({
    ...baseRevision,
    page_id: "page-001",
  });
  assert.equal(legacyOnly.success, true, "page_id-only accepted");
  if (legacyOnly.success) {
    assert.equal(legacyOnly.data.artifact_id, "page-001");
    assert.equal(legacyOnly.data.page_id, "page-001");
  }

  // Schema: artifact_id only
  const preferredOnly = pageRevisionSchema.safeParse({
    ...baseRevision,
    artifact_id: "page-001",
  });
  assert.equal(preferredOnly.success, true, "artifact_id-only accepted");
  if (preferredOnly.success) {
    assert.equal(preferredOnly.data.page_id, "page-001");
  }

  // Schema: both must match
  const mismatch = pageRevisionSchema.safeParse({
    ...baseRevision,
    artifact_id: "a",
    page_id: "b",
  });
  assert.equal(mismatch.success, false, "mismatched ids rejected");

  // Neither → fail
  const neither = pageRevisionSchema.safeParse({ ...baseRevision });
  assert.equal(neither.success, false, "missing both ids rejected");

  const saveParsed = saveRevisionInput.safeParse({
    artifactId: "page-001",
    revision: { ...baseRevision, artifact_id: "page-001" },
    nextCurrentRevisionId: "rev-smoke-1",
  });
  assert.equal(saveParsed.success, true, "saveRevisionInput with artifactId");
  if (saveParsed.success) {
    assert.equal(saveParsed.data.pageId, "page-001");
    assert.equal(saveParsed.data.artifactId, "page-001");
  }

  assert.equal(
    artifactIdOf({ artifact_id: "x", page_id: "y" }),
    "x",
    "artifactIdOf prefers artifact_id",
  );
  assert.equal(
    artifactIdOf({ page_id: "legacy" }),
    "legacy",
    "artifactIdOf falls back to page_id",
  );

  // Live Prisma dual-emit
  process.env.DATABASE_URL = `file:${DB}`;
  await fs.rm(DB, { force: true });
  await fs.rm(`${DB}-journal`, { force: true });

  const { execFile } = await import("child_process");
  const { promisify } = await import("util");
  const execFileAsync = promisify(execFile);
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
    assert.equal(seeded, "seeded");

    const artifacts = await listArtifacts();
    assert.ok(artifacts.length >= 1);
    const a = artifacts[0]!;
    assert.equal(a.artifact_id, a.page_id);
    assert.ok(a.artifact_id, "artifact_id present on list");

    const revs = await listArtifactRevisions(a.artifact_id);
    assert.ok(revs.length >= 1);
    const r = revs[0]!;
    assert.equal(r.artifact_id, r.page_id);
    assert.equal(r.artifact_id, a.artifact_id);

    console.log(
      `ok: dual-emit artifact_id=${a.artifact_id} page_id=${a.page_id}; ${revs.length} revisions`,
    );
  } finally {
    await prisma.$disconnect();
    await fs.rm(DB, { force: true });
    await fs.rm(`${DB}-journal`, { force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
