/**
 * Smoke: M8 role affordances + prototype impersonation helpers.
 * Run: DATABASE_URL="file:./smoke-impersonation.db" pnpm exec tsx scripts/smoke-impersonation.ts
 *
 * Pure module checks (no DB required for assertions); still uses a disposable
 * SQLite file so the runner's DATABASE_URL pattern stays consistent.
 */
import { promises as fs } from "fs";
import path from "path";
import {
  DEFAULT_PROTOTYPE_USER_ID,
  PROTOTYPE_USERS,
  formatUserLabel,
  getPrototypeUser,
} from "../src/app/lib/prototype-users";
import {
  capabilitiesForRoles,
  summarizeRoleAffordances,
  userHasCapability,
} from "../src/app/lib/role-affordances";
import { actorMayDecide } from "../src/lib/mergeAuthority";
import { actorMaySignAcceptedRisk } from "../src/lib/acceptedRisk";
import { actorMayCreateFinding } from "../src/lib/findings";
import { actorIsAdjudicator } from "../src/lib/claimAdjudication";

const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "prisma", "smoke-impersonation.db");

async function main() {
  // Disposable path hygiene (runner sets DATABASE_URL; we don't need Prisma).
  await fs.rm(DB_PATH, { force: true });
  await fs.rm(`${DB_PATH}-journal`, { force: true });

  if (PROTOTYPE_USERS.length < 6) {
    throw new Error(`expected ≥6 prototype users, got ${PROTOTYPE_USERS.length}`);
  }
  if (!getPrototypeUser(DEFAULT_PROTOTYPE_USER_ID)) {
    throw new Error("default prototype user missing");
  }

  const alice = getPrototypeUser("user-alice")!;
  const bob = getPrototypeUser("user-bob")!;
  const carol = getPrototypeUser("user-carol")!;
  const dave = getPrototypeUser("user-dave")!;
  const eve = getPrototypeUser("user-eve")!;
  const frank = getPrototypeUser("user-frank")!;

  // Distinct primary powers (separation of powers).
  if (!userHasCapability(alice, "merge_manual")) {
    throw new Error("steward should merge Manual");
  }
  if (userHasCapability(alice, "merge_canon_restricted")) {
    throw new Error("steward must not merge restricted Canon");
  }
  if (!userHasCapability(carol, "merge_canon_routine")) {
    throw new Error("editor should merge routine Canon");
  }
  if (userHasCapability(carol, "merge_manual")) {
    throw new Error("editor must not merge Manual");
  }
  if (!userHasCapability(eve, "merge_canon_restricted")) {
    throw new Error("owner should merge restricted Canon");
  }
  if (!userHasCapability(dave, "create_findings")) {
    throw new Error("red_team should create findings");
  }
  if (userHasCapability(dave, "merge_manual")) {
    throw new Error("red_team must not merge");
  }
  if (!userHasCapability(frank, "adjudicate_claims")) {
    throw new Error("adjudicator should adjudicate");
  }
  if (userHasCapability(frank, "merge_canon_routine")) {
    throw new Error("adjudicator must not merge");
  }
  if (userHasCapability(bob, "create_findings")) {
    throw new Error("contributor must not create findings");
  }

  // Cross-check with existing gate helpers.
  if (!actorMayDecide("user-alice", "manual_steward")) {
    throw new Error("alice may decide manual_steward");
  }
  if (actorMayDecide("user-bob", "manual_steward")) {
    throw new Error("bob must not decide manual_steward");
  }
  if (!actorMayDecide("user-carol", "canon_editor")) {
    throw new Error("carol may decide canon_editor");
  }
  if (!actorMayDecide("user-eve", "canon_owner_only")) {
    throw new Error("eve may decide canon_owner_only");
  }
  if (actorMayDecide("user-carol", "canon_owner_only")) {
    throw new Error("carol must not decide canon_owner_only");
  }
  if (!actorMaySignAcceptedRisk("user-alice", "manuals")) {
    throw new Error("alice may sign Manual AR");
  }
  if (!actorMaySignAcceptedRisk("user-eve", "canon")) {
    throw new Error("eve may sign Canon AR");
  }
  if (actorMaySignAcceptedRisk("user-carol", "canon")) {
    throw new Error("carol must not sign Canon AR");
  }
  if (!actorMayCreateFinding("user-dave")) {
    throw new Error("dave may create findings");
  }
  if (actorMayCreateFinding("user-alice")) {
    throw new Error("alice must not create findings");
  }
  if (!actorIsAdjudicator("user-frank")) {
    throw new Error("frank is adjudicator");
  }
  if (actorIsAdjudicator("user-eve")) {
    throw new Error("eve is not adjudicator");
  }

  const daveCaps = capabilitiesForRoles(dave.roles);
  if (!daveCaps.includes("create_findings") || daveCaps.includes("merge_manual")) {
    throw new Error("dave capability set wrong");
  }

  const eveSummary = summarizeRoleAffordances(eve);
  if (eveSummary.primary_role !== "owner") {
    throw new Error("eve primary role");
  }
  if (!eveSummary.capability_labels.some((l) => /restricted Canon/i.test(l))) {
    throw new Error("eve headline capabilities missing restricted Canon");
  }
  if (!formatUserLabel(alice).includes("Alice")) {
    throw new Error("formatUserLabel");
  }

  // No single identity holds every gated power (anti-collapse check).
  for (const u of PROTOTYPE_USERS) {
    const caps = new Set(capabilitiesForRoles(u.roles));
    const allGated: Array<
      "merge_manual" | "merge_canon_restricted" | "create_findings" | "adjudicate_claims"
    > = [
      "merge_manual",
      "merge_canon_restricted",
      "create_findings",
      "adjudicate_claims",
    ];
    const held = allGated.filter((c) => caps.has(c));
    if (held.length === allGated.length) {
      throw new Error(
        `${u.id} holds all gated powers — collapsed admin identity`,
      );
    }
  }

  console.log("smoke-impersonation: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
