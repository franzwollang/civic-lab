/**
 * Smoke: M9 advisory reputation scaffolding (CONCEPT §9.2 / §5.9).
 * Run: DATABASE_URL="file:./smoke-reputation.db" pnpm exec tsx scripts/smoke-reputation.ts
 */
import { promises as fs } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { execFile } from "child_process";
import { promisify } from "util";
import { seedIfEmpty } from "../prisma/seed";
import { setPrisma, getCollectionDashboard } from "../server/db";
import {
  advisoryScoreFor,
  computeReputationBoard,
  REPUTATION_BOARD_MIN_N,
  SIGNAL_WEIGHTS,
  type ReputationSignalEvent,
} from "../src/lib/reputation";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "prisma", "smoke-reputation.db");

async function main() {
  // Unit: weights + aggregation + anti-gaming floor
  const unitEvents: ReputationSignalEvent[] = [
    { user_id: "u1", kind: "merged_revset" },
    { user_id: "u1", kind: "review_labor" },
    { user_id: "u2", kind: "red_team_finding" },
    { user_id: "u2", kind: "adjudication" },
    { user_id: "u2", kind: "accepted_risk_sign" },
  ];
  const unit = computeReputationBoard(unitEvents);
  if (unit.advisory !== true || unit.grants_permissions !== false) {
    throw new Error("board must be advisory and never grant permissions");
  }
  if (unit.n !== 5) throw new Error(`unit n: ${unit.n}`);
  if (unit.public_board_eligible) {
    throw new Error("n=5 must not be public-board eligible");
  }
  if (unit.contributors[0]?.user_id !== "u2") {
    throw new Error(
      `expected u2 first (higher score); got ${unit.contributors[0]?.user_id}`,
    );
  }
  const u2 = unit.contributors.find((c) => c.user_id === "u2");
  const expectedU2 =
    SIGNAL_WEIGHTS.red_team_finding +
    SIGNAL_WEIGHTS.adjudication +
    SIGNAL_WEIGHTS.accepted_risk_sign;
  if (!u2 || u2.advisory_score !== expectedU2) {
    throw new Error(`u2 score ${u2?.advisory_score} !== ${expectedU2}`);
  }
  if (
    advisoryScoreFor({
      merged_revsets: 1,
      review_labor: 1,
      red_team_findings: 0,
      adjudications: 0,
      accepted_risk_signs: 0,
      endorsements: 0,
    }) !==
    SIGNAL_WEIGHTS.merged_revset + SIGNAL_WEIGHTS.review_labor
  ) {
    throw new Error("advisoryScoreFor mismatch");
  }

  const many: ReputationSignalEvent[] = Array.from(
    { length: REPUTATION_BOARD_MIN_N },
    (_, i) => ({ user_id: `pad-${i}`, kind: "review_labor" as const }),
  );
  const eligible = computeReputationBoard(many);
  if (!eligible.public_board_eligible || eligible.n !== REPUTATION_BOARD_MIN_N) {
    throw new Error("n≥20 should be public_board_eligible");
  }

  process.env.DATABASE_URL = "file:./smoke-reputation.db";
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

    const us = await getCollectionDashboard("collection-us");
    if (!us) throw new Error("US dashboard missing");
    if (!us.reputation) throw new Error("reputation panel missing");
    if (us.reputation.advisory !== true || us.reputation.grants_permissions) {
      throw new Error("US reputation must be advisory-only");
    }
    if (us.reputation.n < 5) {
      throw new Error(`US reputation n too low: ${us.reputation.n}`);
    }
    if (us.reputation.public_board_eligible) {
      throw new Error("seed US board should still be preview-only (n < 20)");
    }
    if (!Array.isArray(us.reputation.hidden_user_ids)) {
      throw new Error("reputation.hidden_user_ids missing");
    }
    if (!Array.isArray(us.board_hides)) {
      throw new Error("board_hides missing on dashboard");
    }

    const alice = us.reputation.contributors.find(
      (c) => c.user_id === "user-alice",
    );
    if (!alice || alice.signals.merged_revsets < 1) {
      throw new Error(
        `Alice should have merged RevSet signal: ${JSON.stringify(alice)}`,
      );
    }
    if (!alice.display_name?.includes("Alice")) {
      throw new Error(`Alice display_name: ${alice.display_name}`);
    }

    const dave = us.reputation.contributors.find(
      (c) => c.user_id === "user-dave",
    );
    if (!dave || dave.signals.red_team_findings < 1) {
      throw new Error(
        `Dave should have Red Team findings: ${JSON.stringify(dave)}`,
      );
    }

    const frank = us.reputation.contributors.find(
      (c) => c.user_id === "user-frank",
    );
    if (!frank || frank.signals.adjudications < 1) {
      throw new Error(
        `Frank should have adjudications: ${JSON.stringify(frank)}`,
      );
    }

    const canon = await getCollectionDashboard("collection-canon");
    if (!canon?.reputation) throw new Error("Canon reputation missing");
    const canonDave = canon.reputation.contributors.find(
      (c) => c.user_id === "user-dave",
    );
    if (!canonDave || canonDave.signals.red_team_findings < 1) {
      throw new Error("Canon should include Dave finding signal");
    }
    const canonFrank = canon.reputation.contributors.find(
      (c) => c.user_id === "user-frank",
    );
    if (!canonFrank || canonFrank.signals.adjudications < 1) {
      throw new Error("Canon should include Frank adjudications");
    }

    console.log("smoke-reputation: ok");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
