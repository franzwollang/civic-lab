/**
 * Smoke: CONCEPT §7.6 Accepted Risk + Critical merge gate.
 * Run: DATABASE_URL="file:./smoke-accepted-risk.db" pnpm exec tsx scripts/smoke-accepted-risk.ts
 */
import { promises as fs } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { execFile } from "child_process";
import { promisify } from "util";
import { seedIfEmpty } from "../prisma/seed";
import {
  setPrisma,
  createAcceptedRisk,
  createFinding,
  createRevSet,
  decideThread,
  getAcceptedRiskForThread,
  getArtifact,
  getCollectionDashboard,
  getFinding,
  getThread,
  listOpenCriticalFindingsForMerge,
  promoteThreadToRfc,
} from "../server/db";
import {
  actorMaySignAcceptedRisk,
} from "../src/lib/acceptedRisk";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "prisma", "smoke-accepted-risk.db");

async function main() {
  process.env.DATABASE_URL = "file:./smoke-accepted-risk.db";
  await fs.rm(DB_PATH, { force: true });
  await fs.rm(`${DB_PATH}-journal`, { force: true });

  if (!actorMaySignAcceptedRisk("user-alice", "manuals")) {
    throw new Error("Alice (steward) should sign Manual Accepted Risk");
  }
  if (actorMaySignAcceptedRisk("user-carol", "manuals")) {
    throw new Error("Carol (editor) must not sign Manual Accepted Risk");
  }
  if (!actorMaySignAcceptedRisk("user-eve", "canon")) {
    throw new Error("Eve (owner) should sign Canon Accepted Risk");
  }
  if (actorMaySignAcceptedRisk("user-carol", "canon")) {
    throw new Error("Carol must not sign Canon Accepted Risk");
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

    const blockers = await listOpenCriticalFindingsForMerge({
      threadId: "thread-us-voter-reg-rfc",
      mergeArtifactId: "us-voter-reg",
    });
    if (!blockers.some((f) => f.finding_id === "finding-us-voter-reg-critical")) {
      throw new Error("seeded Critical should block US voter-reg leaf");
    }

    const detail = await getThread("thread-us-voter-reg-rfc");
    if (!detail?.open_critical_findings?.length) {
      throw new Error("getThread should expose open_critical_findings");
    }
    if (detail.accepted_risk) {
      throw new Error("seed should not include Accepted Risk");
    }

    // Merge blocked without AR.
    const blocked = await decideThread({
      thread_id: "thread-us-voter-reg-rfc",
      outcome: "merged",
      author_id: "user-alice",
    });
    if (blocked.ok || blocked.error.code !== "critical_unaccepted") {
      throw new Error(
        `merge without AR should be critical_unaccepted: ${JSON.stringify(blocked)}`,
      );
    }

    // Reject still allowed with open Critical (gate is merge-only).
    // Use provisional open thread — promote first? It's open not rfc.
    // Park the US leaf instead would decide it — use a throwaway leaf.
    // Contributor cannot sign AR.
    const bobAr = await createAcceptedRisk({
      thread_id: "thread-us-voter-reg-rfc",
      description: "Should fail",
      rationale: "Bob is not a steward",
      signer_id: "user-bob",
    });
    if (bobAr.ok || bobAr.error.code !== "forbidden") {
      throw new Error(`bob AR should be forbidden: ${JSON.stringify(bobAr)}`);
    }

    const ar = await createAcceptedRisk({
      thread_id: "thread-us-voter-reg-rfc",
      accepted_risk_id: "ar-us-voter-reg-1",
      description: "Accept residual provisional handoff gap for this merge.",
      rationale: "Mitigation tracked in follow-up Descriptive brief; merge unblocks voters.",
      evidence_considered: "finding-us-voter-reg-critical evidence",
      reopen_triggers: "New Critical Finding on us-voter-reg",
      signer_id: "user-alice",
    });
    if (!ar.ok) {
      throw new Error(`alice AR failed: ${JSON.stringify(ar.error)}`);
    }
    if (!ar.findings_updated.includes("finding-us-voter-reg-critical")) {
      throw new Error("AR should mark Critical finding accepted_risk");
    }

    const finding = await getFinding("finding-us-voter-reg-critical");
    if (finding?.status !== "accepted_risk") {
      throw new Error(`finding status should be accepted_risk, got ${finding?.status}`);
    }

    const afterAr = await getAcceptedRiskForThread("thread-us-voter-reg-rfc");
    if (!afterAr || afterAr.accepted_risk_id !== "ar-us-voter-reg-1") {
      throw new Error("Accepted Risk not persisted");
    }

    const usDash = await getCollectionDashboard("collection-us");
    if (!usDash || usDash.open_threads.critical_findings !== 0) {
      throw new Error(
        `US critical_findings should drop to 0 after AR; got ${usDash?.open_threads.critical_findings}`,
      );
    }

    const dup = await createAcceptedRisk({
      thread_id: "thread-us-voter-reg-rfc",
      description: "dup",
      rationale: "dup",
      signer_id: "user-alice",
    });
    if (dup.ok || dup.error.code !== "already_exists") {
      throw new Error(`duplicate AR should fail: ${JSON.stringify(dup)}`);
    }

    const merged = await decideThread({
      thread_id: "thread-us-voter-reg-rfc",
      outcome: "merged",
      author_id: "user-alice",
    });
    if (!merged.ok) {
      throw new Error(`merge after AR failed: ${JSON.stringify(merged.error)}`);
    }
    const voter = await getArtifact("us-voter-reg");
    if (voter?.current_revision_id !== "rev-us-voter-reg-rfc-1") {
      throw new Error("merge should apply seeded RevSet revision");
    }

    // Canon Critical path → Owner-only merge + Owner signs AR.
    const goals = await promoteThreadToRfc({
      thread_id: "thread-canon-goals-section",
      author_id: "user-carol",
    });
    if (!goals.ok) {
      throw new Error(`goals promote failed: ${JSON.stringify(goals.error)}`);
    }
    const rs = await createRevSet({
      thread_id: "thread-canon-goals-section",
      author_id: "user-carol",
      summary: "AR gate Canon proposal",
      content_json: [
        { type: "p", id: "ar-canon-p1", children: [{ text: "Canon body under Critical" }] },
      ],
    });
    if (!rs.ok) {
      throw new Error(`createRevSet failed: ${JSON.stringify(rs.error)}`);
    }
    const crit = await createFinding({
      finding_id: "finding-canon-goals-critical",
      thread_id: "thread-canon-goals-section",
      title: "Critical gap in goals section RFC",
      severity: "critical",
      author_id: "user-dave",
      targets: [
        { target_kind: "thread", target_id: "thread-canon-goals-section" },
        {
          target_kind: "artifact",
          target_id: goals.thread.merge_artifact_id!,
        },
      ],
    });
    if (!crit.ok) {
      throw new Error(`create Critical failed: ${JSON.stringify(crit.error)}`);
    }

    const canonDetail = await getThread("thread-canon-goals-section");
    if (
      !canonDetail?.merge_authority ||
      canonDetail.merge_authority.authority_class !== "canon_owner_only" ||
      !canonDetail.merge_authority.critical_or_accepted_risk_path
    ) {
      throw new Error(
        `Canon Critical path should be owner_only: ${JSON.stringify(canonDetail?.merge_authority)}`,
      );
    }

    const carolMerge = await decideThread({
      thread_id: "thread-canon-goals-section",
      outcome: "merged",
      author_id: "user-carol",
    });
    if (carolMerge.ok || carolMerge.error.code !== "forbidden") {
      throw new Error(
        `Carol must not merge Canon Critical path: ${JSON.stringify(carolMerge)}`,
      );
    }

    const carolAr = await createAcceptedRisk({
      thread_id: "thread-canon-goals-section",
      description: "Editor cannot sign Canon AR",
      rationale: "fail",
      signer_id: "user-carol",
    });
    if (carolAr.ok || carolAr.error.code !== "forbidden") {
      throw new Error(`Carol Canon AR should be forbidden: ${JSON.stringify(carolAr)}`);
    }

    const eveAr = await createAcceptedRisk({
      thread_id: "thread-canon-goals-section",
      description: "Owner accepts residual scoring-scope risk.",
      rationale: "Follow-up regional scope review scheduled.",
      signer_id: "user-eve",
    });
    if (!eveAr.ok) {
      throw new Error(`Eve AR failed: ${JSON.stringify(eveAr.error)}`);
    }

    const eveMerge = await decideThread({
      thread_id: "thread-canon-goals-section",
      outcome: "merged",
      author_id: "user-eve",
    });
    if (!eveMerge.ok) {
      throw new Error(`Eve merge after AR failed: ${JSON.stringify(eveMerge.error)}`);
    }

    console.log("smoke-accepted-risk: OK");
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
