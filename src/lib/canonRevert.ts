/**
 * CONCEPT §9.3 / §9.4 — Owner may revert any Canon merge (audit-logged).
 *
 * Revert restores `Artifact.current_revision_id` to a prior revision in the
 * same artifact's lineage. Manual Collections are out of scope (stewards merge
 * Manuals; Owner revert is Canon-only).
 */

import {
  getPrototypeUser,
  type PrototypeUser,
} from "../app/lib/prototype-users";

export type CanonRevertErrorCode =
  | "unknown_actor"
  | "not_owner"
  | "not_canon"
  | "not_found"
  | "no_current_revision"
  | "nothing_to_revert"
  | "target_missing"
  | "target_wrong_artifact"
  | "already_current";

export type CanonRevertValidation =
  | { ok: true }
  | { ok: false; code: CanonRevertErrorCode; message: string };

export type CanonRevertContext = {
  area_kind: "canon" | "manuals" | string | null | undefined;
};

/**
 * Gate who may request a Canon revert and whether the artifact is in Canon.
 * Existence / lineage checks stay in the server mutate path.
 */
export function validateCanonRevert(
  input: {
    actor_id: string;
    context: CanonRevertContext;
  },
  users: readonly PrototypeUser[] = [],
): CanonRevertValidation {
  const user =
    users.length > 0
      ? users.find((u) => u.id === input.actor_id)
      : getPrototypeUser(input.actor_id);
  if (!user) {
    return {
      ok: false,
      code: "unknown_actor",
      message: `Unknown actor: ${input.actor_id}`,
    };
  }
  if (!user.roles.includes("owner")) {
    return {
      ok: false,
      code: "not_owner",
      message:
        "Only the global Owner may revert Canon revisions (CONCEPT §9.3)",
    };
  }
  if (input.context.area_kind !== "canon") {
    return {
      ok: false,
      code: "not_canon",
      message:
        "Owner revert applies only to Canon artifacts (Manuals use steward merge authority)",
    };
  }
  return { ok: true };
}
