/**
 * Smoke: M4 Area → Collection → Dossier API + seed hierarchy.
 * Run: DATABASE_URL="file:./smoke-m4.db" pnpm exec tsx scripts/smoke-corpus-ia.ts
 */
import { promises as fs } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { execFile } from "child_process";
import { promisify } from "util";
import { seedIfEmpty } from "../prisma/seed";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "prisma", "smoke-m4.db");

async function main() {
  process.env.DATABASE_URL = "file:./smoke-m4.db";
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
    if (seeded !== "seeded") {
      throw new Error(`expected seeded, got ${seeded}`);
    }

    const areas = await prisma.area.findMany();
    if (areas.length !== 2) throw new Error(`expected 2 areas, got ${areas.length}`);
    const kinds = new Set(areas.map((a) => a.kind));
    if (!kinds.has("canon") || !kinds.has("manuals")) {
      throw new Error(`bad area kinds: ${[...kinds].join(",")}`);
    }

    const canon = await prisma.collection.findUnique({
      where: { collectionId: "collection-canon" },
    });
    if (!canon || canon.countryCode) {
      throw new Error("canon collection missing or has country_code");
    }

    const us = await prisma.collection.findUnique({
      where: { collectionId: "collection-us" },
    });
    if (!us || us.countryCode !== "US") {
      throw new Error("US collection missing or bad country_code");
    }

    const dossiers = await prisma.dossier.findMany();
    if (dossiers.length < 3) {
      throw new Error(`expected ≥3 dossiers, got ${dossiers.length}`);
    }

    const usVoting = await prisma.dossier.findUnique({
      where: { dossierId: "us-voting-1" },
    });
    if (!usVoting || usVoting.collectionId !== "collection-us") {
      throw new Error("us-voting-1 not under collection-us");
    }

    const artifact = await prisma.artifact.findUnique({
      where: { artifactId: "page-001" },
    });
    if (!artifact || artifact.dossierId !== "electoral-1") {
      throw new Error("page-001 should belong to electoral-1");
    }

    const underElectoral = await prisma.artifact.findMany({
      where: { dossierId: "electoral-1" },
      orderBy: { artifactId: "asc" },
    });
    // page-001 (seeded content); Charter lives in canon-governance-1
    const electoralIds = underElectoral.map((a) => a.artifactId).sort();
    if (underElectoral.length < 1 || !electoralIds.includes("page-001")) {
      throw new Error(
        `electoral-1 artifacts: expected page-001, got ${electoralIds.join(",")}`,
      );
    }

    const charter = await prisma.artifact.findUnique({
      where: { artifactId: "canon-charter" },
    });
    if (!charter || charter.dossierId !== "canon-governance-1") {
      throw new Error("canon-charter should belong to canon-governance-1");
    }
    if (!charter.ownerMergeOnly) {
      throw new Error("canon-charter must be owner_merge_only");
    }

    const underUsVoting = await prisma.artifact.findMany({
      where: { dossierId: "us-voting-1" },
      orderBy: { slug: "asc" },
    });
    if (underUsVoting.length !== 5) {
      throw new Error(`us-voting-1 artifacts: ${underUsVoting.length}`);
    }
    const usSlugs = underUsVoting.map((a) => a.slug).sort();
    const expected = [
      "alignment",
      "overview",
      "polling",
      "provisional",
      "voter-reg",
    ];
    if (JSON.stringify(usSlugs) !== JSON.stringify(expected)) {
      throw new Error(`us-voting-1 slugs: ${usSlugs.join(",")}`);
    }
    for (const a of underUsVoting) {
      if (!a.currentRevisionId) {
        throw new Error(`${a.artifactId} missing current_revision_id`);
      }
      const rev = await prisma.artifactRevision.findUnique({
        where: { revisionId: a.currentRevisionId },
      });
      if (!rev || rev.artifactId !== a.artifactId) {
        throw new Error(`bad revision for ${a.artifactId}`);
      }
      const content = rev.contentJson;
      if (!Array.isArray(content) || content.length === 0) {
        throw new Error(`${a.artifactId} empty content_json`);
      }
    }

    for (const [dossierId, minCount] of [
      ["ca-elections-1", 2],
      ["gb-elections-1", 2],
      ["de-elections-1", 2],
    ] as const) {
      const arts = await prisma.artifact.findMany({ where: { dossierId } });
      if (arts.length < minCount) {
        throw new Error(`${dossierId} artifacts: ${arts.length}`);
      }
    }

    console.log("smoke-corpus-ia: OK");
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
