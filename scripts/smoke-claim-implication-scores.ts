/**
 * Smoke: CONCEPT §5.2 advisory score propagation across model→forecast edges.
 * Run: DATABASE_URL="file:./smoke-claim-implication-scores.db" pnpm exec tsx scripts/smoke-claim-implication-scores.ts
 */
import { promises as fs } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { execFile } from "child_process";
import { promisify } from "util";
import { seedIfEmpty } from "../prisma/seed";
import { setPrisma, listClaims } from "../server/db";
import {
  IMPLIES_FORECAST_KIND,
  scoreModelImplications,
  scoreModelImplicationsById,
} from "../src/lib/claimImplications";
import {
  brierScore,
  logScore,
  skillVsBaseline,
} from "../src/lib/claimMetrics";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "prisma", "smoke-claim-implication-scores.db");

async function main() {
  process.env.DATABASE_URL = "file:./smoke-claim-implication-scores.db";
  await fs.rm(DB_PATH, { force: true });
  await fs.rm(`${DB_PATH}-journal`, { force: true });

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
    if (seeded !== "seeded") {
      throw new Error(`expected seeded, got ${seeded}`);
    }

    const claims = await listClaims({ artifactId: "page-001" });
    const scores = scoreModelImplications(claims);
    const byId = scoreModelImplicationsById(claims);

    const modelScore = byId.get("claim-canon-enp-model");
    if (!modelScore) {
      throw new Error("expected score row for claim-canon-enp-model");
    }
    if (modelScore.scored_n !== 1) {
      throw new Error(
        `seed model should score 1 resolved forecast, got n=${modelScore.scored_n}`,
      );
    }
    if (modelScore.open_n !== 1) {
      throw new Error(
        `seed model should have 1 open implied forecast, got open_n=${modelScore.open_n}`,
      );
    }
    if (modelScore.public_board_eligible) {
      throw new Error("n=1 must not be public-board eligible");
    }

    const enp = modelScore.contributions.find(
      (c) => c.forecast_claim_id === "claim-canon-pr-enp-resolved",
    );
    if (!enp?.scored || enp.outcome !== 1 || enp.probability !== 0.72) {
      throw new Error("ENP resolved forecast contribution missing/wrong");
    }
    const expectedBrier = brierScore(0.72, 1);
    const expectedLog = logScore(0.72, 1);
    const expectedSkill = skillVsBaseline(expectedBrier, brierScore(0.5, 1));
    if (Math.abs((enp.brier ?? 0) - expectedBrier) > 1e-3) {
      throw new Error(`ENP contrib Brier mismatch: ${enp.brier}`);
    }
    if (Math.abs((enp.log_score ?? 0) - expectedLog) > 1e-3) {
      throw new Error(`ENP contrib log mismatch: ${enp.log_score}`);
    }
    if (Math.abs((enp.skill_vs_baseline ?? 0) - expectedSkill) > 1e-3) {
      throw new Error(`ENP contrib skill mismatch: ${enp.skill_vs_baseline}`);
    }
    if (
      modelScore.mean_brier === null ||
      Math.abs(modelScore.mean_brier - expectedBrier) > 1e-3
    ) {
      throw new Error(`model mean_brier should equal sole contrib`);
    }

    const turnout = modelScore.contributions.find(
      (c) => c.forecast_claim_id === "claim-canon-turnout-trend",
    );
    if (!turnout || turnout.scored || turnout.status !== "open") {
      throw new Error("open turnout forecast must not be scored");
    }

    // Synthetic multi-resolution + missing target
    const synthetic = scoreModelImplications([
      {
        claim_id: "m-synth",
        text: "Synth model",
        status: "open",
        profile: "empirical",
        empirical_type: "model",
        links: [
          { kind: IMPLIES_FORECAST_KIND, claim_id: "f-true" },
          { kind: IMPLIES_FORECAST_KIND, claim_id: "f-false" },
          { kind: IMPLIES_FORECAST_KIND, claim_id: "f-missing" },
        ],
      },
      {
        claim_id: "f-true",
        text: "True forecast",
        status: "resolved_true",
        profile: "empirical",
        empirical_type: "forecast",
        probability: 0.8,
      },
      {
        claim_id: "f-false",
        text: "False forecast",
        status: "resolved_false",
        profile: "empirical",
        empirical_type: "forecast",
        probability: 0.3,
      },
    ]);
    if (synthetic.length !== 1) {
      throw new Error("expected one synthetic model score");
    }
    const s = synthetic[0]!;
    if (s.scored_n !== 2 || s.missing_n !== 1) {
      throw new Error(
        `synthetic expected scored_n=2 missing_n=1, got ${s.scored_n}/${s.missing_n}`,
      );
    }
    if (s.mean_brier === null || s.mean_log_score === null) {
      throw new Error("synthetic means must be present");
    }

    // Models without edges omitted
    if (scores.some((r) => r.implied_forecast_ids.length === 0)) {
      throw new Error("score rows must only include models with edges");
    }

    const graphUi = await fs.readFile(
      path.join(ROOT, "src/app/components/claim-implication-graph.tsx"),
      "utf8",
    );
    if (
      !graphUi.includes("scoreModelImplicationsById") ||
      !graphUi.includes("implication-score-") ||
      !graphUi.includes("Implied forecast score")
    ) {
      throw new Error("implication graph UI missing score propagation markers");
    }

    const lib = await fs.readFile(
      path.join(ROOT, "src/lib/claimImplications.ts"),
      "utf8",
    );
    if (
      !lib.includes("scoreModelImplications") ||
      !lib.includes("ModelImplicationScore")
    ) {
      throw new Error("claimImplications missing score propagation exports");
    }

    console.log("smoke-claim-implication-scores: ok");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
