/**
 * Smoke: modular server/db + server/routes split — file presence, barrel imports, runtime DB.
 * Run: DATABASE_URL="file:./smoke-server-split.db" pnpm exec tsx scripts/smoke-server-split.ts
 */
import { promises as fs } from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { PrismaClient } from "@prisma/client";
import {
  appendAuditLog,
  getAttributions,
  getPrisma,
  listUserIdentities,
  searchCorpus,
  setPrisma,
} from "../server/db";
import { registerCorpusRoutes } from "../server/routes/corpus";
import { registerHealthRoutes } from "../server/routes/health";
import { registerModerationRoutes } from "../server/routes/moderation";
import { registerUploadRoutes } from "../server/routes/uploads";
import { seedIfEmpty } from "../prisma/seed";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();

const REQUIRED_FILES = [
  "server/db/prisma.ts",
  "server/db/registries.ts",
  "server/db/search.ts",
  "server/db/moderationDb.ts",
  "server/db/identities.ts",
  "server/routes/health.ts",
  "server/routes/uploads.ts",
  "server/routes/corpus.ts",
  "server/routes/moderation.ts",
];

async function main() {
  for (const rel of REQUIRED_FILES) {
    try {
      await fs.access(path.join(ROOT, rel));
    } catch {
      throw new Error(`missing module file: ${rel}`);
    }
  }

  if (typeof setPrisma !== "function" || typeof getPrisma !== "function") {
    throw new Error("prisma barrel exports missing");
  }
  if (typeof getAttributions !== "function" || typeof searchCorpus !== "function") {
    throw new Error("registry/search barrel exports missing");
  }
  if (typeof appendAuditLog !== "function" || typeof listUserIdentities !== "function") {
    throw new Error("moderation/identity barrel exports missing");
  }
  if (
    typeof registerCorpusRoutes !== "function" ||
    typeof registerHealthRoutes !== "function" ||
    typeof registerModerationRoutes !== "function" ||
    typeof registerUploadRoutes !== "function"
  ) {
    throw new Error("route registrar exports missing");
  }

  const dbPath = path.join(ROOT, "prisma", "smoke-server-split.db");
  process.env.DATABASE_URL = "file:./smoke-server-split.db";
  await fs.rm(dbPath, { force: true });
  await fs.rm(`${dbPath}-journal`, { force: true });

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

    const search = await searchCorpus("");
    if (search.hits.length !== 0 || search.query !== "") {
      throw new Error("empty searchCorpus must yield no hits");
    }

    const attributions = await getAttributions();
    if (typeof attributions.version !== "number" || !Array.isArray(attributions.items)) {
      throw new Error("getAttributions shape invalid");
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log("smoke-server-split: OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
