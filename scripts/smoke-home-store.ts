/**
 * Smoke: home/store dossier enrichment + manuals map seed data.
 * Run: DATABASE_URL="file:./smoke-home.db" pnpm exec tsx scripts/smoke-home-store.ts
 */
import { promises as fs } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { execFile } from "child_process";
import { promisify } from "util";
import { seedIfEmpty } from "../prisma/seed";
import {
  setPrisma,
  listDossiers,
  listCollections,
  listThreads,
  listFindings,
} from "../server/db";
import { laneForDossier } from "../src/app/lib/dossier-display";

const RFC_HOME_STATES = new Set(["rfc", "review", "decided"]);
const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "prisma", "smoke-home.db");

async function main() {
  process.env.DATABASE_URL = "file:./smoke-home.db";
  await fs.rm(DB_PATH, { force: true });
  await fs.rm(`${DB_PATH}-journal`, { force: true });

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

    const dossiers = await listDossiers();
    if (dossiers.length < 3) {
      throw new Error(`expected ≥3 dossiers, got ${dossiers.length}`);
    }

    const electoral = dossiers.find((d) => d.dossier_id === "electoral-1");
    if (!electoral) throw new Error("electoral-1 missing");
    if (electoral.artifact_count !== 1) {
      throw new Error(
        `electoral-1 artifact_count expected 1 (page-001; Charter in governance), got ${electoral.artifact_count}`,
      );
    }
    if (electoral.collection_title !== "Canon") {
      throw new Error(`bad collection_title: ${electoral.collection_title}`);
    }
    if (laneForDossier(electoral) !== "Descriptive") {
      throw new Error("electoral-1 lane should be Descriptive");
    }

    const alignment = dossiers.find((d) => d.dossier_id === "alignment-1");
    if (!alignment || laneForDossier(alignment) !== "Alignment") {
      throw new Error("alignment-1 lane should be Alignment");
    }

    const us = dossiers.find((d) => d.dossier_id === "us-voting-1");
    if (!us || us.country_code !== "US") {
      throw new Error("us-voting-1 should carry country_code US");
    }
    if (laneForDossier(us) !== "Prescriptive") {
      throw new Error("us-voting-1 lane should be Prescriptive");
    }

    const manuals = await listCollections();
    const manualCountries = manuals.filter((c) => c.country_code);
    if (!manualCountries.some((c) => c.country_code === "US")) {
      throw new Error("expected US manual collection for map picker");
    }

    const threads = await listThreads();
    const homeRfcs = threads.filter((t) => RFC_HOME_STATES.has(t.state));
    if (homeRfcs.length < 1) {
      throw new Error("expected ≥1 RFC/review/decided thread for home panel");
    }
    if (!homeRfcs.some((t) => t.state === "rfc")) {
      throw new Error("expected at least one state=rfc thread");
    }

    const findings = await listFindings();
    if (findings.length < 2) {
      throw new Error(`expected ≥2 findings for home RT panel, got ${findings.length}`);
    }
    const withHome = findings.find((f) => f.home_dossier_id && f.home_dossier_title);
    if (!withHome) {
      throw new Error("findings should carry home_dossier_id + title for home panel");
    }
    if (!findings.some((f) => f.severity === "critical")) {
      throw new Error("expected a seeded critical finding on home panel feed");
    }

    console.log("smoke-home-store: OK");
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
