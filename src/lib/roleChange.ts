/**
 * CONCEPT §9.1 / §9.4 — Owner appoints / changes roles; append-only audit.
 *
 * Seed `PROTOTYPE_USERS` remains the user directory. Appointments persist as
 * SQLite overrides (`UserRoleAssignment`) and feed effective-user resolution.
 */

import {
  type PrototypeRole,
  type PrototypeUser,
} from "../app/lib/prototype-users";
import {
  countEffectiveOwners,
  getEffectivePrototypeUser,
  listEffectivePrototypeUsers,
} from "./effectiveUsers";
import { AUTH_MODE } from "./identityPolicy";

export const PROTOTYPE_ROLE_VALUES = [
  "owner",
  "editor",
  "steward",
  "red_team",
  "adjudicator",
  "contributor",
  "observer",
] as const satisfies readonly PrototypeRole[];

export type RoleChangeErrorCode =
  | "unknown_actor"
  | "not_owner"
  | "unknown_user"
  | "invalid_roles"
  | "empty_roles"
  | "no_change"
  | "cannot_demote_last_owner";

export type RoleChangeValidation =
  | { ok: true; prior_roles: PrototypeRole[]; new_roles: PrototypeRole[] }
  | { ok: false; code: RoleChangeErrorCode; message: string };

export function isPrototypeRole(value: string): value is PrototypeRole {
  return (PROTOTYPE_ROLE_VALUES as readonly string[]).includes(value);
}

export function normalizeRoleList(
  roles: readonly string[],
):
  | { ok: true; roles: PrototypeRole[] }
  | { ok: false; code: "invalid_roles" | "empty_roles"; message: string } {
  if (roles.length === 0) {
    return {
      ok: false,
      code: "empty_roles",
      message: "At least one role is required",
    };
  }
  const seen = new Set<PrototypeRole>();
  const out: PrototypeRole[] = [];
  for (const raw of roles) {
    if (typeof raw !== "string" || !isPrototypeRole(raw)) {
      return {
        ok: false,
        code: "invalid_roles",
        message: `Invalid role: ${String(raw)}`,
      };
    }
    if (seen.has(raw)) continue;
    seen.add(raw);
    out.push(raw);
  }
  if (out.length === 0) {
    return {
      ok: false,
      code: "empty_roles",
      message: "At least one role is required",
    };
  }
  return { ok: true, roles: out };
}

function rolesEqual(
  a: readonly PrototypeRole[],
  b: readonly PrototypeRole[],
): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((r) => setB.has(r));
}

/**
 * Validate an Owner role appointment (full replacement set, not a delta).
 * Pass `users` to inject a catalog (tests); default uses effective users.
 */
export function validateRoleChange(
  input: {
    actor_id: string;
    subject_user_id: string;
    roles: readonly string[];
  },
  users: readonly PrototypeUser[] = [],
): RoleChangeValidation {
  const catalog =
    users.length > 0 ? users : listEffectivePrototypeUsers();
  const resolve = (id: string) =>
    users.length > 0
      ? users.find((u) => u.id === id)
      : getEffectivePrototypeUser(id);

  const actor = resolve(input.actor_id);
  if (!actor) {
    return {
      ok: false,
      code: "unknown_actor",
      message: `Unknown actor: ${input.actor_id}`,
    };
  }
  if (!actor.roles.includes("owner")) {
    return {
      ok: false,
      code: "not_owner",
      message:
        "Only the global Owner may appoint or change roles (CONCEPT §9.1)",
    };
  }

  const subject = resolve(input.subject_user_id);
  if (!subject) {
    return {
      ok: false,
      code: "unknown_user",
      message: `Unknown subject user: ${input.subject_user_id}`,
    };
  }

  const normalized = normalizeRoleList(input.roles);
  if (!normalized.ok) {
    return {
      ok: false,
      code: normalized.code,
      message: normalized.message,
    };
  }

  const prior = [...subject.roles];
  const next = normalized.roles;
  if (rolesEqual(prior, next)) {
    return {
      ok: false,
      code: "no_change",
      message: "Roles are unchanged",
    };
  }

  const subjectWasOwner = prior.includes("owner");
  const subjectStaysOwner = next.includes("owner");
  if (subjectWasOwner && !subjectStaysOwner) {
    const ownerCount =
      users.length > 0
        ? catalog.filter((u) => u.roles.includes("owner")).length
        : countEffectiveOwners();
    if (ownerCount <= 1) {
      return {
        ok: false,
        code: "cannot_demote_last_owner",
        message: "Cannot remove the last Owner role from the system",
      };
    }
  }

  return { ok: true, prior_roles: prior, new_roles: next };
}

export function roleChangeAuditPayload(input: {
  prior_roles: readonly PrototypeRole[];
  new_roles: readonly PrototypeRole[];
  rationale?: string | null;
}): {
  prior_roles: PrototypeRole[];
  new_roles: PrototypeRole[];
  rationale: string | null;
  auth_mode: typeof AUTH_MODE;
} {
  return {
    prior_roles: [...input.prior_roles],
    new_roles: [...input.new_roles],
    rationale: input.rationale?.trim() ? input.rationale.trim() : null,
    auth_mode: AUTH_MODE,
  };
}
