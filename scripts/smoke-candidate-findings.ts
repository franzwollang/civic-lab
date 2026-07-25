/**
 * Smoke: CONCEPT §7.4–7.5 Candidate→Finding + timeline filters.
 * Run: DATABASE_URL="file:./smoke-candidate-findings.db" pnpm exec tsx scripts/smoke-candidate-findings.ts
 */
import { promises as fs } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { execFile } from "child_process";
import { promisify } from "util";
import { seedIfEmpty } from "../prisma/seed";
import {
  setPrisma,
  listCandidateFindings,
  flagCandidateFinding,
  promoteCandidateFinding,
  listFindings,
  createThreadPost,
} from "../server/db";
import {
  actorMayFlagCandidate,
  actorMayPromoteCandidate,
  findingMatchesTimelineFilter,
  postMatchesTimelineFilter,
} from "../src/lib/candidateFindings";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "prisma", "smoke-candidate-findings.db");

async function main() {
  process.env.DATABASE_URL = "file:./smoke-candidate-findings.db";
  await fs.rm(DB_PATH, { force: true });
  await fs.rm(`${DB_PATH}-journal`, { force: true });

  if (!actorMayFlagCandidate("user-bob")) {
    throw new Error("Bob should flag candidates");
  }
  if (!actorMayPromoteCandidate("user-dave")) {
    throw new Error("Dave (red_team) should promote");
  }
  if (actorMayPromoteCandidate("user-alice")) {
    throw new Error("Alice must not promote candidates");
  }
  if (
    !findingMatchesTimelineFilter("findings") ||
    postMatchesTimelineFilter("comment", "findings") ||
    !postMatchesTimelineFilter("mitigation", "findings_responses") ||
    !postMatchesTimelineFilter("comment", "all")
  ) {
    throw new Error("timeline filter helpers wrong");
  }

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

    const seededCandidates = await listCandidateFindings();
    if (seededCandidates.length < 2) {
      throw new Error(
        `expected ≥2 seeded candidates, got ${seededCandidates.length}`,
      );
    }
    const openUs = await listCandidateFindings({
      threadId: "thread-us-provisional-open",
      status: "open",
    });
    if (!openUs.some((c) => c.candidate_id === "candidate-us-prov-2")) {
      throw new Error("seeded US provisional candidate missing");
    }

    // Flag a fresh post on the multi-artifact open thread.
    const post = await createThreadPost({
      thread_id: "thread-us-multi-open",
      author_id: "user-carol",
      type: "comment",
      body: "Fresh discussion point for candidate flagging smoke.",
      post_id: "post-smoke-candidate-1",
    });
    if (!post) throw new Error("createThreadPost failed");

    const flagged = await flagCandidateFinding({
      candidate_id: "candidate-smoke-1",
      thread_id: "thread-us-multi-open",
      post_id: post.post_id,
      flagger_id: "user-carol",
      note: "smoke flag",
    });
    if (!flagged.ok) {
      throw new Error(`flag failed: ${JSON.stringify(flagged.error)}`);
    }
    if (flagged.candidate.status !== "open") {
      throw new Error("flagged candidate should be open");
    }

    const dup = await flagCandidateFinding({
      thread_id: "thread-us-multi-open",
      post_id: post.post_id,
      flagger_id: "user-bob",
    });
    if (dup.ok || dup.error.code !== "already_flagged") {
      throw new Error("duplicate flag should be already_flagged");
    }

    const forbidden = await promoteCandidateFinding({
      candidate_id: "candidate-smoke-1",
      author_id: "user-alice",
      severity: "high",
    });
    if (forbidden.ok || forbidden.error.code !== "forbidden") {
      throw new Error("non-RT promote must be forbidden");
    }

    const promoted = await promoteCandidateFinding({
      candidate_id: "candidate-smoke-1",
      author_id: "user-dave",
      severity: "high",
      title: "Smoke-promoted Finding",
      attack_path: "Merge without addressing flagged gap",
      targets: [
        { target_kind: "thread", target_id: "thread-us-multi-open" },
        { target_kind: "artifact", target_id: "us-voter-reg" },
      ],
    });
    if (!promoted.ok) {
      throw new Error(`promote failed: ${JSON.stringify(promoted.error)}`);
    }
    if (promoted.candidate.status !== "promoted") {
      throw new Error("candidate should be promoted");
    }
    if (promoted.finding.source_candidate_id !== "candidate-smoke-1") {
      throw new Error("finding must retain source_candidate_id");
    }
    if (promoted.finding.source_post_id !== post.post_id) {
      throw new Error("finding must retain source_post_id");
    }
    if (promoted.finding.severity !== "high") {
      throw new Error("promoted finding severity wrong");
    }

    const threadFindings = await listFindings({
      threadId: "thread-us-multi-open",
    });
    if (!threadFindings.some((f) => f.finding_id === promoted.finding.finding_id)) {
      throw new Error("promoted finding missing from thread list");
    }

    const rePromote = await promoteCandidateFinding({
      candidate_id: "candidate-smoke-1",
      author_id: "user-dave",
      severity: "med",
    });
    if (rePromote.ok || rePromote.error.code !== "not_open") {
      throw new Error("re-promote must be not_open");
    }

    // Mitigation post type accepted.
    const mit = await createThreadPost({
      thread_id: "thread-us-voter-reg-rfc",
      author_id: "user-alice",
      type: "mitigation",
      body: "Smoke mitigation response.",
    });
    if (!mit || mit.type !== "mitigation") {
      throw new Error("mitigation post create failed");
    }

    console.log("smoke-candidate-findings: ok");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
