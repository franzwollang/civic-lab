/**
 * Smoke: CONCEPT §3.4 Collection merge authority on leaf decide.
 * Run: DATABASE_URL="file:./smoke-merge-authority.db" pnpm exec tsx scripts/smoke-merge-authority.ts
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
  promoteThreadToRfc,
  createAcceptedRisk,
  createRevSet,
  decideThread,
  getArtifact,
  resolveMergeAuthorityForArtifact,
} from "../server/db";
import {
  actorMayDecide,
  classifyMergeAuthority,
  requiredRolesForClass,
} from "../src/lib/mergeAuthority";
import { getPrototypeUser, PROTOTYPE_USERS } from "../src/app/lib/prototype-users";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "prisma", "smoke-merge-authority.db");

async function main() {
  process.env.DATABASE_URL = "file:./smoke-merge-authority.db";
  await fs.rm(DB_PATH, { force: true });
  await fs.rm(`${DB_PATH}-journal`, { force: true });

  if (!getPrototypeUser("user-eve")?.roles.includes("owner")) {
    throw new Error("expected user-eve owner in prototype catalog");
  }
  if (PROTOTYPE_USERS.length < 5) {
    throw new Error("expected ≥5 prototype users including owner");
  }

  // Pure classifier checks (no DB).
  if (classifyMergeAuthority({ area_kind: "manuals", owner_merge_only: false }) !== "manual_steward") {
    throw new Error("manuals → manual_steward");
  }
  if (classifyMergeAuthority({ area_kind: "canon", owner_merge_only: false }) !== "canon_editor") {
    throw new Error("canon routine → canon_editor");
  }
  if (classifyMergeAuthority({ area_kind: "canon", owner_merge_only: true }) !== "canon_owner_only") {
    throw new Error("canon restricted → canon_owner_only");
  }
  if (!actorMayDecide("user-alice", "manual_steward")) {
    throw new Error("alice steward should decide Manual");
  }
  if (actorMayDecide("user-bob", "manual_steward")) {
    throw new Error("bob contributor must not decide Manual");
  }
  if (!actorMayDecide("user-carol", "canon_editor")) {
    throw new Error("carol editor should decide Canon routine");
  }
  if (actorMayDecide("user-carol", "canon_owner_only")) {
    throw new Error("carol must not decide owner_merge_only");
  }
  if (!actorMayDecide("user-eve", "canon_owner_only")) {
    throw new Error("eve owner should decide restricted Canon");
  }
  if (!requiredRolesForClass("manual_steward").includes("steward")) {
    throw new Error("manual required roles");
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

    const charter = await getArtifact("canon-charter");
    if (!charter?.owner_merge_only) {
      throw new Error("seeded canon-charter should be owner_merge_only");
    }

    const manualCtx = await resolveMergeAuthorityForArtifact("us-voter-reg");
    if (!manualCtx || manualCtx.authority_class !== "manual_steward") {
      throw new Error(`us-voter-reg authority: ${JSON.stringify(manualCtx)}`);
    }
    const canonCtx = await resolveMergeAuthorityForArtifact("page-001");
    if (!canonCtx || canonCtx.authority_class !== "canon_editor") {
      throw new Error(`page-001 authority: ${JSON.stringify(canonCtx)}`);
    }
    const restrictedCtx = await resolveMergeAuthorityForArtifact("canon-charter");
    if (!restrictedCtx || restrictedCtx.authority_class !== "canon_owner_only") {
      throw new Error(`charter authority: ${JSON.stringify(restrictedCtx)}`);
    }

    // Seeded Manual leaf RFC — contributor forbidden; steward merges.
    const detail = await getThread("thread-us-voter-reg-rfc");
    if (!detail?.merge_authority || detail.merge_authority.authority_class !== "manual_steward") {
      throw new Error("getThread should expose merge_authority for leaf RFC");
    }
    if (!detail.merge_authority.allowed_user_ids.includes("user-alice")) {
      throw new Error("alice should be in allowed_user_ids for Manual");
    }

    const bobDenied = await decideThread({
      thread_id: "thread-us-voter-reg-rfc",
      outcome: "merged",
      author_id: "user-bob",
    });
    if (bobDenied.ok || bobDenied.error.code !== "forbidden") {
      throw new Error(`bob Manual merge should be forbidden: ${JSON.stringify(bobDenied)}`);
    }

    const carolDeniedManual = await decideThread({
      thread_id: "thread-us-voter-reg-rfc",
      outcome: "parked",
      author_id: "user-carol",
    });
    if (carolDeniedManual.ok || carolDeniedManual.error.code !== "forbidden") {
      throw new Error(
        `carol (Canon editor) must not decide Manual: ${JSON.stringify(carolDeniedManual)}`,
      );
    }

    // Seeded Critical Finding blocks merge until Accepted Risk (CONCEPT §7.6).
    const blockedCritical = await decideThread({
      thread_id: "thread-us-voter-reg-rfc",
      outcome: "merged",
      author_id: "user-alice",
    });
    if (
      blockedCritical.ok ||
      blockedCritical.error.code !== "critical_unaccepted"
    ) {
      throw new Error(
        `alice merge without AR should be critical_unaccepted: ${JSON.stringify(blockedCritical)}`,
      );
    }

    const ar = await createAcceptedRisk({
      thread_id: "thread-us-voter-reg-rfc",
      description: "Accept residual handoff gap for authority smoke merge.",
      rationale: "Tracked follow-up; steward clears Critical gate.",
      signer_id: "user-alice",
    });
    if (!ar.ok) {
      throw new Error(`Accepted Risk failed: ${JSON.stringify(ar.error)}`);
    }

    const aliceOk = await decideThread({
      thread_id: "thread-us-voter-reg-rfc",
      outcome: "merged",
      author_id: "user-alice",
    });
    if (!aliceOk.ok) {
      throw new Error(`alice Manual merge failed: ${JSON.stringify(aliceOk.error)}`);
    }

    // Canon routine — promote section thread, RevSet, editor merges; steward denied.
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
      summary: "Authority smoke proposal",
      content_json: [
        { type: "p", id: "auth-p1", children: [{ text: "Canon routine merge body" }] },
      ],
    });
    if (!rs.ok) {
      throw new Error(`createRevSet failed: ${JSON.stringify(rs.error)}`);
    }

    const aliceCanonDenied = await decideThread({
      thread_id: "thread-canon-goals-section",
      outcome: "merged",
      author_id: "user-alice",
    });
    if (aliceCanonDenied.ok || aliceCanonDenied.error.code !== "forbidden") {
      throw new Error(
        `alice steward must not merge Canon routine: ${JSON.stringify(aliceCanonDenied)}`,
      );
    }

    const carolCanon = await decideThread({
      thread_id: "thread-canon-goals-section",
      outcome: "merged",
      author_id: "user-carol",
    });
    if (!carolCanon.ok) {
      throw new Error(`carol Canon merge failed: ${JSON.stringify(carolCanon.error)}`);
    }

    // Restricted Canon (owner_merge_only) — create leaf via promote of a new thread.
    await prisma.thread.create({
      data: {
        threadId: "thread-charter-open",
        homeDossierId: "electoral-1",
        title: "RFC: Charter premises tweak",
        state: "open",
        isRedteam: false,
        createdAt: new Date(),
        targets: {
          create: [
            { targetKind: "artifact", targetId: "canon-charter" },
          ],
        },
        posts: {
          create: [
            {
              postId: "post-charter-1",
              authorId: "user-eve",
              type: "comment",
              body: "Propose a clarifying sentence under minimum premises.",
              createdAt: new Date(),
            },
          ],
        },
      },
    });
    const charterPromote = await promoteThreadToRfc({
      thread_id: "thread-charter-open",
      author_id: "user-eve",
    });
    if (!charterPromote.ok || charterPromote.thread.merge_artifact_id !== "canon-charter") {
      throw new Error(`charter promote failed: ${JSON.stringify(charterPromote)}`);
    }
    const charterRs = await createRevSet({
      thread_id: "thread-charter-open",
      author_id: "user-eve",
      summary: "Owner-only merge proposal",
      content_json: [
        {
          type: "h2",
          id: "charter-h1",
          children: [{ text: "Civic Lab Charter" }],
        },
        {
          type: "p",
          id: "charter-smoke-p",
          children: [{ text: "Owner-merged clarifying sentence." }],
        },
      ],
    });
    if (!charterRs.ok) {
      throw new Error(`charter RevSet failed: ${JSON.stringify(charterRs.error)}`);
    }

    const carolRestricted = await decideThread({
      thread_id: "thread-charter-open",
      outcome: "merged",
      author_id: "user-carol",
    });
    if (carolRestricted.ok || carolRestricted.error.code !== "forbidden") {
      throw new Error(
        `carol must not merge owner_merge_only: ${JSON.stringify(carolRestricted)}`,
      );
    }

    const eveOk = await decideThread({
      thread_id: "thread-charter-open",
      outcome: "merged",
      author_id: "user-eve",
    });
    if (!eveOk.ok) {
      throw new Error(`eve restricted merge failed: ${JSON.stringify(eveOk.error)}`);
    }
    const charterAfter = await getArtifact("canon-charter");
    if (charterAfter?.current_revision_id !== charterRs.revset.artifact_revision_id) {
      throw new Error("owner merge should apply charter RevSet revision");
    }

    // Owner may also decide Manual (meta-veto / always-allowed).
    const provisional = await promoteThreadToRfc({
      thread_id: "thread-us-provisional-open",
      author_id: "user-alice",
    });
    if (!provisional.ok) {
      throw new Error(`provisional promote failed: ${JSON.stringify(provisional.error)}`);
    }
    const parkByOwner = await decideThread({
      thread_id: "thread-us-provisional-open",
      outcome: "parked",
      author_id: "user-eve",
    });
    if (!parkByOwner.ok || parkByOwner.thread.decision_outcome !== "parked") {
      throw new Error(`owner Manual park failed: ${JSON.stringify(parkByOwner)}`);
    }

    console.log("smoke-merge-authority: OK");
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
