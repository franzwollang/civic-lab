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

export type SoftDeleteErrorCode =
  | "unknown_actor"
  | "forbidden"
  | "canon_owner_only"
  | "steward_country_mismatch";

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
 * - Steward: Manual Collections whose country is in their attested codes
 * - Others: never
 */
export function validateSoftDeletePost(
  input: {
    actor_id: string;
    context: SoftDeleteContext;
    /** Attested country codes for the actor (Manual steward gate). */
    actor_country_codes?: readonly string[];
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
  if (!roles.includes("steward")) {
    return {
      ok: false,
      code: "forbidden",
      message:
        "Only Collection stewards (or Owner) may soft-delete Manual posts",
    };
  }
  const country = input.context.country_code?.trim().toUpperCase() ?? null;
  if (!country) {
    return {
      ok: false,
      code: "steward_country_mismatch",
      message: "Manual Collection is missing country_code for steward gate",
    };
  }
  const codes = (input.actor_country_codes ?? []).map((c) =>
    c.trim().toUpperCase(),
  );
  if (!codes.includes(country)) {
    return {
      ok: false,
      code: "steward_country_mismatch",
      message: `Steward country ties do not cover Manual ${country}`,
    };
  }
  return { ok: true };
}

export function actorMayViewAuditLog(
  actorId: string,
  users: readonly PrototypeUser[] = [],
): boolean {
  const roles = rolesOf(actorId, users);
  if (!roles) return false;
  return roles.includes("owner") || roles.includes("steward");
}
