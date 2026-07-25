/**
 * Smoke: Prisma Artifact model maps to legacy pages table; seed + CRUD works.
 */
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";
import { seedIfEmpty } from "../prisma/seed";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DB = path.join(ROOT, "prisma", "smoke-artifact-rename.db");

async function main() {
  process.env.DATABASE_URL = `file:${DB}`;
  await fs.rm(DB, { force: true });
  await fs.rm(`${DB}-journal`, { force: true });

  // db push via prisma CLI
  const { execFile } = await import("child_process");
  const { promisify } = await import("util");
  const execFileAsync = promisify(execFile);
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

    const artifact = await prisma.artifact.findUnique({
      where: { artifactId: "page-001" },
    });
    if (!artifact || artifact.slug !== "voting-systems") {
      throw new Error("Artifact page-001 / voting-systems missing after seed");
    }

    const revisions = await prisma.artifactRevision.findMany({
      where: { artifactId: "page-001" },
    });
    if (revisions.length < 1) {
      throw new Error("expected at least one ArtifactRevision");
    }

    // Confirm physical table names still legacy via raw query.
    const tables = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
    `;
    const names = tables.map((t) => t.name);
    if (!names.includes("pages") || !names.includes("page_revisions")) {
      throw new Error(`legacy table names missing: ${names.join(",")}`);
    }
    if (names.includes("artifacts") || names.includes("artifact_revisions")) {
      throw new Error("unexpected new physical table names — @@map broken?");
    }

    console.log(
      `ok: Artifact→pages @@map; seeded ${revisions.length} revisions for ${artifact.slug}`,
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
