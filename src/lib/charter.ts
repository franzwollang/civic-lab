/**
 * CONCEPT §9.3 — Civic Lab Charter as a living Canon artifact with
 * `owner_merge_only`. Site chrome (`/constitution`) resolves here.
 */

export const CHARTER_ARTIFACT_ID = "canon-charter";
export const CHARTER_DOSSIER_ID = "canon-governance-1";
export const CHARTER_SLUG = "charter";

/** Stable product path for the living Charter artifact. */
export function charterArtifactPath(): string {
  return `/dossier/${CHARTER_DOSSIER_ID}/artifact/${CHARTER_ARTIFACT_ID}`;
}

/** Minimum normative premises until full prose lands via Canon RFC. */
export const CHARTER_MINIMUM_PREMISES = [
  "Canon excludes divine authority as an epistemic premise for governance design.",
  "Manuals may treat religion as a political force/institution, not as epistemic authority.",
  "Separation of powers: stewards merge Manuals; editors merge routine Canon; Owner merges restricted Canon (`owner_merge_only` / Critical–Accepted Risk) and may revert.",
  "Scores and reputation are advisory; stewards and Owner retain discretionary permissions.",
] as const;

export type CharterSeedCheck = {
  artifact_id: string;
  dossier_id: string | null | undefined;
  owner_merge_only: boolean;
  title: string;
  content_text: string;
};

/**
 * Validate seeded Charter shape for smokes / continuity checks.
 * Returns missing premise texts (empty = ok).
 */
export function missingCharterPremises(check: CharterSeedCheck): string[] {
  if (check.artifact_id !== CHARTER_ARTIFACT_ID) {
    return [`artifact_id must be ${CHARTER_ARTIFACT_ID}`];
  }
  if (check.dossier_id !== CHARTER_DOSSIER_ID) {
    return [`dossier_id must be ${CHARTER_DOSSIER_ID}`];
  }
  if (!check.owner_merge_only) {
    return ["owner_merge_only must be true"];
  }
  const hay = check.content_text.toLowerCase();
  return CHARTER_MINIMUM_PREMISES.filter(
    (p) => !hay.includes(p.slice(0, 40).toLowerCase()),
  );
}
