/**
 * Smoke: CONCEPT §11 Collection dashboard + extra Manual country seeds.
 * Run: DATABASE_URL="file:./smoke-dashboard.db" pnpm exec tsx scripts/smoke-collection-dashboard.ts
 */
import { promises as fs } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { execFile } from "child_process";
import { promisify } from "util";
import { seedIfEmpty } from "../prisma/seed";
import {
  setPrisma,
  getCollectionDashboard,
  listCollections,
} from "../server/db";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "prisma", "smoke-dashboard.db");

async function main() {
  process.env.DATABASE_URL = "file:./smoke-dashboard.db";
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

    const manuals = (await listCollections()).filter((c) => c.country_code);
    const codes = new Set(manuals.map((c) => c.country_code));
    for (const code of ["US", "CA", "GB", "DE"]) {
      if (!codes.has(code)) {
        throw new Error(`expected Manual collection for ${code}`);
      }
    }

    const canon = await getCollectionDashboard("collection-canon");
    if (!canon) throw new Error("canon dashboard missing");
    if (canon.stats.dossier_count < 2) {
      throw new Error(`canon dossiers: ${canon.stats.dossier_count}`);
    }
    if (canon.stats.artifact_count < 1) {
      throw new Error("canon should have ≥1 seeded artifact");
    }
    if (canon.lane_coverage !== null) {
      throw new Error("Canon must not expose Manual lane_coverage");
    }
    if (canon.requirement_satisfaction !== null) {
      throw new Error("Canon must not expose requirement_satisfaction");
    }
    if (canon.open_threads.count < 1) {
      throw new Error("canon open_threads.count should include seeded threads");
    }
    if ("deferred" in canon.open_threads) {
      throw new Error("open_threads Critical findings should no longer defer");
    }
    if (canon.open_threads.critical_findings !== 0) {
      throw new Error("Canon seed Finding is med, not Critical");
    }
    if ("deferred" in canon.claims) {
      throw new Error("claims panel should no longer defer M6");
    }
    if (canon.claims.empirical_quality.total < 1) {
      throw new Error("canon should expose empirical_quality totals");
    }
    if (canon.claims.forecast_accuracy.n < 1) {
      throw new Error("canon should expose scored forecast_accuracy");
    }
    if ("deferred" in canon.red_team) {
      throw new Error("red_team should no longer defer M7");
    }
    if (canon.red_team.recent_count < 1) {
      throw new Error("canon red_team.recent_count should include seeded Finding");
    }
    if (!canon.reputation || canon.reputation.advisory !== true) {
      throw new Error("canon reputation board must be present and advisory");
    }
    if (canon.reputation.grants_permissions) {
      throw new Error("reputation must never grant permissions");
    }
    if (canon.reputation.n < 1) {
      throw new Error("canon reputation should include seeded signals");
    }

    const electoral = canon.dossiers.find((d) => d.dossier_id === "electoral-1");
    if (!electoral || electoral.health !== "seeded") {
      throw new Error("electoral-1 should be seeded health");
    }
    const alignment = canon.dossiers.find((d) => d.dossier_id === "alignment-1");
    if (!alignment || alignment.health !== "empty") {
      throw new Error("alignment-1 should be empty health");
    }

    const us = await getCollectionDashboard("collection-us");
    if (!us || !us.lane_coverage) {
      throw new Error("US dashboard must include lane_coverage");
    }
    if (us.lane_coverage.Prescriptive < 1) {
      throw new Error("US should tally Prescriptive artifacts");
    }
    if (us.lane_coverage.Descriptive < 1) {
      throw new Error("US should tally Descriptive artifacts");
    }
    if (us.lane_coverage.Alignment < 1) {
      throw new Error("US should tally Alignment artifacts");
    }
    if (
      !us.requirement_satisfaction ||
      us.requirement_satisfaction.total < 1 ||
      us.requirement_satisfaction.snapshot.satisfied < 1
    ) {
      throw new Error("US requirement_satisfaction should include seeded claims + snapshot");
    }
    if (us.claims.forecast_accuracy.n < 1) {
      throw new Error("US forecast_accuracy should include scored seeds");
    }
    if (us.open_threads.critical_findings < 1) {
      throw new Error("US should count seeded open Critical Finding");
    }
    if (us.red_team.recent_count < 2) {
      throw new Error("US red_team.recent_count should include seeded Findings");
    }
    if (!us.reputation || us.reputation.n < 5) {
      throw new Error("US reputation should aggregate posts/findings/adjudications/merged RevSets");
    }
    if (
      !us.reputation.contributors.some(
        (c) => c.user_id === "user-alice" && c.signals.merged_revsets >= 1,
      )
    ) {
      throw new Error("US reputation should credit Alice merged RevSet");
    }

    const ca = await getCollectionDashboard("collection-ca");
    if (!ca || ca.stats.dossier_count < 1) {
      throw new Error("CA collection should have a seed dossier");
    }
    const caElections = ca.dossiers.find((d) => d.dossier_id === "ca-elections-1");
    if (!caElections || caElections.health !== "seeded") {
      throw new Error("ca-elections-1 should be seeded health after Manual stubs");
    }
    if (ca.stats.artifact_count < 2) {
      throw new Error("CA collection should have ≥2 seeded artifacts");
    }

    const gb = await getCollectionDashboard("collection-gb");
    const de = await getCollectionDashboard("collection-de");
    if (!gb || gb.dossiers.every((d) => d.health !== "seeded")) {
      throw new Error("GB Manual dossiers should include a seeded dossier");
    }
    if (!de || de.dossiers.every((d) => d.health !== "seeded")) {
      throw new Error("DE Manual dossiers should include a seeded dossier");
    }

    const missing = await getCollectionDashboard("collection-nope");
    if (missing !== null) throw new Error("unknown collection should be null");

    console.log("smoke-collection-dashboard: OK");
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
