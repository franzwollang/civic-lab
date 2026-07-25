/**
 * CONCEPT §7.6 / §3.4 — Accepted Risk signer rules for leaf RFC merge gates.
 *
 * AcceptedRisk attaches only to merging (leaf) RFCs. Signer follows the
 * merge-authority table: Manual → steward (+ Owner); Canon → Owner whenever
 * Accepted Risk is required (Critical / restricted path).
 */

import {
  getPrototypeUser,
  type PrototypeUser,
} from "../app/lib/prototype-users";
import type { AreaKind, MergeAuthorityClass } from "./mergeAuthority";

export type AcceptedRiskSignerClass = "manual_steward" | "canon_owner";

/** Who may sign Accepted Risk for a leaf (CONCEPT §3.4 signer column). */
export function acceptedRiskSignerClass(
  areaKind: AreaKind,
): AcceptedRiskSignerClass {
  return areaKind === "manuals" ? "manual_steward" : "canon_owner";
}

export function actorMaySignAcceptedRisk(
  authorId: string,
  areaKind: AreaKind,
  users: readonly PrototypeUser[] = [],
): boolean {
  const catalog = users.length > 0 ? users : null;
  const user = catalog
    ? catalog.find((u) => u.id === authorId)
    : getPrototypeUser(authorId);
  if (!user) return false;
  if (areaKind === "manuals") {
    return user.roles.includes("steward") || user.roles.includes("owner");
  }
  return user.roles.includes("owner");
}

/**
 * Canon RFCs on a Critical / Accepted Risk path become Owner-only for merge
 * (CONCEPT §3.4). Manuals stay steward-scoped.
 */
export function effectiveAuthorityClassForLeaf(input: {
  base_class: MergeAuthorityClass;
  area_kind: AreaKind;
  critical_or_accepted_risk_path: boolean;
}): MergeAuthorityClass {
  if (input.area_kind === "manuals") return input.base_class;
  if (input.critical_or_accepted_risk_path) return "canon_owner_only";
  return input.base_class;
}
