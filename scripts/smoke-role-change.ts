/**
 * Smoke: CONCEPT §9.1 / §9.4 Owner role-change + append-only audit.
 * Run: DATABASE_URL="file:./smoke-role-change.db" pnpm exec tsx scripts/smoke-role-change.ts
 */
import { promises as fs } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { execFile } from "child_process";
import { promisify } from "util";
import { seedIfEmpty } from "../prisma/seed";
import {
  setPrisma,
  changeUserRoles,
  listAuditLogs,
  listEffectiveUsers,
  reloadRoleOverrides,
} from "../server/db";
import { actorMayDecide } from "../src/lib/mergeAuthority";
import {
  validateRoleChange,
  normalizeRoleList,
} from "../src/lib/roleChange";
import { userHasCapability } from "../src/app/lib/role-affordances";
import { getPrototypeUser } from "../src/app/lib/prototype-users";
import { getEffectivePrototypeUser } from "../src/lib/effectiveUsers";
import { app } from "../server/index";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "prisma", "smoke-role-change.db");

async function main() {
  // Unit gates
  const denySteward = validateRoleChange({
    actor_id: "user-alice",
    subject_user_id: "user-bob",
    roles: ["contributor"],
  });
  if (denySteward.ok || denySteward.code !== "not_owner") {
    throw new Error("steward must not appoint roles");
  }

  const denyEmpty = normalizeRoleList([]);
  if (denyEmpty.ok || denyEmpty.code !== "empty_roles") {
    throw new Error("empty roles must fail");
  }

  const denyInvalid = validateRoleChange({
    actor_id: "user-eve",
    subject_user_id: "user-bob",
    roles: ["not_a_role"],
  });
  if (denyInvalid.ok || denyInvalid.code !== "invalid_roles") {
    throw new Error("invalid role must fail");
  }

  const denyLastOwner = validateRoleChange({
    actor_id: "user-eve",
    subject_user_id: "user-eve",
    roles: ["contributor"],
  });
  if (denyLastOwner.ok || denyLastOwner.code !== "cannot_demote_last_owner") {
    throw new Error("cannot demote last Owner");
  }

  const okGate = validateRoleChange({
    actor_id: "user-eve",
    subject_user_id: "user-alice",
    roles: ["contributor"],
  });
  if (!okGate.ok) {
    throw new Error(`Owner demote steward should pass: ${okGate.code}`);
  }

  const eve = getPrototypeUser("user-eve")!;
  const alice = getPrototypeUser("user-alice")!;
  if (!userHasCapability(eve, "appoint_roles")) {
    throw new Error("Owner must have appoint_roles");
  }
  if (userHasCapability(alice, "appoint_roles")) {
    throw new Error("Steward must not have appoint_roles");
  }

  if (!actorMayDecide("user-alice", "manual_steward")) {
    throw new Error("seed Alice should decide Manual");
  }

  process.env.DATABASE_URL = "file:./smoke-role-change.db";
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
    await reloadRoleOverrides();

    const forbidden = await changeUserRoles({
      actor_id: "user-alice",
      subject_user_id: "user-bob",
      roles: ["contributor", "steward"],
    });
    if (forbidden.ok || forbidden.error.code !== "not_owner") {
      throw new Error("Alice must not change roles");
    }

    const demote = await changeUserRoles({
      actor_id: "user-eve",
      subject_user_id: "user-alice",
      roles: ["contributor"],
      rationale: "Smoke demote steward",
    });
    if (!demote.ok) {
      throw new Error(`Owner demote failed: ${demote.error.code}`);
    }
    if (demote.audit.action !== "role_change") {
      throw new Error("audit action must be role_change");
    }
    if (demote.user.roles.join(",") !== "contributor") {
      throw new Error("Alice roles not updated");
    }
    const payload = demote.audit.payload as {
      prior_roles?: string[];
      new_roles?: string[];
      rationale?: string | null;
    };
    if (
      !payload.prior_roles?.includes("steward") ||
      payload.new_roles?.join(",") !== "contributor" ||
      payload.rationale !== "Smoke demote steward"
    ) {
      throw new Error("role_change audit payload incomplete");
    }

    if (actorMayDecide("user-alice", "manual_steward")) {
      throw new Error("demoted Alice must not decide Manual");
    }
    const effectiveAlice = getEffectivePrototypeUser("user-alice");
    if (effectiveAlice?.roles.includes("steward")) {
      throw new Error("effective Alice still steward");
    }

    const listed = await listEffectiveUsers();
    const aliceRow = listed.find((u) => u.user_id === "user-alice");
    if (
      !aliceRow ||
      aliceRow.roles_source !== "override" ||
      aliceRow.roles.join(",") !== "contributor"
    ) {
      throw new Error("listEffectiveUsers missing Alice override");
    }

    const audits = await listAuditLogs({ action: "role_change", limit: 10 });
    if (!audits.some((a) => a.subject_id === "user-alice")) {
      throw new Error("role_change audit missing from list");
    }

    // Restore steward via HTTP (session Owner; body actor_id ignored)
    const { loginAs, withSession } = await import("./smoke-session-helper");
    const eveCookie = await loginAs("user-eve");
    const carolCookie = await loginAs("user-carol");

    const httpOk = await app.request(
      "/api/users/user-alice/roles",
      withSession(eveCookie, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roles: ["steward", "contributor"],
          rationale: "Smoke restore steward",
        }),
      }),
    );
    if (httpOk.status !== 200) {
      throw new Error(`HTTP Owner role change expected 200, got ${httpOk.status}`);
    }
    const httpBody = (await httpOk.json()) as {
      user?: { roles?: string[] };
      audit?: { action?: string };
    };
    if (
      httpBody.audit?.action !== "role_change" ||
      !httpBody.user?.roles?.includes("steward")
    ) {
      throw new Error("HTTP role change body incomplete");
    }
    if (!actorMayDecide("user-alice", "manual_steward")) {
      throw new Error("restored Alice should decide Manual");
    }

    const httpForbidden = await app.request(
      "/api/users/user-bob/roles",
      withSession(carolCookie, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actor_id: "user-eve",
          roles: ["editor", "contributor"],
        }),
      }),
    );
    if (httpForbidden.status !== 403) {
      throw new Error(
        `HTTP editor role change expected 403, got ${httpForbidden.status}`,
      );
    }

    const usersHttp = await app.request("/api/users");
    if (usersHttp.status !== 200) {
      throw new Error(`GET /api/users expected 200, got ${usersHttp.status}`);
    }
    const usersBody = (await usersHttp.json()) as Array<{ user_id: string }>;
    if (!usersBody.some((u) => u.user_id === "user-eve")) {
      throw new Error("GET /api/users missing Eve");
    }

    // last Owner still blocked after appointments exist
    const lastOwner = await changeUserRoles({
      actor_id: "user-eve",
      subject_user_id: "user-eve",
      roles: ["contributor"],
    });
    if (lastOwner.ok || lastOwner.error.code !== "cannot_demote_last_owner") {
      throw new Error("last Owner demotion must still fail");
    }

    console.log("smoke-role-change: OK");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
