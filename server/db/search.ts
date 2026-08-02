import {
  artifactHref,
  claimHref,
  clampSearchLimit,
  dossierHref,
  normalizeSearchQuery,
  scoreMatch,
  sortHits,
  threadHref,
  type SearchHit,
  type SearchResponse,
} from "../../src/lib/search";
import { getPrisma } from "./prisma";

/**
 * M8 first-cut corpus search over dossiers / artifacts / threads / claims.
 * Case-insensitive substring match; ranked by scoreMatch helpers.
 */
export async function searchCorpus(
  rawQuery: string,
  rawLimit?: number,
): Promise<SearchResponse> {
  const query = normalizeSearchQuery(rawQuery);
  const limit = clampSearchLimit(rawLimit);
  if (!query) {
    return { query: "", hits: [] };
  }

  const prisma = getPrisma();
  const [dossiers, artifacts, threads, claims] = await Promise.all([
    prisma.dossier.findMany({
      include: {
        collection: { select: { title: true, countryCode: true } },
      },
    }),
    prisma.artifact.findMany({
      select: {
        artifactId: true,
        title: true,
        slug: true,
        dossierId: true,
        lane: true,
      },
    }),
    prisma.thread.findMany({
      select: {
        threadId: true,
        title: true,
        state: true,
        homeDossierId: true,
      },
    }),
    prisma.claim.findMany({
      select: {
        claimId: true,
        text: true,
        profile: true,
        status: true,
        artifactId: true,
        artifact: { select: { dossierId: true, title: true } },
      },
    }),
  ]);

  const hits: SearchHit[] = [];

  for (const d of dossiers) {
    const tags = Array.isArray(d.tags)
      ? d.tags.filter((t): t is string => typeof t === "string")
      : [];
    const score = scoreMatch(query, {
      title: d.title,
      body: d.summary,
      tags,
    });
    if (score <= 0) continue;
    const collectionLabel = d.collection.countryCode
      ? `${d.collection.title} (${d.collection.countryCode})`
      : d.collection.title;
    hits.push({
      kind: "dossier",
      id: d.dossierId,
      title: d.title,
      subtitle: collectionLabel,
      href: dossierHref(d.dossierId),
      score,
    });
  }

  for (const a of artifacts) {
    const score = scoreMatch(query, {
      title: a.title,
      body: a.slug,
      tags: a.lane ? [a.lane] : [],
    });
    if (score <= 0) continue;
    const href = artifactHref(a.dossierId, a.artifactId);
    if (!href) continue;
    hits.push({
      kind: "artifact",
      id: a.artifactId,
      title: a.title,
      subtitle: a.lane ? `Lane: ${a.lane}` : null,
      href,
      score,
    });
  }

  for (const t of threads) {
    const score = scoreMatch(query, { title: t.title, body: t.state });
    if (score <= 0) continue;
    hits.push({
      kind: "thread",
      id: t.threadId,
      title: t.title,
      subtitle: `State: ${t.state}`,
      href: threadHref(t.threadId, t.state),
      score,
    });
  }

  for (const c of claims) {
    const score = scoreMatch(query, {
      title: c.text,
      body: `${c.profile} ${c.status}`,
      tags: [c.profile, c.status],
    });
    if (score <= 0) continue;
    const href = claimHref(c.artifact.dossierId, c.artifactId, c.claimId);
    if (!href) continue;
    const snippet =
      c.text.length > 96 ? `${c.text.slice(0, 93)}…` : c.text;
    hits.push({
      kind: "claim",
      id: c.claimId,
      title: snippet,
      subtitle: `${c.profile} · ${c.status} · ${c.artifact.title}`,
      href,
      score,
    });
  }

  return {
    query,
    hits: sortHits(hits).slice(0, limit),
  };
}
