/**
 * CONCEPT §8 / separation of powers — prototype role affordance labels.
 * Used by the header switcher and gated chrome so powers stay distinct
 * (do not collapse into one admin).
 */
import type { PrototypeRole, PrototypeUser } from "./prototype-users";

/** Stable capability ids for role-gated chrome. */
export type RoleCapability =
  | "discuss"
  | "author_claims"
  | "propose_revsets"
  | "merge_manual"
  | "merge_canon_routine"
  | "merge_canon_restricted"
  | "sign_ar_manual"
  | "sign_ar_canon"
  | "create_findings"
  | "adjudicate_claims"
  | "board_hide"
  | "attest_identity";

const CAPABILITY_LABEL: Record<RoleCapability, string> = {
  discuss: "Discuss / reply",
  author_claims: "Author claims",
  propose_revsets: "Propose RevSets",
  merge_manual: "Merge Manual RFCs",
  merge_canon_routine: "Merge routine Canon RFCs",
  merge_canon_restricted: "Merge restricted Canon / Owner veto",
  sign_ar_manual: "Sign Accepted Risk (Manual)",
  sign_ar_canon: "Sign Accepted Risk (Canon)",
  create_findings: "Create / promote Findings",
  adjudicate_claims: "Adjudicate claims",
  board_hide: "Hide accounts from boards (abuse)",
  attest_identity: "Attest real-identity / country ties",
};

const ROLE_CAPABILITIES: Record<PrototypeRole, readonly RoleCapability[]> = {
  contributor: ["discuss", "author_claims", "propose_revsets"],
  steward: [
    "discuss",
    "author_claims",
    "propose_revsets",
    "merge_manual",
    "sign_ar_manual",
  ],
  editor: [
    "discuss",
    "author_claims",
    "propose_revsets",
    "merge_canon_routine",
  ],
  owner: [
    "discuss",
    "author_claims",
    "propose_revsets",
    "merge_manual",
    "merge_canon_routine",
    "merge_canon_restricted",
    "sign_ar_manual",
    "sign_ar_canon",
    "board_hide",
    "attest_identity",
  ],
  red_team: ["discuss", "author_claims", "propose_revsets", "create_findings"],
  adjudicator: [
    "discuss",
    "author_claims",
    "propose_revsets",
    "adjudicate_claims",
  ],
  observer: ["discuss"],
};

const ROLE_SHORT: Record<PrototypeRole, string> = {
  owner: "Owner",
  editor: "Editor",
  steward: "Steward",
  red_team: "Red Team",
  adjudicator: "Adjudicator",
  contributor: "Contributor",
  observer: "Observer",
};

export function roleShortLabel(role: PrototypeRole): string {
  return ROLE_SHORT[role];
}

export function capabilityLabel(cap: RoleCapability): string {
  return CAPABILITY_LABEL[cap];
}

/** Union of capabilities from all roles on a user (prototype is multi-role). */
export function capabilitiesForRoles(
  roles: readonly PrototypeRole[],
): RoleCapability[] {
  const seen = new Set<RoleCapability>();
  const out: RoleCapability[] = [];
  for (const role of roles) {
    for (const cap of ROLE_CAPABILITIES[role] ?? []) {
      if (seen.has(cap)) continue;
      seen.add(cap);
      out.push(cap);
    }
  }
  return out;
}

export function userHasCapability(
  user: PrototypeUser | undefined,
  capability: RoleCapability,
): boolean {
  if (!user) return false;
  return capabilitiesForRoles(user.roles).includes(capability);
}

export type RoleAffordanceSummary = {
  primary_role: PrototypeRole;
  primary_label: string;
  role_labels: string[];
  capabilities: RoleCapability[];
  capability_labels: string[];
  /** One-line hint for header chrome. */
  headline: string;
};

export function summarizeRoleAffordances(
  user: PrototypeUser,
): RoleAffordanceSummary {
  const primary = user.roles[0] ?? "contributor";
  const capabilities = capabilitiesForRoles(user.roles);
  const capability_labels = capabilities.map(capabilityLabel);
  const role_labels = user.roles.map(roleShortLabel);
  const headline =
    primary === "owner"
      ? "Owner — restricted Canon merge + identity attest + board-hide"
      : primary === "editor"
        ? "Editor — routine Canon merge"
        : primary === "steward"
          ? "Steward — Manual merge (verified identity + country)"
          : primary === "red_team"
            ? "Red Team — Findings (no merge)"
            : primary === "adjudicator"
              ? "Adjudicator — claim outcomes (no merge)"
              : "Contributor — discuss / claims / RevSets";

  return {
    primary_role: primary,
    primary_label: roleShortLabel(primary),
    role_labels,
    capabilities,
    capability_labels,
    headline,
  };
}
