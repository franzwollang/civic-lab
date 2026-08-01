/**
 * Smoke: CONCEPT §9.4 moderator tools residual —
 * soft-delete posts + broader append-only audit (merge / adjudication / AR).
 * Run: DATABASE_URL="file:./smoke-moderation.db" pnpm exec tsx scripts/smoke-moderation.ts
 */
import { promises as fs } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { execFile } from "child_process";
import { promisify } from "util";
import { seedIfEmpty } from "../prisma/seed";
import {
  setPrisma,
  createThreadPost,
  softDeleteThreadPost,
  getThread,
  listAuditLogs,
  decideThread,
  adjudicateClaim,
  createAcceptedRisk,
  createRevSet,
  requestClaimAdjudication,
} from "../server/db";
import {
  actorMayViewAuditLog,
  validateSoftDeletePost,
} from "../src/lib/moderation";
import { defaultIdentityRecord } from "../src/lib/identityPolicy";
import { userHasCapability } from "../src/app/lib/role-affordances";
import { getPrototypeUser } from "../src/app/lib/prototype-users";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "prisma", "smoke-moderation.db");

function verifiedIdentity(
  userId: string,
  countryCodes: string[],
  tiesNote?: string | null,
) {
  return {
    ...defaultIdentityRecord(userId),
    verification_status: "verified" as const,
    country_codes: countryCodes,
    long_term_ties_note: tiesNote ?? null,
    attestation_kind: "owner_attested" as const,
  };
}

async function main() {
  // Unit: soft-delete gates (Manual path via §8.6 evaluateStewardEligibility)
  const ownerOk = validateSoftDeletePost({
    actor_id: "user-eve",
    context: { area_kind: "canon", country_code: null },
  });
  if (!ownerOk.ok) throw new Error("Owner should soft-delete Canon posts");

  const stewardCanon = validateSoftDeletePost({
    actor_id: "user-alice",
    context: { area_kind: "canon", country_code: null },
    identity: verifiedIdentity("user-alice", ["US"]),
  });
  if (stewardCanon.ok || stewardCanon.code !== "canon_owner_only") {
    throw new Error("Steward must not moderate Canon");
  }

  const stewardUs = validateSoftDeletePost({
    actor_id: "user-alice",
    context: { area_kind: "manuals", country_code: "US" },
    identity: verifiedIdentity("user-alice", ["US"]),
  });
  if (!stewardUs.ok) throw new Error("US steward should moderate US Manual");

  const stewardCa = validateSoftDeletePost({
    actor_id: "user-alice",
    context: { area_kind: "manuals", country_code: "CA" },
    identity: verifiedIdentity("user-alice", ["US"]),
  });
  if (stewardCa.ok || stewardCa.code !== "steward_country_mismatch") {
    throw new Error("US steward must not moderate CA Manual");
  }

  const tiesCa = validateSoftDeletePost({
    actor_id: "user-alice",
    context: { area_kind: "manuals", country_code: "CA" },
    identity: verifiedIdentity("user-alice", [], "Lived in Canada 12 years"),
  });
  if (!tiesCa.ok) {
    throw new Error("Owner-attested long-term ties should allow CA soft-delete");
  }

  const unverified = validateSoftDeletePost({
    actor_id: "user-alice",
    context: { area_kind: "manuals", country_code: "US" },
    identity: defaultIdentityRecord("user-alice"),
  });
  if (unverified.ok || unverified.code !== "identity_unverified") {
    throw new Error("unverified steward must be blocked on Manual soft-delete");
  }

  const contributor = validateSoftDeletePost({
    actor_id: "user-bob",
    context: { area_kind: "manuals", country_code: "US" },
    identity: verifiedIdentity("user-bob", ["US"]),
  });
  if (contributor.ok || contributor.code !== "forbidden") {
    throw new Error("Contributor must not soft-delete");
  }

  // HTTP route gates (actorMayViewAuditLog) — same helper used by
  // GET /api/audit-logs?actor_id=… and include_deleted on GET /api/threads/:id
  if (!actorMayViewAuditLog("user-eve")) {
    throw new Error("Owner should view audit");
  }
  if (!actorMayViewAuditLog("user-alice")) {
    throw new Error("Steward should view audit");
  }
  if (actorMayViewAuditLog("user-bob")) {
    throw new Error("Contributor must not view audit");
  }

  const eve = getPrototypeUser("user-eve");
  const alice = getPrototypeUser("user-alice");
  if (!userHasCapability(eve, "moderate_posts")) {
    throw new Error("Owner needs moderate_posts");
  }
  if (!userHasCapability(alice, "view_audit")) {
    throw new Error("Steward needs view_audit");
  }
  if (userHasCapability(getPrototypeUser("user-bob"), "moderate_posts")) {
    throw new Error("Bob must not moderate");
  }

  process.env.DATABASE_URL = "file:./smoke-moderation.db";
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

    const post = await createThreadPost({
      thread_id: "thread-us-provisional-open",
      author_id: "user-bob",
      body: "Please soft-delete me (moderation smoke)",
    });
    if (!post) throw new Error("createThreadPost failed");

    // Wrong thread_id must 404 with no write (URL pre-check)
    const mismatch = await softDeleteThreadPost({
      post_id: post.post_id,
      thread_id: "thread-canon-goals-section",
      actor_id: "user-alice",
      reason: "should not mutate",
    });
    if (mismatch.ok || mismatch.error.code !== "not_found") {
      throw new Error("wrong thread_id soft-delete should be not_found");
    }
    const stillLive = await prisma.threadPost.findUnique({
      where: { postId: post.post_id },
    });
    if (!stillLive || stillLive.deletedAt) {
      throw new Error("mismatch soft-delete must not mutate the post");
    }

    const denyBob = await softDeleteThreadPost({
      post_id: post.post_id,
      actor_id: "user-bob",
    });
    if (denyBob.ok || denyBob.error.code !== "forbidden") {
      throw new Error("Bob soft-delete should be forbidden");
    }

    const deleted = await softDeleteThreadPost({
      post_id: post.post_id,
      thread_id: "thread-us-provisional-open",
      actor_id: "user-alice",
      reason: "Spam / off-topic",
    });
    if (!deleted.ok) {
      throw new Error(`Alice soft-delete failed: ${JSON.stringify(deleted)}`);
    }
    if (!deleted.post.deleted_at || deleted.post.deleted_by !== "user-alice") {
      throw new Error("soft-delete fields missing on post");
    }
    if (deleted.audit.action !== "post_soft_delete") {
      throw new Error("expected post_soft_delete audit");
    }

    const live = await getThread("thread-us-provisional-open");
    if (!live) throw new Error("thread missing");
    if ((live.posts ?? []).some((p) => p.post_id === post.post_id)) {
      throw new Error("soft-deleted post should be hidden by default");
    }

    const withDeleted = await getThread("thread-us-provisional-open", {
      include_deleted_posts: true,
    });
    const tombstone = (withDeleted?.posts ?? []).find(
      (p) => p.post_id === post.post_id,
    );
    if (!tombstone?.deleted_at) {
      throw new Error("include_deleted should return tombstone");
    }

    const again = await softDeleteThreadPost({
      post_id: post.post_id,
      actor_id: "user-alice",
    });
    if (again.ok || again.error.code !== "already_deleted") {
      throw new Error("second soft-delete should be already_deleted");
    }

    // Canon post — steward forbidden, Owner ok
    const canonPost = await createThreadPost({
      thread_id: "thread-canon-goals-section",
      author_id: "user-bob",
      body: "Canon noise",
    });
    if (!canonPost) throw new Error("canon post create failed");
    const stewardCanonDb = await softDeleteThreadPost({
      post_id: canonPost.post_id,
      actor_id: "user-alice",
    });
    if (
      stewardCanonDb.ok ||
      stewardCanonDb.error.code !== "canon_owner_only"
    ) {
      throw new Error("steward Canon soft-delete should be canon_owner_only");
    }
    const ownerCanon = await softDeleteThreadPost({
      post_id: canonPost.post_id,
      actor_id: "user-eve",
    });
    if (!ownerCanon.ok) {
      throw new Error(`Owner Canon soft-delete failed: ${JSON.stringify(ownerCanon)}`);
    }

    // Broader audit: adjudication + claim_status_change
    const claimId = "claim-us-align-canon-criteria";
    await requestClaimAdjudication({
      claim_id: claimId,
      author_id: "user-alice",
      note: "moderation smoke queue",
    });
    const adj = await adjudicateClaim({
      claim_id: claimId,
      author_id: "user-frank",
      status: "satisfied",
      rationale: "Smoke adjudication for audit coverage.",
      require_queued: false,
    });
    if (!adj.ok) {
      throw new Error(`adjudicate failed: ${JSON.stringify(adj)}`);
    }
    const adjAudits = await listAuditLogs({ action: "adjudication", limit: 5 });
    if (adjAudits.length < 1) throw new Error("adjudication audit missing");
    const statusAudits = await listAuditLogs({
      action: "claim_status_change",
      limit: 5,
    });
    if (statusAudits.length < 1) {
      throw new Error("claim_status_change audit missing");
    }

    // Merge audit on a decidable leaf with RevSet
    const leafId = "thread-us-voter-reg-rfc";
    const leaf = await getThread(leafId);
    if (!leaf || leaf.state === "decided") {
      // Seed leaf may still be open rfc — if already decided, skip merge path
    } else {
      // Ensure Accepted Risk if Critical blockers exist
      if (
        (leaf.open_critical_findings?.length ?? 0) > 0 &&
        !leaf.accepted_risk
      ) {
        const ar = await createAcceptedRisk({
          thread_id: leafId,
          description: "Smoke AR for merge audit",
          rationale: "Clear Critical gate for smoke.",
          signer_id: "user-alice",
        });
        if (!ar.ok) {
          throw new Error(`AR failed: ${JSON.stringify(ar)}`);
        }
        const arAudits = await listAuditLogs({
          action: "accepted_risk",
          limit: 5,
        });
        if (arAudits.length < 1) throw new Error("accepted_risk audit missing");
      }
      // Ensure at least one RevSet
      if (!leaf.revsets || leaf.revsets.length === 0) {
        const rs = await createRevSet({
          thread_id: leafId,
          author_id: "user-bob",
          summary: "Smoke revset for merge audit",
        });
        if (!rs.ok) {
          throw new Error(`createRevSet failed: ${JSON.stringify(rs)}`);
        }
      }
      const decided = await decideThread({
        thread_id: leafId,
        outcome: "merged",
        author_id: "user-alice",
      });
      if (!decided.ok) {
        throw new Error(`merge failed: ${JSON.stringify(decided)}`);
      }
      const mergeAudits = await listAuditLogs({ action: "merge", limit: 5 });
      if (mergeAudits.length < 1) throw new Error("merge audit missing");
    }

    const softAudits = await listAuditLogs({
      action: "post_soft_delete",
      limit: 10,
    });
    if (softAudits.length < 2) {
      throw new Error(`expected ≥2 soft-delete audits, got ${softAudits.length}`);
    }

    console.log("smoke-moderation: OK");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
