/**
 * Living FAQ as a Canon artifact (`owner_merge_only`).
 * Site chrome (`/faq`) resolves here — same pattern as Charter / About.
 */

export const FAQ_ARTIFACT_ID = "canon-faq";
export const FAQ_DOSSIER_ID = "canon-governance-1";
export const FAQ_SLUG = "faq";

/** Stable product path for the living FAQ artifact. */
export function faqArtifactPath(): string {
  return `/dossier/${FAQ_DOSSIER_ID}/artifact/${FAQ_ARTIFACT_ID}`;
}

/** Key phrases that must appear in seeded FAQ prose (smoke anchors). */
export const FAQ_CONTENT_MARKERS = [
  "Living, revisioned governance specs",
  "Do I need math or CS",
  "Canon",
  "Country Manuals",
  "RFCs",
  "Red Team",
  "Governance and Roles",
] as const;

/** Legacy `/faq#…` section ids that must remain on headings. */
export const FAQ_SECTION_IDS = [
  "do-i-need-math",
  "why-technical",
  "unfamiliar-terms",
  "two-channels",
  "objects",
  "rfcs",
  "red-team",
  "governance-roles",
  "onboarding",
  "participation-ladder",
] as const;

export type FaqSeedCheck = {
  artifact_id: string;
  dossier_id: string | null | undefined;
  owner_merge_only: boolean;
  title: string;
  content_text: string;
};

/**
 * Validate seeded FAQ shape for smokes / continuity checks.
 * Returns missing marker texts (empty = ok).
 */
export function missingFaqMarkers(check: FaqSeedCheck): string[] {
  if (check.artifact_id !== FAQ_ARTIFACT_ID) {
    return [`artifact_id must be ${FAQ_ARTIFACT_ID}`];
  }
  if (check.dossier_id !== FAQ_DOSSIER_ID) {
    return [`dossier_id must be ${FAQ_DOSSIER_ID}`];
  }
  if (!check.owner_merge_only) {
    return ["owner_merge_only must be true"];
  }
  const hay = check.content_text.toLowerCase();
  return FAQ_CONTENT_MARKERS.filter(
    (m) => !hay.includes(m.toLowerCase()),
  );
}
