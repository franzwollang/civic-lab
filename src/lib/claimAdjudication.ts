/**
 * CONCEPT §5.2–5.3 + §8.3 — Claim status sets and global adjudication.
 *
 * Empirical statuses: open | resolved_true | resolved_false | ambiguous |
 *   invalidated | source_conflict
 * Requirement statuses: open | accepted | satisfied | failed | superseded |
 *   invalidated | disputed
 *
 * Only global adjudicators set resolution outcomes (+ rationale).
 * Stewards / editors do not override adjudicated outcomes.
 */

import {
  PROTOTYPE_USERS,
  getPrototypeUser,
  type PrototypeUser,
} from "../app/lib/prototype-users";
import type { ClaimProfile } from "./claimLegality";

export const EMPIRICAL_STATUSES = [
  "open",
  "resolved_true",
  "resolved_false",
  "ambiguous",
  "invalidated",
  "source_conflict",
] as const;

export const REQUIREMENT_STATUSES = [
  "open",
  "accepted",
  "satisfied",
  "failed",
  "superseded",
  "invalidated",
  "disputed",
] as const;

/** Outcomes an adjudicator may set (excludes initial `open`). */
export const EMPIRICAL_ADJUDICATION_OUTCOMES = [
  "resolved_true",
  "resolved_false",
  "ambiguous",
  "invalidated",
  "source_conflict",
] as const;

export const REQUIREMENT_ADJUDICATION_OUTCOMES = [
  "accepted",
  "satisfied",
  "failed",
  "superseded",
  "invalidated",
  "disputed",
] as const;

export type EmpiricalStatus = (typeof EMPIRICAL_STATUSES)[number];
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];
export type EmpiricalAdjudicationOutcome =
  (typeof EMPIRICAL_ADJUDICATION_OUTCOMES)[number];
export type RequirementAdjudicationOutcome =
  (typeof REQUIREMENT_ADJUDICATION_OUTCOMES)[number];
export type ClaimStatus = EmpiricalStatus | RequirementStatus;

export type AdjudicationErrorCode =
  | "not_adjudicator"
  | "illegal_status"
  | "rationale_required"
  | "already_queued"
  | "not_queued"
  | "unknown_actor"
  | "unknown_profile";

export type AdjudicationError = {
  code: AdjudicationErrorCode;
  message: string;
};

export function statusesForProfile(
  profile: ClaimProfile | string,
): readonly string[] {
  if (profile === "empirical") return EMPIRICAL_STATUSES;
  if (profile === "requirement") return REQUIREMENT_STATUSES;
  return [];
}

export function adjudicationOutcomesForProfile(
  profile: ClaimProfile | string,
): readonly string[] {
  if (profile === "empirical") return EMPIRICAL_ADJUDICATION_OUTCOMES;
  if (profile === "requirement") return REQUIREMENT_ADJUDICATION_OUTCOMES;
  return [];
}

export function isStatusLegalForProfile(
  profile: ClaimProfile | string,
  status: string,
): boolean {
  return statusesForProfile(profile).includes(status);
}

export function isAdjudicationOutcomeLegal(
  profile: ClaimProfile | string,
  status: string,
): boolean {
  return adjudicationOutcomesForProfile(profile).includes(status);
}

export function userIsAdjudicator(
  user: PrototypeUser | undefined,
): boolean {
  return Boolean(user?.roles.includes("adjudicator"));
}

export function actorIsAdjudicator(authorId: string | undefined): boolean {
  if (!authorId) return false;
  return userIsAdjudicator(getPrototypeUser(authorId));
}

/** Prototype users with the global adjudicator role. */
export function adjudicatorUserIds(): string[] {
  return PROTOTYPE_USERS.filter((u) => userIsAdjudicator(u)).map((u) => u.id);
}

/**
 * Pending queue membership: requested, and either never adjudicated or
 * re-requested after the last adjudication (appeals scaffolding).
 */
export function isAdjudicationPending(claim: {
  adjudication_requested_at: string | null;
  adjudicated_at: string | null;
}): boolean {
  if (!claim.adjudication_requested_at) return false;
  if (!claim.adjudicated_at) return true;
  return (
    Date.parse(claim.adjudication_requested_at) >
    Date.parse(claim.adjudicated_at)
  );
}

export function validateRequestAdjudication(input: {
  author_id: string;
  note?: string | null;
  claim: {
    adjudication_requested_at: string | null;
    adjudicated_at: string | null;
  };
}): { ok: true } | { ok: false; error: AdjudicationError } {
  if (!getPrototypeUser(input.author_id)) {
    return {
      ok: false,
      error: {
        code: "unknown_actor",
        message: `Unknown prototype user: ${input.author_id}`,
      },
    };
  }
  if (isAdjudicationPending(input.claim)) {
    return {
      ok: false,
      error: {
        code: "already_queued",
        message: "Claim already has a pending adjudication request",
      },
    };
  }
  return { ok: true };
}

export function validateAdjudicate(input: {
  author_id: string;
  status: string;
  rationale: string;
  profile: ClaimProfile | string;
  requireQueued?: boolean;
  claim?: {
    adjudication_requested_at: string | null;
    adjudicated_at: string | null;
  };
}): { ok: true } | { ok: false; error: AdjudicationError } {
  if (!getPrototypeUser(input.author_id)) {
    return {
      ok: false,
      error: {
        code: "unknown_actor",
        message: `Unknown prototype user: ${input.author_id}`,
      },
    };
  }
  if (!actorIsAdjudicator(input.author_id)) {
    return {
      ok: false,
      error: {
        code: "not_adjudicator",
        message:
          "Only global adjudicators may set claim resolution outcomes (CONCEPT §8.3)",
      },
    };
  }
  if (
    input.profile !== "empirical" &&
    input.profile !== "requirement"
  ) {
    return {
      ok: false,
      error: {
        code: "unknown_profile",
        message: `Unknown claim profile: ${input.profile}`,
      },
    };
  }
  if (!isAdjudicationOutcomeLegal(input.profile, input.status)) {
    return {
      ok: false,
      error: {
        code: "illegal_status",
        message: `Status "${input.status}" is not a legal ${input.profile} adjudication outcome (allowed: ${adjudicationOutcomesForProfile(input.profile).join(", ")})`,
      },
    };
  }
  const rationale = input.rationale?.trim() ?? "";
  if (!rationale) {
    return {
      ok: false,
      error: {
        code: "rationale_required",
        message: "Adjudication requires a non-empty rationale",
      },
    };
  }
  if (
    input.requireQueued &&
    input.claim &&
    !isAdjudicationPending(input.claim)
  ) {
    return {
      ok: false,
      error: {
        code: "not_queued",
        message:
          "Claim is not on the adjudication queue (request adjudication first)",
      },
    };
  }
  return { ok: true };
}
