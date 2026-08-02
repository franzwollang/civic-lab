/**
 * Living About page as a Canon artifact (`owner_merge_only`).
 * Site chrome (`/about`) resolves here — same pattern as Charter.
 */

export const ABOUT_ARTIFACT_ID = "canon-about";
export const ABOUT_DOSSIER_ID = "canon-governance-1";
export const ABOUT_SLUG = "about";

/** Stable product path for the living About artifact. */
export function aboutArtifactPath(): string {
  return `/dossier/${ABOUT_DOSSIER_ID}/artifact/${ABOUT_ARTIFACT_ID}`;
}

/** Key phrases that must appear in seeded About prose (smoke anchors). */
export const ABOUT_CONTENT_MARKERS = [
  "governance engineering lab",
  "Two Channels",
  "Canon",
  "Country Manuals",
  "Threads-first",
  "RFC",
  "Red Team",
] as const;

export type AboutSeedCheck = {
  artifact_id: string;
  dossier_id: string | null | undefined;
  owner_merge_only: boolean;
  title: string;
  content_text: string;
};

/**
 * Validate seeded About shape for smokes / continuity checks.
 * Returns missing marker texts (empty = ok).
 */
export function missingAboutMarkers(check: AboutSeedCheck): string[] {
  if (check.artifact_id !== ABOUT_ARTIFACT_ID) {
    return [`artifact_id must be ${ABOUT_ARTIFACT_ID}`];
  }
  if (check.dossier_id !== ABOUT_DOSSIER_ID) {
    return [`dossier_id must be ${ABOUT_DOSSIER_ID}`];
  }
  if (!check.owner_merge_only) {
    return ["owner_merge_only must be true"];
  }
  const hay = check.content_text.toLowerCase();
  return ABOUT_CONTENT_MARKERS.filter(
    (m) => !hay.includes(m.toLowerCase()),
  );
}
