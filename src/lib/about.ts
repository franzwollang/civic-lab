/**
 * Living About page as a Canon artifact (R0 residual).
 * Site chrome `/about` resolves here — Charter-like `owner_merge_only`.
 */

export const ABOUT_ARTIFACT_ID = "canon-about";
export const ABOUT_DOSSIER_ID = "canon-governance-1";
export const ABOUT_SLUG = "about";
export const ABOUT_REVISION_ID = "rev-canon-about-1";

/** Stable product path for the living About artifact. */
export function aboutArtifactPath(): string {
  return `/dossier/${ABOUT_DOSSIER_ID}/artifact/${ABOUT_ARTIFACT_ID}`;
}

/** Section heading block ids (preserve `/about#…` deep links). */
export const ABOUT_SECTION_IDS = [
  "how-to-read",
  "charter",
  "two-channels",
  "workflow",
  "standards",
  "governance",
  "who-this-is-for",
  "get-involved",
  "what-to-expect",
  "ready-to-explore",
] as const;

/** Distinctive prose snippets that must appear in seeded content. */
export const ABOUT_CONTENT_MARKERS = [
  "governance engineering lab",
  "Two Channels",
  "Threads-first Collaboration",
  "Red Team Cases",
  "benevolent dictator",
  "Ready to explore",
] as const;

export type AboutSeedCheck = {
  artifact_id: string;
  dossier_id: string | null | undefined;
  owner_merge_only: boolean;
  slug: string;
  title: string;
  content_text: string;
  section_ids: string[];
};

/**
 * Validate seeded About shape for smokes / continuity checks.
 * Returns human-readable failure strings (empty = ok).
 */
export function missingAboutSeedChecks(check: AboutSeedCheck): string[] {
  const errs: string[] = [];
  if (check.artifact_id !== ABOUT_ARTIFACT_ID) {
    errs.push(`artifact_id must be ${ABOUT_ARTIFACT_ID}`);
  }
  if (check.dossier_id !== ABOUT_DOSSIER_ID) {
    errs.push(`dossier_id must be ${ABOUT_DOSSIER_ID}`);
  }
  if (!check.owner_merge_only) {
    errs.push("owner_merge_only must be true");
  }
  if (check.slug !== ABOUT_SLUG) {
    errs.push(`slug must be ${ABOUT_SLUG}`);
  }
  if (!/about/i.test(check.title)) {
    errs.push("title should mention About");
  }
  const hay = check.content_text.toLowerCase();
  for (const m of ABOUT_CONTENT_MARKERS) {
    if (!hay.includes(m.toLowerCase())) {
      errs.push(`missing marker: ${m}`);
    }
  }
  for (const id of ABOUT_SECTION_IDS) {
    if (!check.section_ids.includes(id)) {
      errs.push(`missing section id: ${id}`);
    }
  }
  return errs;
}
