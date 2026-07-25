/**
 * Smoke: CA/GB/DE Manual dossier stub artifacts seeded.
 * Run: DATABASE_URL="file:./smoke-manual-countries.db" pnpm exec tsx scripts/smoke-manual-country-seeds.ts
 */
import { promises as fs } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { execFile } from "child_process";
import { promisify } from "util";
import { seedIfEmpty } from "../prisma/seed";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "prisma", "smoke-manual-countries.db");

const EXPECTED: Record<string, { count: number; slugs: string[]; marker: string }> =
  {
    "ca-elections-1": {
      count: 2,
      slugs: ["list-mgmt", "overview"],
      marker: "National Register of Electors",
    },
    "gb-elections-1": {
      count: 2,
      slugs: ["overview", "returning-officer"],
      marker: "statement of persons nominated",
    },
    "de-elections-1": {
      count: 2,
      slugs: ["bundeswahl", "overview"],
      marker: "Bundeswahlleiter",
    },
  };

async function main() {
  process.env.DATABASE_URL = "file:./smoke-manual-countries.db";
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

    for (const [dossierId, expect] of Object.entries(EXPECTED)) {
      const artifacts = await prisma.artifact.findMany({
        where: { dossierId },
        orderBy: { slug: "asc" },
      });
      if (artifacts.length !== expect.count) {
        throw new Error(
          `${dossierId}: expected ${expect.count} artifacts, got ${artifacts.length}`,
        );
      }
      const slugs = artifacts.map((a) => a.slug);
      if (JSON.stringify(slugs) !== JSON.stringify(expect.slugs)) {
        throw new Error(`${dossierId} slugs: ${slugs.join(",")}`);
      }
      for (const a of artifacts) {
        if (!a.currentRevisionId) {
          throw new Error(`${a.artifactId} missing current_revision_id`);
        }
        const rev = await prisma.artifactRevision.findUnique({
          where: { revisionId: a.currentRevisionId },
        });
        if (!rev || !Array.isArray(rev.contentJson) || rev.contentJson.length === 0) {
          throw new Error(`${a.artifactId} missing content_json`);
        }
      }

      const bodyBlob = (
        await Promise.all(
          artifacts.map(async (a) => {
            const rev = await prisma.artifactRevision.findUnique({
              where: { revisionId: a.currentRevisionId! },
            });
            return JSON.stringify(rev?.contentJson ?? []);
          }),
        )
      ).join("\n");
      if (!bodyBlob.includes(expect.marker)) {
        throw new Error(`${dossierId} missing marker prose: ${expect.marker}`);
      }
    }

    console.log("smoke-manual-country-seeds: OK");
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
