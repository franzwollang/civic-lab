/**
 * Smoke: CONCEPT §5.4–5.9 claim quality + forecast accuracy metrics.
 * Run: DATABASE_URL="file:./smoke-claim-metrics.db" pnpm exec tsx scripts/smoke-claim-metrics.ts
 */
import { promises as fs } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { execFile } from "child_process";
import { promisify } from "util";
import { seedIfEmpty } from "../prisma/seed";
import { setPrisma, getCollectionDashboard } from "../server/db";
import {
  brierScore,
  clampProbability,
  computeEmpiricalQuality,
  computeForecastAccuracy,
  computeRequirementSatisfactionSnapshot,
  logScore,
  PUBLIC_BOARD_MIN_N,
  skillVsBaseline,
} from "../src/lib/claimMetrics";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "prisma", "smoke-claim-metrics.db");

function approx(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) <= eps;
}

async function main() {
  // Unit checks (no DB)
  if (clampProbability(0) !== 0.01 || clampProbability(1) !== 0.99) {
    throw new Error("clampProbability bounds");
  }
  if (!approx(brierScore(0.7, 1), 0.09)) {
    throw new Error(`brier true: ${brierScore(0.7, 1)}`);
  }
  if (!approx(brierScore(0.7, 0), 0.49)) {
    throw new Error(`brier false: ${brierScore(0.7, 0)}`);
  }
  if (!approx(logScore(0.7, 1), Math.log(0.7))) {
    throw new Error("logScore true");
  }
  const baselineBrier = brierScore(0.5, 1);
  const skill = skillVsBaseline(brierScore(0.7, 1), baselineBrier);
  if (!approx(skill, baselineBrier - 0.09)) {
    throw new Error(`skill: ${skill}`);
  }

  const quality = computeEmpiricalQuality([
    {
      profile: "empirical",
      status: "open",
      empirical_type: "fact",
      preferred_sources: ["a", "b"],
    },
    {
      profile: "empirical",
      status: "invalidated",
      empirical_type: "forecast",
      probability: 0.2,
      preferred_sources: ["a"],
      created_at: "2024-01-01T00:00:00.000Z",
      adjudicated_at: "2024-01-11T00:00:00.000Z",
    },
    {
      profile: "empirical",
      status: "resolved_true",
      empirical_type: "forecast",
      probability: 0.8,
      preferred_sources: [],
      created_at: "2024-01-01T00:00:00.000Z",
      adjudicated_at: "2024-01-21T00:00:00.000Z",
    },
    { profile: "requirement", status: "open" },
  ]);
  if (quality.total !== 3 || quality.invalidated !== 1 || quality.resolved !== 1) {
    throw new Error(`quality counts: ${JSON.stringify(quality)}`);
  }
  if (quality.invalidated_rate !== 0.3333) {
    throw new Error(`invalidated_rate ${quality.invalidated_rate}`);
  }
  if (quality.mean_citation_density === null || quality.mean_citation_density < 0.9) {
    throw new Error(`citation density ${quality.mean_citation_density}`);
  }

  const forecast = computeForecastAccuracy([
    {
      profile: "empirical",
      status: "resolved_true",
      empirical_type: "forecast",
      probability: 0.8,
    },
    {
      profile: "empirical",
      status: "resolved_false",
      empirical_type: "forecast",
      probability: 0.3,
    },
    {
      profile: "empirical",
      status: "ambiguous",
      empirical_type: "forecast",
      probability: 0.5,
    },
  ]);
  if (forecast.n !== 2) throw new Error(`forecast n ${forecast.n}`);
  if (forecast.public_board_eligible !== false) {
    throw new Error("n<20 must not be public-board eligible");
  }
  if (forecast.mean_brier === null || forecast.mean_log_score === null) {
    throw new Error("forecast means missing");
  }

  const reqSnap = computeRequirementSatisfactionSnapshot([
    { profile: "requirement", status: "open" },
    { profile: "requirement", status: "satisfied" },
    { profile: "requirement", status: "satisfied" },
    { profile: "empirical", status: "open" },
  ]);
  if (reqSnap.open !== 1 || reqSnap.satisfied !== 2) {
    throw new Error(`req snapshot ${JSON.stringify(reqSnap)}`);
  }

  // Integration: seeded Collection dashboards
  process.env.DATABASE_URL = "file:./smoke-claim-metrics.db";
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

    const canon = await getCollectionDashboard("collection-canon");
    if (!canon) throw new Error("canon dashboard missing");
    if ("deferred" in canon.claims) {
      throw new Error("claims panel should no longer defer M6");
    }
    if (canon.claims.empirical_quality.total < 2) {
      throw new Error("canon should have seeded empirical claims");
    }
    if (canon.claims.forecast_accuracy.n < 2) {
      throw new Error("canon should have ≥2 scored resolved forecasts");
    }
    if (canon.claims.forecast_accuracy.mean_brier === null) {
      throw new Error("canon mean_brier should be computed");
    }
    if (canon.claims.forecast_accuracy.baseline_p !== 0.5) {
      throw new Error("baseline_p should be 0.5");
    }
    if (canon.claims.forecast_accuracy.n < PUBLIC_BOARD_MIN_N) {
      if (canon.claims.forecast_accuracy.public_board_eligible) {
        throw new Error("seed n < 20 must not be board-eligible");
      }
    }
    if (canon.open_threads.critical_findings !== 0) {
      throw new Error("Canon seed Finding is med, not Critical");
    }
    if ("deferred" in canon.open_threads) {
      throw new Error("open_threads should no longer defer Critical findings");
    }

    const us = await getCollectionDashboard("collection-us");
    if (!us) throw new Error("US dashboard missing");
    if (us.claims.empirical_quality.total < 3) {
      throw new Error("US empirical quality total too low");
    }
    if (
      us.claims.empirical_quality.invalidated_rate === null ||
      us.claims.empirical_quality.invalidated_rate <= 0
    ) {
      throw new Error("US should show non-zero invalidated rate from seed");
    }
    if (us.claims.forecast_accuracy.n < 2) {
      throw new Error("US should have scored forecasts");
    }
    if (
      !us.requirement_satisfaction ||
      us.requirement_satisfaction.total < 2 ||
      us.requirement_satisfaction.snapshot.satisfied < 1
    ) {
      throw new Error("US requirement snapshot should include satisfied seed");
    }
    if ("deferred" in (us.requirement_satisfaction as object)) {
      throw new Error("requirement_satisfaction should not defer M6");
    }

    console.log("smoke-claim-metrics: OK");
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
