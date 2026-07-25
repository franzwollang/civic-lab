/**
 * Smoke: CONCEPT §8.3 claim adjudication scaffolding.
 * Run: DATABASE_URL="file:./smoke-adjudication.db" pnpm exec tsx scripts/smoke-adjudication.ts
 */
import { promises as fs } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { execFile } from "child_process";
import { promisify } from "util";
import { seedIfEmpty } from "../prisma/seed";
import {
  setPrisma,
  listAdjudicationQueue,
  requestClaimAdjudication,
  adjudicateClaim,
  getClaim,
  createClaim,
} from "../server/db";
import {
  EMPIRICAL_ADJUDICATION_OUTCOMES,
  REQUIREMENT_ADJUDICATION_OUTCOMES,
  adjudicatorUserIds,
  actorIsAdjudicator,
  isAdjudicationPending,
  isAdjudicationOutcomeLegal,
  isStatusLegalForProfile,
  validateAdjudicate,
  validateRequestAdjudication,
} from "../src/lib/claimAdjudication";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "prisma", "smoke-adjudication.db");

async function main() {
  process.env.DATABASE_URL = "file:./smoke-adjudication.db";
  await fs.rm(DB_PATH, { force: true });
  await fs.rm(`${DB_PATH}-journal`, { force: true });

  // Pure status sets.
  if (!isStatusLegalForProfile("empirical", "resolved_true")) {
    throw new Error("empirical resolved_true");
  }
  if (isStatusLegalForProfile("empirical", "satisfied")) {
    throw new Error("empirical must reject requirement status");
  }
  if (!isStatusLegalForProfile("requirement", "disputed")) {
    throw new Error("requirement disputed");
  }
  if (isAdjudicationOutcomeLegal("empirical", "open")) {
    throw new Error("open is not an adjudication outcome");
  }
  if (!EMPIRICAL_ADJUDICATION_OUTCOMES.includes("source_conflict")) {
    throw new Error("source_conflict outcome missing");
  }
  if (!REQUIREMENT_ADJUDICATION_OUTCOMES.includes("superseded")) {
    throw new Error("superseded outcome missing");
  }

  if (!actorIsAdjudicator("user-frank")) {
    throw new Error("Frank should be adjudicator");
  }
  if (actorIsAdjudicator("user-alice")) {
    throw new Error("Alice steward must not adjudicate");
  }
  if (!adjudicatorUserIds().includes("user-frank")) {
    throw new Error("adjudicatorUserIds should list Frank");
  }

  const pending = {
    adjudication_requested_at: "2026-07-12T09:00:00.000Z",
    adjudicated_at: null,
  };
  if (!isAdjudicationPending(pending)) {
    throw new Error("pending detection");
  }
  if (
    isAdjudicationPending({
      adjudication_requested_at: "2026-07-12T09:00:00.000Z",
      adjudicated_at: "2026-07-13T09:00:00.000Z",
    })
  ) {
    throw new Error("resolved request should not be pending");
  }
  if (
    !isAdjudicationPending({
      adjudication_requested_at: "2026-07-14T09:00:00.000Z",
      adjudicated_at: "2026-07-13T09:00:00.000Z",
    })
  ) {
    throw new Error("re-request after adjudicate should be pending");
  }

  const already = validateRequestAdjudication({
    author_id: "user-bob",
    claim: pending,
  });
  if (already.ok || already.error.code !== "already_queued") {
    throw new Error("already queued should fail");
  }

  const stewardAdj = validateAdjudicate({
    author_id: "user-alice",
    status: "resolved_true",
    rationale: "looks true",
    profile: "empirical",
  });
  if (stewardAdj.ok || stewardAdj.error.code !== "not_adjudicator") {
    throw new Error("steward must not adjudicate");
  }

  const badStatus = validateAdjudicate({
    author_id: "user-frank",
    status: "satisfied",
    rationale: "wrong profile status",
    profile: "empirical",
  });
  if (badStatus.ok || badStatus.error.code !== "illegal_status") {
    throw new Error("illegal cross-profile status");
  }

  const needRationale = validateAdjudicate({
    author_id: "user-frank",
    status: "ambiguous",
    rationale: "   ",
    profile: "empirical",
  });
  if (needRationale.ok || needRationale.error.code !== "rationale_required") {
    throw new Error("rationale required");
  }

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
  await seedIfEmpty(prisma);

  const queue = await listAdjudicationQueue();
  if (!queue.some((c) => c.claim_id === "claim-us-nvra-coverage")) {
    throw new Error("seed pending claim missing from queue");
  }
  if (queue.some((c) => c.claim_id === "claim-canon-turnout-trend")) {
    throw new Error("unrequested claim should not be queued");
  }

  const dup = await requestClaimAdjudication({
    claim_id: "claim-us-nvra-coverage",
    author_id: "user-alice",
    note: "again",
  });
  if (dup.ok || dup.error.code !== "already_queued") {
    throw new Error("duplicate request should 409-equivalent");
  }

  const stewardTry = await adjudicateClaim({
    claim_id: "claim-us-nvra-coverage",
    author_id: "user-alice",
    status: "source_conflict",
    rationale: "steward override attempt",
  });
  if (stewardTry.ok || stewardTry.error.code !== "not_adjudicator") {
    throw new Error("API must reject non-adjudicator");
  }

  const ok = await adjudicateClaim({
    claim_id: "claim-us-nvra-coverage",
    author_id: "user-frank",
    status: "source_conflict",
    rationale:
      "NASS and SOS directories conflict on three states; hold until primary sources reconcile.",
  });
  if (!ok.ok) {
    throw new Error(`adjudicate failed: ${JSON.stringify(ok.error)}`);
  }
  if (ok.claim.status !== "source_conflict") {
    throw new Error("status not applied");
  }
  if (ok.claim.adjudicated_by !== "user-frank") {
    throw new Error("adjudicated_by");
  }
  if (ok.claim.adjudication_pending) {
    throw new Error("should leave queue after adjudication");
  }

  const after = await listAdjudicationQueue();
  if (after.some((c) => c.claim_id === "claim-us-nvra-coverage")) {
    throw new Error("resolved claim still on queue");
  }

  // Fresh claim: request then adjudicate requirement outcome.
  const created = await createClaim({
    claim_id: "claim-smoke-req",
    artifact_id: "us-alignment",
    profile: "requirement",
    text: "Smoke requirement for adjudication",
    canon_citations: ["page-001"],
    author_id: "user-alice",
  });
  if (!created.ok) {
    throw new Error(`create requirement: ${JSON.stringify(created.error)}`);
  }

  const req = await requestClaimAdjudication({
    claim_id: "claim-smoke-req",
    author_id: "user-bob",
    note: "Need acceptance check",
  });
  if (!req.ok || !req.claim.adjudication_pending) {
    throw new Error("request should queue");
  }

  const notQueuedAdj = await adjudicateClaim({
    claim_id: "claim-canon-turnout-trend",
    author_id: "user-frank",
    status: "ambiguous",
    rationale: "not requested",
  });
  if (notQueuedAdj.ok || notQueuedAdj.error.code !== "not_queued") {
    throw new Error("adjudicate without queue should fail by default");
  }

  const accept = await adjudicateClaim({
    claim_id: "claim-smoke-req",
    author_id: "user-frank",
    status: "accepted",
    rationale: "Canon citation present; accept as open obligation.",
  });
  if (!accept.ok || accept.claim.status !== "accepted") {
    throw new Error("requirement accepted failed");
  }

  const requeue = await requestClaimAdjudication({
    claim_id: "claim-smoke-req",
    author_id: "user-alice",
    note: "Appeal with new evidence",
  });
  if (!requeue.ok || !requeue.claim.adjudication_pending) {
    throw new Error("appeal re-request should re-queue");
  }

  const checked = await getClaim("claim-smoke-req");
  if (!checked?.adjudication_pending) {
    throw new Error("getClaim pending flag");
  }

  await prisma.$disconnect();
  await fs.rm(DB_PATH, { force: true });
  await fs.rm(`${DB_PATH}-journal`, { force: true });
  console.log("smoke-adjudication: ok");
}

main().catch(async (err) => {
  console.error(err);
  process.exitCode = 1;
  try {
    await fs.rm(DB_PATH, { force: true });
    await fs.rm(`${DB_PATH}-journal`, { force: true });
  } catch {
    // ignore
  }
});
