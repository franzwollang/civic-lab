/**
 * Dev/runtime DB bootstrap: ensure SQLite exists → prisma db push → seed-if-empty.
 */
import { execFile } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { promisify } from "util";
import { PrismaClient } from "@prisma/client";
import { seedIfEmpty } from "../prisma/seed";

const execFileAsync = promisify(execFile);

const ROOT = process.cwd();
const PRISMA_DIR = path.join(ROOT, "prisma");
const DB_FILE = path.join(PRISMA_DIR, "dev.db");

function ensureDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    // Relative to prisma/ schema location (Prisma convention).
    process.env.DATABASE_URL = "file:./dev.db";
  }
}

async function runDbPush() {
  const prismaCli = path.join(ROOT, "node_modules", "prisma", "build", "index.js");
  await execFileAsync(
    process.execPath,
    [prismaCli, "db", "push", "--skip-generate"],
    {
      cwd: ROOT,
      env: { ...process.env },
      maxBuffer: 10 * 1024 * 1024,
    },
  );
}

export async function bootstrapDatabase(): Promise<PrismaClient> {
  ensureDatabaseUrl();

  await fs.mkdir(PRISMA_DIR, { recursive: true });

  // Create empty file so path exists before first push (optional; push creates it).
  try {
    await fs.access(DB_FILE);
  } catch {
    await fs.writeFile(DB_FILE, "");
  }

  console.log("[db] prisma db push…");
  await runDbPush();

  const prisma = new PrismaClient();
  const result = await seedIfEmpty(prisma);
  if (result === "seeded") {
    console.log("[db] seeded from prisma/seed/ (was empty)");
  } else {
    console.log("[db] seed skipped (SeedMeta present)");
  }

  return prisma;
}
