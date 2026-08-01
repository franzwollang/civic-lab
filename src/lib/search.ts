/**
 * M8 first-cut corpus search helpers (CONCEPT discovery).
 * Pure ranking/match utilities — server DB query lives in server/db.ts.
 */

export type SearchHitKind = "dossier" | "artifact" | "thread" | "claim";

export type SearchHit = {
  kind: SearchHitKind;
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
  score: number;
};

export type SearchResponse = {
  query: string;
  hits: SearchHit[];
};

export const SEARCH_DEFAULT_LIMIT = 20;
export const SEARCH_MAX_LIMIT = 50;
export const SEARCH_MIN_QUERY_LEN = 1;

/** Normalize user query: trim + collapse whitespace; empty → "". */
export function normalizeSearchQuery(raw: string | null | undefined): string {
  return (raw ?? "").trim().replace(/\s+/g, " ");
}

export function clampSearchLimit(raw: number | null | undefined): number {
  if (raw == null || !Number.isFinite(raw)) return SEARCH_DEFAULT_LIMIT;
  return Math.max(1, Math.min(SEARCH_MAX_LIMIT, Math.floor(raw)));
}

/**
 * Score a haystack against a normalized query (case-insensitive).
 * Higher is better. Returns 0 when no match.
 */
export function scoreMatch(
  query: string,
  fields: { title?: string | null; body?: string | null; tags?: string[] },
): number {
  const q = query.toLowerCase();
  if (!q) return 0;

  const title = (fields.title ?? "").toLowerCase();
  const body = (fields.body ?? "").toLowerCase();
  const tags = (fields.tags ?? []).map((t) => t.toLowerCase());

  let score = 0;
  if (title === q) score = Math.max(score, 100);
  else if (title.startsWith(q)) score = Math.max(score, 80);
  else if (title.includes(q)) score = Math.max(score, 60);

  for (const tag of tags) {
    if (tag === q) score = Math.max(score, 55);
    else if (tag.includes(q)) score = Math.max(score, 40);
  }

  if (body.includes(q)) score = Math.max(score, 30);

  return score;
}

export function sortHits(hits: SearchHit[]): SearchHit[] {
  return [...hits].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const kindOrder: Record<SearchHitKind, number> = {
      dossier: 0,
      artifact: 1,
      thread: 2,
      claim: 3,
    };
    if (kindOrder[a.kind] !== kindOrder[b.kind]) {
      return kindOrder[a.kind] - kindOrder[b.kind];
    }
    return a.title.localeCompare(b.title);
  });
}

export function dossierHref(dossierId: string): string {
  return `/dossier/${dossierId}`;
}

export function artifactHref(
  dossierId: string | null | undefined,
  artifactId: string,
): string | null {
  if (!dossierId) return null;
  return `/dossier/${dossierId}/artifact/${artifactId}`;
}

export function threadHref(threadId: string, state?: string | null): string {
  if (state === "rfc" || state === "review" || state === "decided") {
    return `/thread/${threadId}/rfc`;
  }
  return `/thread/${threadId}`;
}

/** Claims surface on the owning artifact reader (no dedicated claim route yet). */
export function claimHref(
  dossierId: string | null | undefined,
  artifactId: string,
  claimId: string,
): string | null {
  const base = artifactHref(dossierId, artifactId);
  if (!base) return null;
  return `${base}#claim-${claimId}`;
}
