/**
 * Smoke: M9 Owner board-hide + append-only audit (CONCEPT §5.9 / §9.4).
 * Run: DATABASE_URL="file:./smoke-board-hide.db" pnpm exec tsx scripts/smoke-board-hide.ts
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
  hideUserFromBoards,
  liftBoardHide,
  listAuditLogs,
  listActiveBoardHides,
} from "../server/db";
import {
  actorIsOwner,
  filterEventsExcludingHidden,
  validateBoardHide,
  validateBoardHideLift,
} from "../src/lib/boardHide";
import { computeReputationBoard } from "../src/lib/reputation";
import { userHasCapability } from "../src/app/lib/role-affordances";
import { getPrototypeUser } from "../src/app/lib/prototype-users";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "prisma", "smoke-board-hide.db");

async function main() {
  // Unit: owner gate + filter
  if (!actorIsOwner("user-eve")) throw new Error("Eve should be owner");
  if (actorIsOwner("user-alice")) throw new Error("Alice is not owner");

  const denySteward = validateBoardHide({
    actor_id: "user-alice",
    subject_user_id: "user-bob",
  });
  if (denySteward.ok || denySteward.code !== "not_owner") {
    throw new Error("steward must not board-hide");
  }

  const denySelf = validateBoardHide({
    actor_id: "user-eve",
    subject_user_id: "user-eve",
  });
  if (denySelf.ok || denySelf.code !== "cannot_hide_self") {
    throw new Error("owner cannot hide self");
  }

  const ok = validateBoardHide({
    actor_id: "user-eve",
    subject_user_id: "user-bob",
  });
  if (!ok.ok) throw new Error(`expected ok hide: ${JSON.stringify(ok)}`);

  const liftOk = validateBoardHideLift({
    actor_id: "user-eve",
    subject_user_id: "user-bob",
  });
  if (!liftOk.ok) throw new Error("owner should lift");

  const filtered = filterEventsExcludingHidden(
    [
      { user_id: "user-bob", kind: "review_labor" as const },
      { user_id: "user-alice", kind: "review_labor" as const },
    ],
    ["user-bob"],
  );
  if (filtered.length !== 1 || filtered[0]?.user_id !== "user-alice") {
    throw new Error("filterEventsExcludingHidden failed");
  }

  const board = computeReputationBoard(
    [
      { user_id: "user-bob", kind: "merged_revset" },
      { user_id: "user-alice", kind: "review_labor" },
      { user_id: "user-bob", kind: "review_labor" },
    ],
    { hiddenUserIds: ["user-bob"] },
  );
  if (board.n !== 1) throw new Error(`hidden board n: ${board.n}`);
  if (board.contributors.some((c) => c.user_id === "user-bob")) {
    throw new Error("Bob should be excluded from board");
  }

  const eve = getPrototypeUser("user-eve");
  if (!userHasCapability(eve, "board_hide")) {
    throw new Error("Owner needs board_hide capability");
  }
  if (userHasCapability(getPrototypeUser("user-alice"), "board_hide")) {
    throw new Error("Steward must not have board_hide");
  }

  process.env.DATABASE_URL = "file:./smoke-board-hide.db";
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

    const before = await getCollectionDashboard("collection-us");
    if (!before) throw new Error("US dashboard missing");
    if (!Array.isArray(before.board_hides) || before.board_hides.length !== 0) {
      throw new Error("board_hides should start empty");
    }
    if (!before.reputation.hidden_user_ids) {
      throw new Error("reputation.hidden_user_ids missing");
    }
    const bobBefore = before.reputation.contributors.find(
      (c) => c.user_id === "user-bob",
    );
    // Bob may or may not have signals; Alice should be present
    const aliceBefore = before.reputation.contributors.find(
      (c) => c.user_id === "user-alice",
    );
    if (!aliceBefore) throw new Error("Alice should appear before hide");

    const forbidden = await hideUserFromBoards({
      actor_id: "user-alice",
      subject_user_id: "user-bob",
      reason: "nope",
    });
    if (forbidden.ok || forbidden.error.code !== "not_owner") {
      throw new Error("non-owner hide must 403-equivalent");
    }

    const hideTarget = bobBefore ? "user-bob" : "user-dave";
    const hide = await hideUserFromBoards({
      actor_id: "user-eve",
      subject_user_id: hideTarget,
      reason: "Suspected board gaming",
    });
    if (!hide.ok) throw new Error(`hide failed: ${JSON.stringify(hide.error)}`);
    if (hide.audit.action !== "board_hide") {
      throw new Error("audit action should be board_hide");
    }

    const active = await listActiveBoardHides();
    if (active.length !== 1 || active[0]?.subject_user_id !== hideTarget) {
      throw new Error("active hide list mismatch");
    }

    const dup = await hideUserFromBoards({
      actor_id: "user-eve",
      subject_user_id: hideTarget,
      reason: "again",
    });
    if (dup.ok || dup.error.code !== "already_hidden") {
      throw new Error("duplicate hide should fail");
    }

    const after = await getCollectionDashboard("collection-us");
    if (!after) throw new Error("US dashboard after hide");
    if (after.board_hides.length !== 1) {
      throw new Error("dashboard board_hides should list active hide");
    }
    if (!after.reputation.hidden_user_ids.includes(hideTarget)) {
      throw new Error("hidden_user_ids should include target");
    }
    if (
      after.reputation.contributors.some((c) => c.user_id === hideTarget)
    ) {
      throw new Error("hidden user must not appear on reputation board");
    }

    const audits = await listAuditLogs({ action: "board_hide" });
    if (audits.length < 1) throw new Error("board_hide audit missing");

    const lifted = await liftBoardHide({
      actor_id: "user-eve",
      subject_user_id: hideTarget,
      note: "False positive",
    });
    if (!lifted.ok) {
      throw new Error(`lift failed: ${JSON.stringify(lifted.error)}`);
    }
    if (lifted.audit.action !== "board_hide_lift") {
      throw new Error("lift audit action");
    }

    const afterLift = await getCollectionDashboard("collection-us");
    if (!afterLift) throw new Error("dashboard after lift");
    if (afterLift.board_hides.length !== 0) {
      throw new Error("no active hides after lift");
    }
    if (afterLift.reputation.hidden_user_ids.length !== 0) {
      throw new Error("hidden_user_ids should clear after lift");
    }

    const liftAudits = await listAuditLogs({ action: "board_hide_lift" });
    if (liftAudits.length < 1) throw new Error("lift audit missing");

    // Append-only: hide rows remain with lifted_at set
    const allHides = await prisma.boardHide.findMany();
    if (allHides.length !== 1 || !allHides[0]?.liftedAt) {
      throw new Error("lifted hide row should remain with lifted_at");
    }
    const allAudits = await prisma.auditLog.count();
    if (allAudits < 2) throw new Error("expected ≥2 audit rows");

    console.log("smoke-board-hide: ok");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
