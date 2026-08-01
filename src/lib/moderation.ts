/**
 * CONCEPT §9.4 — moderation defaults (soft-delete posts; steward local, Owner global).
 *
 * Soft-delete only for ordinary ThreadPosts. Findings, Claims, AcceptedRisk, and
 * merged RevSets must never be silently hard-deleted.
 */

import {
  getPrototypeUser,
  type PrototypeRole,
  type PrototypeUser,
} from "../app/lib/prototype-users";
import {
  evaluateStewardEligibility,
  type IdentityRecord,
} from "./identityPolicy";

export type SoftDeleteErrorCode =
  | "unknown_actor"
  | "forbidden"
  | "canon_owner_only"
  | "steward_country_mismatch"
  | "identity_unverified"
  | "identity_pending"
  | "identity_rejected";

export type SoftDeleteValidation =
  | { ok: true }
  | { ok: false; code: SoftDeleteErrorCode; message: string };

export type SoftDeleteContext = {
  area_kind: "canon" | "manuals";
  /** ISO country code for Manual Collections; null on Canon. */
  country_code: string | null;
};

function rolesOf(
  actorId: string,
  users: readonly PrototypeUser[],
): PrototypeRole[] | null {
  const user =
    users.length > 0
      ? users.find((u) => u.id === actorId)
      : getPrototypeUser(actorId);
  return user ? [...user.roles] : null;
}

/**
 * Who may soft-delete an ordinary post on a thread in this Collection.
 * - Owner: anywhere (Canon + all Manuals)
 * - Steward: Manual Collections via CONCEPT §8.6 evaluateStewardEligibility
 *   (verified identity + country match or Owner-attested long-term ties)
 * - Others: never
 */
export function validateSoftDeletePost(
  input: {
    actor_id: string;
    context: SoftDeleteContext;
    /** Identity attestation for Manual steward §8.6 gate (same as decide/AR). */
    identity?: IdentityRecord | null;
  },
  users: readonly PrototypeUser[] = [],
): SoftDeleteValidation {
  const roles = rolesOf(input.actor_id, users);
  if (!roles) {
    return {
      ok: false,
      code: "unknown_actor",
      message: `Unknown actor: ${input.actor_id}`,
    };
  }
  if (roles.includes("owner")) {
    return { ok: true };
  }
  if (input.context.area_kind === "canon") {
    return {
      ok: false,
      code: "canon_owner_only",
      message:
        "Only the global Owner may moderate posts in Canon (CONCEPT §9.4)",
    };
  }

  const eligibility = evaluateStewardEligibility({
    actor_id: input.actor_id,
    country_code: input.context.country_code,
    identity: input.identity,
    require_manual_country: true,
    users,
  });
  if (eligibility.ok) {
    return { ok: true };
  }

  if (eligibility.code === "not_steward_role") {
    return {
      ok: false,
      code: "forbidden",
      message:
        "Only Collection stewards (or Owner) may soft-delete Manual posts",
    };
  }
  if (eligibility.code === "unknown_user") {
    return {
      ok: false,
      code: "unknown_actor",
      message: eligibility.message,
    };
  }
  return {
    ok: false,
    code: eligibility.code,
    message: eligibility.message,
  };
}

export function actorMayViewAuditLog(
  actorId: string,
  users: readonly PrototypeUser[] = [],
): boolean {
  const roles = rolesOf(actorId, users);
  if (!roles) return false;
  return roles.includes("owner") || roles.includes("steward");
}
