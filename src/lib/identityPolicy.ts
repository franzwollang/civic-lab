/**
 * CONCEPT §8.6 — Real-identity / stewardship legitimacy policy hooks.
 *
 * Prototype still uses seed-user impersonation as the session source. These
 * hooks record verification + country / long-term-ties attestations so Manual
 * steward powers can be gated without implementing full OAuth yet. A future
 * provider (OIDC / government ID) plugs in via `attestation_kind: provider_stub`
 * → real provider ids without changing eligibility rules.
 */

import {
  getPrototypeUser,
  type PrototypeUser,
} from "../app/lib/prototype-users";

/** Session/auth mode for the prototype (not a full IdP). */
export const AUTH_MODE = "impersonation_with_identity_hooks" as const;

export type VerificationStatus =
  | "unverified"
  | "pending"
  | "verified"
  | "rejected";

export type AttestationKind =
  | "none"
  | "self_asserted"
  | "owner_attested"
  | "provider_stub";

export type IdentityRecord = {
  user_id: string;
  verification_status: VerificationStatus;
  /** ISO country codes the subject is attested for (Manual stewardship). */
  country_codes: string[];
  /** Owner-discretion long-term ties note (CONCEPT §8.6). */
  long_term_ties_note: string | null;
  attestation_kind: AttestationKind;
  verified_by: string | null;
  verified_at: string | null;
  /** Future IdP hook; prototype uses "prototype". */
  provider_stub: string | null;
  updated_at: string;
};

export type StewardEligibility =
  | {
      ok: true;
      reason:
        | "owner_bypass"
        | "verified_country"
        | "verified_long_term_ties"
        | "not_manual_steward_action";
    }
  | {
      ok: false;
      code:
        | "not_steward_role"
        | "identity_unverified"
        | "identity_pending"
        | "identity_rejected"
        | "steward_country_mismatch"
        | "unknown_user";
      message: string;
    };

export type IdentityMutationErrorCode =
  | "not_owner"
  | "unknown_user"
  | "invalid_status"
  | "invalid_input"
  | "cannot_self_verify";

export type IdentityValidation =
  | { ok: true }
  | { ok: false; code: IdentityMutationErrorCode; message: string };

export const VERIFICATION_STATUSES: readonly VerificationStatus[] = [
  "unverified",
  "pending",
  "verified",
  "rejected",
] as const;

export function isVerificationStatus(v: string): v is VerificationStatus {
  return (VERIFICATION_STATUSES as readonly string[]).includes(v);
}

export function normalizeCountryCode(code: string | null | undefined): string | null {
  if (!code) return null;
  const trimmed = code.trim().toUpperCase();
  return trimmed.length > 0 ? trimmed : null;
}

export function defaultIdentityRecord(userId: string, now = new Date()): IdentityRecord {
  return {
    user_id: userId,
    verification_status: "unverified",
    country_codes: [],
    long_term_ties_note: null,
    attestation_kind: "none",
    verified_by: null,
    verified_at: null,
    provider_stub: null,
    updated_at: now.toISOString(),
  };
}

function resolveUser(
  userId: string,
  users: readonly PrototypeUser[],
): PrototypeUser | undefined {
  if (users.length > 0) return users.find((u) => u.id === userId);
  return getPrototypeUser(userId);
}

export function actorIsOwner(
  actorId: string,
  users: readonly PrototypeUser[] = [],
): boolean {
  return Boolean(resolveUser(actorId, users)?.roles.includes("owner"));
}

/**
 * CONCEPT §8.6 — Manual steward eligibility for a country Collection.
 * Owner always bypasses. Non-steward roles are not gated here (mergeAuthority
 * still enforces role). Stewards need verified identity + country match or
 * Owner-attested long-term ties.
 */
export function evaluateStewardEligibility(input: {
  actor_id: string;
  country_code: string | null | undefined;
  identity: IdentityRecord | null | undefined;
  /** When false, skip country gate (Canon / non-Manual). */
  require_manual_country?: boolean;
  users?: readonly PrototypeUser[];
}): StewardEligibility {
  const users = input.users ?? [];
  const user = resolveUser(input.actor_id, users);
  if (!user) {
    return {
      ok: false,
      code: "unknown_user",
      message: `Unknown user: ${input.actor_id}`,
    };
  }

  if (user.roles.includes("owner")) {
    return { ok: true, reason: "owner_bypass" };
  }

  const requireCountry = input.require_manual_country !== false;
  if (!requireCountry) {
    return { ok: true, reason: "not_manual_steward_action" };
  }

  if (!user.roles.includes("steward")) {
    return {
      ok: false,
      code: "not_steward_role",
      message: "Actor is not a Manual steward (or Owner)",
    };
  }

  const identity = input.identity ?? defaultIdentityRecord(input.actor_id);
  if (identity.verification_status === "pending") {
    return {
      ok: false,
      code: "identity_pending",
      message:
        "Identity verification is pending; Manual steward actions require verified real-identity (CONCEPT §8.6)",
    };
  }
  if (identity.verification_status === "rejected") {
    return {
      ok: false,
      code: "identity_rejected",
      message: "Identity verification was rejected",
    };
  }
  if (identity.verification_status !== "verified") {
    return {
      ok: false,
      code: "identity_unverified",
      message:
        "Real-identity verification required for Manual steward actions (CONCEPT §8.6)",
    };
  }

  const country = normalizeCountryCode(input.country_code);
  const attested = identity.country_codes.map((c) => c.toUpperCase());
  if (country && attested.includes(country)) {
    return { ok: true, reason: "verified_country" };
  }

  const ties =
    identity.long_term_ties_note?.trim() &&
    identity.attestation_kind === "owner_attested";
  if (ties) {
    return { ok: true, reason: "verified_long_term_ties" };
  }

  return {
    ok: false,
    code: "steward_country_mismatch",
    message: country
      ? `Steward is verified but not attested for country ${country} (or Owner long-term ties)`
      : "Steward is verified but has no country / long-term-ties attestation",
  };
}

/** Subject may request verification (→ pending); cannot self-verify. */
export function validateIdentityRequest(input: {
  actor_id: string;
  subject_user_id: string;
  users?: readonly PrototypeUser[];
}): IdentityValidation {
  const users = input.users ?? [];
  if (!resolveUser(input.subject_user_id, users)) {
    return {
      ok: false,
      code: "unknown_user",
      message: `Unknown subject user: ${input.subject_user_id}`,
    };
  }
  if (input.actor_id !== input.subject_user_id && !actorIsOwner(input.actor_id, users)) {
    return {
      ok: false,
      code: "not_owner",
      message: "Only the subject or Owner may request identity verification",
    };
  }
  return { ok: true };
}

/** Owner attests / verifies / rejects identity (CONCEPT §8.6 discretion). */
export function validateIdentityAttestation(input: {
  actor_id: string;
  subject_user_id: string;
  verification_status: string;
  users?: readonly PrototypeUser[];
}): IdentityValidation {
  const users = input.users ?? [];
  if (!actorIsOwner(input.actor_id, users)) {
    return {
      ok: false,
      code: "not_owner",
      message: "Only the global Owner may attest real-identity (CONCEPT §8.6)",
    };
  }
  if (!resolveUser(input.subject_user_id, users)) {
    return {
      ok: false,
      code: "unknown_user",
      message: `Unknown subject user: ${input.subject_user_id}`,
    };
  }
  if (!isVerificationStatus(input.verification_status)) {
    return {
      ok: false,
      code: "invalid_status",
      message: `verification_status must be one of ${VERIFICATION_STATUSES.join("|")}`,
    };
  }
  if (
    input.verification_status === "verified" &&
    input.actor_id === input.subject_user_id
  ) {
    // Owner verifying self is allowed (seed Eve); keep hook explicit.
  }
  return { ok: true };
}

export function identityStatusLabel(status: VerificationStatus): string {
  switch (status) {
    case "verified":
      return "Verified";
    case "pending":
      return "Pending verification";
    case "rejected":
      return "Rejected";
    default:
      return "Unverified";
  }
}
