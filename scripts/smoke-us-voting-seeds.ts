/**
 * Smoke: us-voting-1 fixture artifacts retired into prisma seeds.
 * Run: DATABASE_URL="file:./smoke-us-voting.db" pnpm exec tsx scripts/smoke-us-voting-seeds.ts
 */
import { promises as fs } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { execFile } from "child_process";
import { promisify } from "util";
import { seedIfEmpty } from "../prisma/seed";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "prisma", "smoke-us-voting.db");

async function main() {
  process.env.DATABASE_URL = "file:./smoke-us-voting.db";
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

    const bySlug = await prisma.artifact.findMany({
      where: { dossierId: "us-voting-1" },
    });
    if (bySlug.length !== 5) {
      throw new Error(`expected 5 us-voting artifacts, got ${bySlug.length}`);
    }
    const alignment = await prisma.artifact.findFirst({
      where: { slug: "alignment", dossierId: "us-voting-1" },
    });
    if (!alignment || alignment.lane !== "alignment") {
      throw new Error("us-alignment seed missing or wrong lane");
    }

    const provisional = await prisma.artifact.findFirst({
      where: { slug: "provisional", dossierId: "us-voting-1" },
    });
    if (!provisional || provisional.artifactId !== "us-provisional") {
      throw new Error("provisional slug did not resolve to us-provisional");
    }
    if (provisional.title !== "Provisional Ballot Handling") {
      throw new Error(`unexpected provisional title: ${provisional.title}`);
    }

    const rev = await prisma.artifactRevision.findUnique({
      where: { revisionId: provisional.currentRevisionId! },
    });
    const text = JSON.stringify(rev?.contentJson ?? []);
    if (!text.includes("chain of custody")) {
      throw new Error("provisional body missing chain-of-custody prose");
    }

    console.log("smoke-us-voting-seeds: OK");
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
