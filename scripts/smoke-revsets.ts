/**
 * Smoke: M5 leaf RFC promote + RevSet → ArtifactRevision scaffolding.
 * Run: DATABASE_URL="file:./smoke-revsets.db" pnpm exec tsx scripts/smoke-revsets.ts
 */
import { promises as fs } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { execFile } from "child_process";
import { promisify } from "util";
import { seedIfEmpty } from "../prisma/seed";
import {
  setPrisma,
  getThread,
  listRevSets,
  promoteThreadToRfc,
  createAcceptedRisk,
  createRevSet,
  decideThread,
  getArtifact,
  listArtifactRevisions,
} from "../server/db";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "prisma", "smoke-revsets.db");

async function main() {
  process.env.DATABASE_URL = "file:./smoke-revsets.db";
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

    // Seeded leaf RFC has RevSet v1 pointing at proposal revision.
    const rfc = await getThread("thread-us-voter-reg-rfc");
    if (!rfc || rfc.state !== "rfc" || rfc.merge_artifact_id !== "us-voter-reg") {
      throw new Error("seeded leaf RFC missing");
    }
    if (!rfc.revsets || rfc.revsets.length < 1) {
      throw new Error("seeded RFC should include RevSet via getThread");
    }
    const seedRs = rfc.revsets[0]!;
    if (seedRs.artifact_revision_id !== "rev-us-voter-reg-rfc-1") {
      throw new Error(`bad seed revset revision: ${seedRs.artifact_revision_id}`);
    }

    const listed = await listRevSets("thread-us-voter-reg-rfc");
    if (!listed || listed.length !== 1) {
      throw new Error("listRevSets should return seeded revset");
    }

    // Proposal must not be current.
    const artifact = await getArtifact("us-voter-reg");
    if (!artifact || artifact.current_revision_id !== "rev-us-voter-reg-1") {
      throw new Error("current revision should remain seed current (not RFC proposal)");
    }
    const revs = await listArtifactRevisions("us-voter-reg");
    if (!revs.some((r) => r.revision_id === "rev-us-voter-reg-rfc-1")) {
      throw new Error("proposal revision missing from artifact revisions");
    }

    // createRevSet on open thread → not_leaf_rfc (before any promote).
    const bad = await createRevSet({
      thread_id: "thread-us-provisional-open",
      author_id: "user-alice",
      content_json: [{ type: "p", children: [{ text: "nope" }] }],
    });
    if (bad.ok || bad.error.code !== "not_leaf_rfc") {
      throw new Error(
        `createRevSet on open thread should fail not_leaf_rfc; got ${JSON.stringify(bad)}`,
      );
    }

    // Multi-artifact same Collection → wrapper parent + sub-RFCs.
    await prisma.threadTarget.create({
      data: {
        threadId: "thread-canon-voting-open",
        targetKind: "artifact",
        targetId: "us-voter-reg",
      },
    });
    // page-001 is Canon; us-voter-reg is Manual US → cross_collection.
    const cross = await promoteThreadToRfc({
      thread_id: "thread-canon-voting-open",
    });
    if (cross.ok || cross.error.code !== "cross_collection") {
      throw new Error(
        `cross-collection promote should fail; got ${JSON.stringify(cross)}`,
      );
    }

    // Same-Collection multi-artifact from seed thread-us-multi-open.
    const wrap = await promoteThreadToRfc({
      thread_id: "thread-us-multi-open",
      author_id: "user-alice",
    });
    if (!wrap.ok) {
      throw new Error(`wrapper promote failed: ${JSON.stringify(wrap.error)}`);
    }
    if (
      wrap.thread.rfc_kind !== "wrapper" ||
      wrap.thread.merge_artifact_id !== null
    ) {
      throw new Error("multi-artifact promote should yield wrapper (no merge id)");
    }
    if ((wrap.thread.child_threads?.length ?? 0) !== 2) {
      throw new Error(
        `expected 2 sub-RFCs; got ${JSON.stringify(wrap.thread.child_threads)}`,
      );
    }
    const childIds = wrap.thread.child_threads!.map((c) => c.thread_id).sort();
    if (
      childIds.join(",") !==
      ["thread-us-multi-open--us-provisional", "thread-us-multi-open--us-voter-reg"].join(
        ",",
      )
    ) {
      throw new Error(`bad child ids: ${childIds.join(",")}`);
    }
    for (const child of wrap.thread.child_threads!) {
      if (child.state !== "rfc" || !child.merge_artifact_id) {
        throw new Error(`bad child: ${JSON.stringify(child)}`);
      }
      const leaf = await getThread(child.thread_id);
      if (!leaf || leaf.parent_thread_id !== "thread-us-multi-open") {
        throw new Error("sub-RFC parent_thread_id mismatch");
      }
      if (leaf.rfc_kind !== "leaf") {
        throw new Error("sub-RFC should be leaf");
      }
    }

    // Wrapper itself cannot take RevSets.
    const wrapRs = await createRevSet({
      thread_id: "thread-us-multi-open",
      author_id: "user-alice",
      content_json: [{ type: "p", children: [{ text: "nope" }] }],
    });
    if (wrapRs.ok || wrapRs.error.code !== "not_leaf_rfc") {
      throw new Error(
        `wrapper createRevSet should be not_leaf_rfc; got ${JSON.stringify(wrapRs)}`,
      );
    }

    // Sub-RFC can take a RevSet.
    const subId = "thread-us-multi-open--us-voter-reg";
    const subRs = await createRevSet({
      thread_id: subId,
      author_id: "user-alice",
      summary: "Wrapper child proposal",
      content_json: [
        { type: "p", id: "w1", children: [{ text: "Coordinated leaf proposal" }] },
      ],
    });
    if (!subRs.ok || subRs.revset.artifact_id !== "us-voter-reg") {
      throw new Error(`sub-RFC RevSet failed: ${JSON.stringify(subRs)}`);
    }

    // Promote open provisional thread → leaf RFC (single artifact target).
    const promoted = await promoteThreadToRfc({
      thread_id: "thread-us-provisional-open",
      author_id: "user-alice",
    });
    if (!promoted.ok) {
      throw new Error(`promote failed: ${JSON.stringify(promoted.error)}`);
    }
    if (
      promoted.thread.state !== "rfc" ||
      promoted.thread.merge_artifact_id !== "us-provisional"
    ) {
      throw new Error("promote should set leaf merge_artifact_id from single target");
    }
    if ((promoted.thread.posts?.length ?? 0) < 3) {
      throw new Error("promote should append a system comment");
    }

    // Re-promote should fail.
    const again = await promoteThreadToRfc({
      thread_id: "thread-us-provisional-open",
    });
    if (again.ok || again.error.code !== "not_open") {
      throw new Error("second promote should fail not_open");
    }

    // Section-anchored open thread (one artifact) → leaf promote + RevSet.
    const goals = await promoteThreadToRfc({
      thread_id: "thread-canon-goals-section",
      author_id: "user-carol",
    });
    if (!goals.ok || goals.thread.merge_artifact_id !== "page-001") {
      throw new Error(`goals promote failed: ${JSON.stringify(goals)}`);
    }

    const newRs = await createRevSet({
      thread_id: "thread-canon-goals-section",
      author_id: "user-carol",
      summary: "Smoke RevSet proposal",
      content_json: [
        {
          type: "h2",
          id: "smoke-h1",
          children: [{ text: "Smoke proposal" }],
        },
        {
          type: "p",
          id: "smoke-p1",
          children: [{ text: "Proposed body from smoke-revsets." }],
        },
      ],
    });
    if (!newRs.ok) {
      throw new Error(`createRevSet failed: ${JSON.stringify(newRs.error)}`);
    }
    if (newRs.revset.version !== 1 || newRs.revset.artifact_id !== "page-001") {
      throw new Error("createRevSet version/artifact mismatch");
    }

    const page = await getArtifact("page-001");
    if (page?.current_revision_id === newRs.revset.artifact_revision_id) {
      throw new Error("RevSet must not flip current_revision_id");
    }

    // --- Leaf decide: merge applies latest RevSet ---
    const merged = await decideThread({
      thread_id: "thread-canon-goals-section",
      outcome: "merged",
      author_id: "user-carol",
    });
    if (!merged.ok) {
      throw new Error(`merge decide failed: ${JSON.stringify(merged.error)}`);
    }
    if (
      merged.thread.state !== "decided" ||
      merged.thread.decision_outcome !== "merged"
    ) {
      throw new Error("leaf merge should set decided/merged");
    }
    const pageAfter = await getArtifact("page-001");
    if (pageAfter?.current_revision_id !== newRs.revset.artifact_revision_id) {
      throw new Error("merge should flip current_revision_id to RevSet revision");
    }

    // Re-decide should fail.
    const againDecide = await decideThread({
      thread_id: "thread-canon-goals-section",
      outcome: "rejected",
    });
    if (againDecide.ok || againDecide.error.code !== "already_decided") {
      throw new Error("second decide should fail already_decided");
    }

    // Wrapper cannot be decided directly.
    const wrapDirect = await decideThread({
      thread_id: "thread-us-multi-open",
      outcome: "parked",
    });
    if (wrapDirect.ok || wrapDirect.error.code !== "wrapper_not_direct") {
      throw new Error(
        `wrapper direct decide should fail; got ${JSON.stringify(wrapDirect)}`,
      );
    }

    // Parent cascade: decide both sub-RFCs → wrapper decided.
    // One child already has a RevSet (us-voter-reg); park the other.
    const childA = "thread-us-multi-open--us-voter-reg";
    const childB = "thread-us-multi-open--us-provisional";

    const parkB = await decideThread({
      thread_id: childB,
      outcome: "parked",
      author_id: "user-alice",
    });
    if (!parkB.ok || parkB.parent_cascaded) {
      throw new Error(
        `parking one child should not cascade yet; got ${JSON.stringify(parkB)}`,
      );
    }
    const wrapMid = await getThread("thread-us-multi-open");
    if (!wrapMid || wrapMid.state !== "rfc") {
      throw new Error("wrapper should stay rfc until all children decided");
    }

    // Child A merges into us-voter-reg, which has a seeded Critical Finding —
    // Accepted Risk on this leaf clears the §7.6 gate.
    const childAr = await createAcceptedRisk({
      thread_id: childA,
      description: "Accept residual risk for wrapper child merge into us-voter-reg.",
      rationale: "Clears artifact-targeted Critical for this leaf only.",
      signer_id: "user-alice",
    });
    if (!childAr.ok) {
      throw new Error(
        `Accepted Risk on wrapper child failed: ${JSON.stringify(childAr.error)}`,
      );
    }

    const mergeA = await decideThread({
      thread_id: childA,
      outcome: "merged",
      author_id: "user-alice",
    });
    if (!mergeA.ok || !mergeA.parent_cascaded) {
      throw new Error(
        `second child decide should cascade parent; got ${JSON.stringify(mergeA)}`,
      );
    }
    const wrapDone = await getThread("thread-us-multi-open");
    if (
      !wrapDone ||
      wrapDone.state !== "decided" ||
      wrapDone.decision_outcome !== "parked"
    ) {
      // mixed merged+parked → aggregated parked
      throw new Error(
        `wrapper should be decided/parked (mixed); got ${JSON.stringify({
          state: wrapDone?.state,
          outcome: wrapDone?.decision_outcome,
        })}`,
      );
    }

    // Seeded leaf RFC merge (has RevSet) — Manual steward required.
    const forbiddenBob = await decideThread({
      thread_id: "thread-us-voter-reg-rfc",
      outcome: "merged",
      author_id: "user-bob",
    });
    if (forbiddenBob.ok || forbiddenBob.error.code !== "forbidden") {
      throw new Error(
        `contributor merge should be forbidden; got ${JSON.stringify(forbiddenBob)}`,
      );
    }

    // Seeded Critical Finding requires Accepted Risk before merge (§7.6).
    const needsAr = await decideThread({
      thread_id: "thread-us-voter-reg-rfc",
      outcome: "merged",
      author_id: "user-alice",
    });
    if (needsAr.ok || needsAr.error.code !== "critical_unaccepted") {
      throw new Error(
        `seeded leaf merge without AR should be critical_unaccepted; got ${JSON.stringify(needsAr)}`,
      );
    }
    const ar = await createAcceptedRisk({
      thread_id: "thread-us-voter-reg-rfc",
      description: "Accept residual risk for RevSet smoke merge.",
      rationale: "Clears Critical gate for steward merge.",
      signer_id: "user-alice",
    });
    if (!ar.ok) {
      throw new Error(`Accepted Risk failed: ${JSON.stringify(ar.error)}`);
    }

    const seedMerge = await decideThread({
      thread_id: "thread-us-voter-reg-rfc",
      outcome: "merged",
      author_id: "user-alice",
    });
    if (!seedMerge.ok) {
      throw new Error(`seeded leaf merge failed: ${JSON.stringify(seedMerge.error)}`);
    }
    const voter = await getArtifact("us-voter-reg");
    if (voter?.current_revision_id !== "rev-us-voter-reg-rfc-1") {
      throw new Error("seeded leaf merge should apply rev-us-voter-reg-rfc-1");
    }

    // Reject without RevSet is allowed; merge without RevSet is not.
    // Authority checked before RevSet — use an authorized steward.
    const provisional = await decideThread({
      thread_id: "thread-us-provisional-open",
      outcome: "merged",
      author_id: "user-alice",
    });
    if (provisional.ok || provisional.error.code !== "merge_requires_revset") {
      throw new Error(
        `merge without RevSet should fail; got ${JSON.stringify(provisional)}`,
      );
    }
    const rejected = await decideThread({
      thread_id: "thread-us-provisional-open",
      outcome: "rejected",
      author_id: "user-alice",
    });
    if (
      !rejected.ok ||
      rejected.thread.decision_outcome !== "rejected"
    ) {
      throw new Error(`reject failed: ${JSON.stringify(rejected)}`);
    }

    console.log("smoke-revsets: OK");
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
