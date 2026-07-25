/**
 * Prisma-backed data access for the Express API.
 * Domain models are Artifact / ArtifactRevision; SQLite tables remain
 * `pages` / `page_revisions` via Prisma @@map. Wire JSON dual-emits
 * `artifact_id` (preferred) and legacy `page_id` (same value).
 */
import type { PrismaClient } from "@prisma/client";
import {
  extractSectionsFromContent,
  sectionIdFor,
} from "../src/doc/sections";

let prisma: PrismaClient | null = null;

export function setPrisma(client: PrismaClient) {
  prisma = client;
}

export function getPrisma(): PrismaClient {
  if (!prisma) {
    throw new Error("Prisma client not initialized — call bootstrapDatabase first");
  }
  return prisma;
}

export type AreaRow = {
  area_id: string;
  kind: string;
  title: string;
};

export type CollectionRow = {
  collection_id: string;
  area_id: string;
  title: string;
  country_code: string | null;
  summary: string | null;
};

export type DossierRow = {
  dossier_id: string;
  collection_id: string;
  title: string;
  summary: string | null;
  tags: string[];
  /** Present when listed with Prisma `_count`. */
  artifact_count?: number;
  /** Joined from Collection when available. */
  collection_title?: string | null;
  country_code?: string | null;
};

/** Wire shape — dual-emits `artifact_id` + legacy `page_id`. */
export type ArtifactRow = {
  artifact_id: string;
  page_id: string;
  title: string;
  slug: string;
  current_revision_id: string | null;
  created_at: string;
  dossier_id: string | null;
};

/** @deprecated Prefer ArtifactRow */
export type PageRow = ArtifactRow;

export type ArtifactRevisionRow = {
  revision_id: string;
  artifact_id: string;
  page_id: string;
  parent_revision_id: string | null;
  created_at: string;
  author: string;
  content_json: unknown;
};

/** @deprecated Prefer ArtifactRevisionRow */
export type RevisionRow = ArtifactRevisionRow;

export type RegistryPayload = {
  version: number;
  items: unknown[];
};

/** CONCEPT §11 Collection dashboard (shared chrome; data scoped to one Collection). */
export type CollectionDashboardDossier = DossierRow & {
  health: "seeded" | "empty";
  lane_hint: "Descriptive" | "Prescriptive" | "Alignment";
};

export type CollectionDashboard = {
  collection: CollectionRow;
  stats: {
    dossier_count: number;
    artifact_count: number;
    empty_dossier_count: number;
  };
  dossiers: CollectionDashboardDossier[];
  /** Open/rfc/review thread count is live (M5); Critical findings still M7. */
  open_threads: {
    count: number;
    critical_findings: number;
    /** RFC promotion / RevSets still incomplete within M5. */
    deferred: "M5";
  };
  /** Stub until Claim scoring (M6). */
  claims: {
    empirical_quality: null;
    forecast_accuracy: null;
    deferred: "M6";
  };
  /** Manuals only — display-lane tallies until M6 immutable lanes. */
  lane_coverage: null | {
    Descriptive: number;
    Prescriptive: number;
    Alignment: number;
  };
  /** Manuals only — stub until requirement claims (M6). */
  requirement_satisfaction: null | {
    deferred: "M6";
    snapshot: null;
  };
  /** Stub until Findings (M7). */
  red_team: {
    recent_count: number;
    deferred: "M7";
  };
};

/** CONCEPT §2.3 Section wire shape. */
export type SectionRow = {
  section_id: string;
  artifact_id: string;
  stable_key: string;
  title: string;
  level: number;
  order: number;
};

/** CONCEPT §3 Thread wire shapes. */
export type ThreadTargetRow = {
  target_kind: string;
  target_id: string;
};

export type ThreadPostRow = {
  post_id: string;
  thread_id: string;
  author_id: string;
  type: string;
  body: string;
  created_at: string;
};

export type ThreadRow = {
  thread_id: string;
  home_dossier_id: string;
  title: string;
  state: string;
  decision_outcome: string | null;
  is_redteam: boolean;
  parent_thread_id: string | null;
  merge_artifact_id: string | null;
  created_at: string;
  targets?: ThreadTargetRow[];
  posts?: ThreadPostRow[];
  post_count?: number;
  /** Present when detail fetch includes RevSets. */
  revsets?: RevSetRow[];
};

/** CONCEPT §3.3 RevSet — proposed ArtifactRevision on a leaf RFC. */
export type RevSetRow = {
  revset_id: string;
  thread_id: string;
  version: number;
  artifact_revision_id: string;
  artifact_id: string | null;
  author_id: string;
  created_at: string;
  summary: string | null;
};

function mapArea(row: {
  areaId: string;
  kind: string;
  title: string;
}): AreaRow {
  return {
    area_id: row.areaId,
    kind: row.kind,
    title: row.title,
  };
}

function mapCollection(row: {
  collectionId: string;
  areaId: string;
  title: string;
  countryCode: string | null;
  summary: string | null;
}): CollectionRow {
  return {
    collection_id: row.collectionId,
    area_id: row.areaId,
    title: row.title,
    country_code: row.countryCode,
    summary: row.summary,
  };
}

function mapDossier(row: {
  dossierId: string;
  collectionId: string;
  title: string;
  summary: string | null;
  tags: unknown;
  _count?: { artifacts: number };
  collection?: {
    title: string;
    countryCode: string | null;
  } | null;
}): DossierRow {
  const tags = Array.isArray(row.tags)
    ? row.tags.filter((t): t is string => typeof t === "string")
    : [];
  return {
    dossier_id: row.dossierId,
    collection_id: row.collectionId,
    title: row.title,
    summary: row.summary,
    tags,
    artifact_count: row._count?.artifacts,
    collection_title: row.collection?.title ?? null,
    country_code: row.collection?.countryCode ?? null,
  };
}

function mapArtifact(row: {
  artifactId: string;
  title: string;
  slug: string;
  currentRevisionId: string | null;
  createdAt: Date;
  dossierId: string | null;
}): ArtifactRow {
  return {
    artifact_id: row.artifactId,
    page_id: row.artifactId,
    title: row.title,
    slug: row.slug,
    current_revision_id: row.currentRevisionId,
    created_at: row.createdAt.toISOString(),
    dossier_id: row.dossierId,
  };
}

export async function listAreas(): Promise<AreaRow[]> {
  const rows = await getPrisma().area.findMany({
    orderBy: { areaId: "asc" },
  });
  return rows.map(mapArea);
}

export async function getArea(areaId: string): Promise<AreaRow | null> {
  const row = await getPrisma().area.findUnique({ where: { areaId } });
  return row ? mapArea(row) : null;
}

export async function getAreaByKind(kind: string): Promise<AreaRow | null> {
  const row = await getPrisma().area.findFirst({ where: { kind } });
  return row ? mapArea(row) : null;
}

export async function listCollections(areaId?: string): Promise<CollectionRow[]> {
  const rows = await getPrisma().collection.findMany({
    where: areaId ? { areaId } : undefined,
    orderBy: { title: "asc" },
  });
  return rows.map(mapCollection);
}

export async function getCollection(
  collectionId: string,
): Promise<CollectionRow | null> {
  const row = await getPrisma().collection.findUnique({
    where: { collectionId },
  });
  return row ? mapCollection(row) : null;
}

/** Display-only lane hint until M6 immutable Manual lanes exist. */
function laneHintForDossier(d: DossierRow): "Descriptive" | "Prescriptive" | "Alignment" {
  const tags = d.tags.map((t) => t.toLowerCase());
  if (tags.includes("alignment") || /alignment/i.test(d.title)) {
    return "Alignment";
  }
  if (d.country_code || tags.includes("prescriptive")) {
    return "Prescriptive";
  }
  if (tags.includes("descriptive")) {
    return "Descriptive";
  }
  return "Descriptive";
}

/**
 * CONCEPT §11 Collection dashboard payload.
 * Real dossier health + open thread counts; claim/RT panels stubbed until M6–M7.
 */
export async function getCollectionDashboard(
  collectionId: string,
): Promise<CollectionDashboard | null> {
  const collection = await getCollection(collectionId);
  if (!collection) return null;

  const dossiers = await listDossiers(collectionId);
  const withHealth: CollectionDashboardDossier[] = dossiers.map((d) => ({
    ...d,
    health: (d.artifact_count ?? 0) > 0 ? "seeded" : "empty",
    lane_hint: laneHintForDossier(d),
  }));

  const artifact_count = withHealth.reduce(
    (sum, d) => sum + (d.artifact_count ?? 0),
    0,
  );
  const empty_dossier_count = withHealth.filter((d) => d.health === "empty").length;

  const isManual = Boolean(collection.country_code);
  let lane_coverage: CollectionDashboard["lane_coverage"] = null;
  if (isManual) {
    lane_coverage = { Descriptive: 0, Prescriptive: 0, Alignment: 0 };
    for (const d of withHealth) {
      lane_coverage[d.lane_hint] += 1;
    }
  }

  const dossierIds = withHealth.map((d) => d.dossier_id);
  const openThreadCount =
    dossierIds.length === 0
      ? 0
      : await getPrisma().thread.count({
          where: {
            homeDossierId: { in: dossierIds },
            state: { in: ["open", "rfc", "review"] },
          },
        });

  return {
    collection,
    stats: {
      dossier_count: withHealth.length,
      artifact_count,
      empty_dossier_count,
    },
    dossiers: withHealth,
    open_threads: {
      count: openThreadCount,
      critical_findings: 0,
      deferred: "M5",
    },
    claims: {
      empirical_quality: null,
      forecast_accuracy: null,
      deferred: "M6",
    },
    lane_coverage,
    requirement_satisfaction: isManual
      ? { deferred: "M6", snapshot: null }
      : null,
    red_team: {
      recent_count: 0,
      deferred: "M7",
    },
  };
}

export async function listDossiers(
  collectionId?: string,
): Promise<DossierRow[]> {
  const rows = await getPrisma().dossier.findMany({
    where: collectionId ? { collectionId } : undefined,
    orderBy: { title: "asc" },
    include: {
      _count: { select: { artifacts: true } },
      collection: { select: { title: true, countryCode: true } },
    },
  });
  return rows.map(mapDossier);
}

export async function getDossier(dossierId: string): Promise<DossierRow | null> {
  const row = await getPrisma().dossier.findUnique({
    where: { dossierId },
    include: {
      _count: { select: { artifacts: true } },
      collection: { select: { title: true, countryCode: true } },
    },
  });
  return row ? mapDossier(row) : null;
}

export async function listArtifactsByDossier(
  dossierId: string,
): Promise<ArtifactRow[]> {
  const rows = await getPrisma().artifact.findMany({
    where: { dossierId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(mapArtifact);
}

function mapRevision(row: {
  revisionId: string;
  artifactId: string;
  parentRevisionId: string | null;
  createdAt: Date;
  author: string;
  contentJson: unknown;
}): ArtifactRevisionRow {
  return {
    revision_id: row.revisionId,
    artifact_id: row.artifactId,
    page_id: row.artifactId,
    parent_revision_id: row.parentRevisionId,
    created_at: row.createdAt.toISOString(),
    author: row.author,
    content_json: row.contentJson,
  };
}

export async function listArtifacts(): Promise<ArtifactRow[]> {
  const rows = await getPrisma().artifact.findMany({
    orderBy: { createdAt: "asc" },
  });
  return rows.map(mapArtifact);
}

/** @deprecated Prefer listArtifacts */
export const listPages = listArtifacts;

export async function getArtifact(
  artifactId: string,
): Promise<ArtifactRow | null> {
  const row = await getPrisma().artifact.findUnique({
    where: { artifactId },
  });
  return row ? mapArtifact(row) : null;
}

/** @deprecated Prefer getArtifact */
export const getPage = getArtifact;

export async function updateArtifact(
  artifactId: string,
  patch: Partial<{
    title: string;
    slug: string;
    current_revision_id: string | null;
    dossier_id: string | null;
  }>,
): Promise<ArtifactRow | null> {
  const existing = await getPrisma().artifact.findUnique({
    where: { artifactId },
  });
  if (!existing) return null;

  const row = await getPrisma().artifact.update({
    where: { artifactId },
    data: {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.slug !== undefined ? { slug: patch.slug } : {}),
      ...(patch.current_revision_id !== undefined
        ? { currentRevisionId: patch.current_revision_id }
        : {}),
      ...(patch.dossier_id !== undefined
        ? { dossierId: patch.dossier_id }
        : {}),
    },
  });
  return mapArtifact(row);
}

/** @deprecated Prefer updateArtifact */
export const updatePage = updateArtifact;

export async function listArtifactRevisions(
  artifactId: string,
): Promise<ArtifactRevisionRow[]> {
  const rows = await getPrisma().artifactRevision.findMany({
    where: { artifactId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(mapRevision);
}

/** @deprecated Prefer listArtifactRevisions */
export const listRevisions = listArtifactRevisions;

function mapSection(row: {
  sectionId: string;
  artifactId: string;
  stableKey: string;
  title: string;
  level: number;
  order: number;
}): SectionRow {
  return {
    section_id: row.sectionId,
    artifact_id: row.artifactId,
    stable_key: row.stableKey,
    title: row.title,
    level: row.level,
    order: row.order,
  };
}

/**
 * Sync Prisma Section rows from artifact content_json headings.
 * Upserts by (artifact_id, stable_key); deletes removed headings and any
 * ThreadTargets that pointed at those section ids.
 */
export async function syncSectionsForArtifact(
  artifactId: string,
  contentJson: unknown,
): Promise<SectionRow[]> {
  const drafts = extractSectionsFromContent(contentJson);
  const prisma = getPrisma();
  const existing = await prisma.section.findMany({ where: { artifactId } });
  const nextKeys = new Set(drafts.map((d) => d.stable_key));

  const removed = existing.filter((row) => !nextKeys.has(row.stableKey));
  if (removed.length > 0) {
    const removedIds = removed.map((row) => row.sectionId);
    await prisma.threadTarget.deleteMany({
      where: {
        targetKind: "section",
        targetId: { in: removedIds },
      },
    });
    await prisma.section.deleteMany({
      where: { sectionId: { in: removedIds } },
    });
  }

  const synced: SectionRow[] = [];
  for (const draft of drafts) {
    const sectionId = sectionIdFor(artifactId, draft.stable_key);
    const row = await prisma.section.upsert({
      where: { sectionId },
      create: {
        sectionId,
        artifactId,
        stableKey: draft.stable_key,
        title: draft.title,
        level: draft.level,
        order: draft.order,
      },
      update: {
        title: draft.title,
        level: draft.level,
        order: draft.order,
      },
    });
    synced.push(mapSection(row));
  }
  return synced;
}

export async function listSections(artifactId: string): Promise<SectionRow[]> {
  const rows = await getPrisma().section.findMany({
    where: { artifactId },
    orderBy: { order: "asc" },
  });
  return rows.map(mapSection);
}

export async function getSection(
  sectionId: string,
): Promise<SectionRow | null> {
  const row = await getPrisma().section.findUnique({
    where: { sectionId },
  });
  return row ? mapSection(row) : null;
}

export async function createArtifactRevision(payload: {
  revision_id: string;
  /** Preferred; falls back to page_id. */
  artifact_id?: string;
  page_id?: string;
  parent_revision_id?: string | null;
  created_at?: string;
  author: string;
  content_json: unknown;
}): Promise<ArtifactRevisionRow> {
  const artifactId = payload.artifact_id || payload.page_id;
  if (!artifactId) {
    throw new Error("createArtifactRevision requires artifact_id or page_id");
  }
  const row = await getPrisma().artifactRevision.create({
    data: {
      revisionId: payload.revision_id,
      artifactId,
      parentRevisionId: payload.parent_revision_id ?? null,
      createdAt: payload.created_at
        ? new Date(payload.created_at)
        : new Date(),
      author: payload.author,
      contentJson: payload.content_json as object,
    },
  });
  // Keep Section rows aligned with the newly saved document structure.
  await syncSectionsForArtifact(artifactId, payload.content_json);
  return mapRevision(row);
}

/** @deprecated Prefer createArtifactRevision */
export const createRevision = createArtifactRevision;

export async function getAttributions(): Promise<RegistryPayload> {
  const row = await getPrisma().attributionsRegistry.findUnique({
    where: { id: 1 },
  });
  if (!row) {
    return { version: 0, items: [] };
  }
  return {
    version: row.version,
    items: row.items as unknown[],
  };
}

export async function putAttributions(
  next: RegistryPayload,
): Promise<RegistryPayload> {
  const row = await getPrisma().attributionsRegistry.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      version: next.version,
      items: next.items as object,
    },
    update: {
      version: next.version,
      items: next.items as object,
    },
  });
  return {
    version: row.version,
    items: row.items as unknown[],
  };
}

export async function getTerms(): Promise<RegistryPayload> {
  const row = await getPrisma().termsRegistry.findUnique({ where: { id: 1 } });
  if (!row) {
    return { version: 0, items: [] };
  }
  return {
    version: row.version,
    items: row.items as unknown[],
  };
}

export async function putTerms(next: RegistryPayload): Promise<RegistryPayload> {
  const row = await getPrisma().termsRegistry.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      version: next.version,
      items: next.items as object,
    },
    update: {
      version: next.version,
      items: next.items as object,
    },
  });
  return {
    version: row.version,
    items: row.items as unknown[],
  };
}

function mapThreadTarget(row: {
  targetKind: string;
  targetId: string;
}): ThreadTargetRow {
  return {
    target_kind: row.targetKind,
    target_id: row.targetId,
  };
}

function mapThreadPost(row: {
  postId: string;
  threadId: string;
  authorId: string;
  type: string;
  body: string;
  createdAt: Date;
}): ThreadPostRow {
  return {
    post_id: row.postId,
    thread_id: row.threadId,
    author_id: row.authorId,
    type: row.type,
    body: row.body,
    created_at: row.createdAt.toISOString(),
  };
}

function mapThread(row: {
  threadId: string;
  homeDossierId: string;
  title: string;
  state: string;
  decisionOutcome: string | null;
  isRedteam: boolean;
  parentThreadId: string | null;
  mergeArtifactId: string | null;
  createdAt: Date;
  targets?: { targetKind: string; targetId: string }[];
  posts?: {
    postId: string;
    threadId: string;
    authorId: string;
    type: string;
    body: string;
    createdAt: Date;
  }[];
  _count?: { posts: number };
}): ThreadRow {
  return {
    thread_id: row.threadId,
    home_dossier_id: row.homeDossierId,
    title: row.title,
    state: row.state,
    decision_outcome: row.decisionOutcome,
    is_redteam: row.isRedteam,
    parent_thread_id: row.parentThreadId,
    merge_artifact_id: row.mergeArtifactId,
    created_at: row.createdAt.toISOString(),
    targets: row.targets?.map(mapThreadTarget),
    posts: row.posts?.map(mapThreadPost),
    post_count: row._count?.posts,
  };
}

export async function listThreads(opts?: {
  homeDossierId?: string;
  state?: string;
}): Promise<ThreadRow[]> {
  const rows = await getPrisma().thread.findMany({
    where: {
      homeDossierId: opts?.homeDossierId,
      state: opts?.state,
    },
    orderBy: { createdAt: "desc" },
    include: {
      targets: true,
      _count: { select: { posts: true } },
    },
  });
  return rows.map(mapThread);
}

export async function getThread(threadId: string): Promise<ThreadRow | null> {
  const row = await getPrisma().thread.findUnique({
    where: { threadId },
    include: {
      targets: true,
      posts: { orderBy: { createdAt: "asc" } },
      revSets: { orderBy: { version: "asc" } },
      _count: { select: { posts: true } },
    },
  });
  if (!row) return null;
  const mapped = mapThread(row);
  const revArtifactIds = await resolveRevSetArtifactIds(
    row.revSets.map((r) => r.artifactRevisionId),
  );
  mapped.revsets = row.revSets.map((r) =>
    mapRevSet(r, revArtifactIds.get(r.artifactRevisionId) ?? null),
  );
  return mapped;
}

function mapRevSet(
  row: {
    revsetId: string;
    threadId: string;
    version: number;
    artifactRevisionId: string;
    authorId: string;
    createdAt: Date;
    summary: string | null;
  },
  artifactId: string | null,
): RevSetRow {
  return {
    revset_id: row.revsetId,
    thread_id: row.threadId,
    version: row.version,
    artifact_revision_id: row.artifactRevisionId,
    artifact_id: artifactId,
    author_id: row.authorId,
    created_at: row.createdAt.toISOString(),
    summary: row.summary,
  };
}

async function resolveRevSetArtifactIds(
  revisionIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (revisionIds.length === 0) return map;
  const revs = await getPrisma().artifactRevision.findMany({
    where: { revisionId: { in: revisionIds } },
    select: { revisionId: true, artifactId: true },
  });
  for (const r of revs) map.set(r.revisionId, r.artifactId);
  return map;
}

export async function listRevSets(threadId: string): Promise<RevSetRow[] | null> {
  const thread = await getPrisma().thread.findUnique({
    where: { threadId },
    select: { threadId: true },
  });
  if (!thread) return null;
  const rows = await getPrisma().revSet.findMany({
    where: { threadId },
    orderBy: { version: "asc" },
  });
  const artifactIds = await resolveRevSetArtifactIds(
    rows.map((r) => r.artifactRevisionId),
  );
  return rows.map((r) =>
    mapRevSet(r, artifactIds.get(r.artifactRevisionId) ?? null),
  );
}

export type PromoteThreadError =
  | { code: "not_found" }
  | { code: "not_open"; state: string }
  | { code: "wrapper_required"; artifact_ids: string[] }
  | { code: "no_artifact_target" }
  | { code: "artifact_missing"; artifact_id: string }
  | { code: "merge_mismatch"; merge_artifact_id: string; artifact_ids: string[] };

/**
 * Promote an open discussion thread to a leaf RFC (1:1 merge artifact).
 * Multi-artifact targets require wrapper + sub-RFCs (not implemented this cut).
 */
export async function promoteThreadToRfc(input: {
  thread_id: string;
  merge_artifact_id?: string;
  author_id?: string;
}): Promise<{ ok: true; thread: ThreadRow } | { ok: false; error: PromoteThreadError }> {
  const prisma = getPrisma();
  const row = await prisma.thread.findUnique({
    where: { threadId: input.thread_id },
    include: { targets: true },
  });
  if (!row) return { ok: false, error: { code: "not_found" } };
  if (row.state !== "open") {
    return { ok: false, error: { code: "not_open", state: row.state } };
  }

  const artifactTargets = row.targets
    .filter((t) => t.targetKind === "artifact")
    .map((t) => t.targetId);
  const uniqueArtifacts = [...new Set(artifactTargets)];

  if (uniqueArtifacts.length === 0 && !input.merge_artifact_id) {
    return { ok: false, error: { code: "no_artifact_target" } };
  }
  if (uniqueArtifacts.length > 1 && !input.merge_artifact_id) {
    return {
      ok: false,
      error: { code: "wrapper_required", artifact_ids: uniqueArtifacts },
    };
  }

  const mergeId = input.merge_artifact_id ?? uniqueArtifacts[0]!;
  if (uniqueArtifacts.length > 1 && !uniqueArtifacts.includes(mergeId)) {
    return {
      ok: false,
      error: {
        code: "merge_mismatch",
        merge_artifact_id: mergeId,
        artifact_ids: uniqueArtifacts,
      },
    };
  }
  // Even with explicit merge_artifact_id, multi-artifact still needs wrapper.
  if (uniqueArtifacts.length > 1) {
    return {
      ok: false,
      error: { code: "wrapper_required", artifact_ids: uniqueArtifacts },
    };
  }

  const artifact = await prisma.artifact.findUnique({
    where: { artifactId: mergeId },
  });
  if (!artifact) {
    return { ok: false, error: { code: "artifact_missing", artifact_id: mergeId } };
  }

  await prisma.$transaction(async (tx) => {
    await tx.thread.update({
      where: { threadId: input.thread_id },
      data: {
        state: "rfc",
        mergeArtifactId: mergeId,
      },
    });
    // Ensure artifact target exists for the merge leaf.
    const hasTarget = row.targets.some(
      (t) => t.targetKind === "artifact" && t.targetId === mergeId,
    );
    if (!hasTarget) {
      await tx.threadTarget.create({
        data: {
          threadId: input.thread_id,
          targetKind: "artifact",
          targetId: mergeId,
        },
      });
    }
    await tx.threadPost.create({
      data: {
        postId: crypto.randomUUID(),
        threadId: input.thread_id,
        authorId: input.author_id ?? "system",
        type: "comment",
        body: `Promoted to leaf RFC (merge → ${mergeId}). RevSets may now propose ArtifactRevisions.`,
        createdAt: new Date(),
      },
    });
  });

  const thread = await getThread(input.thread_id);
  if (!thread) return { ok: false, error: { code: "not_found" } };
  return { ok: true, thread };
}

export type CreateRevSetError =
  | { code: "not_found" }
  | { code: "not_leaf_rfc"; state: string; merge_artifact_id: string | null }
  | { code: "artifact_missing"; artifact_id: string }
  | { code: "content_required" };

/**
 * Attach a RevSet to a leaf RFC. Creates a proposed ArtifactRevision
 * (does not change current_revision_id / Section sync until merge).
 */
export async function createRevSet(input: {
  thread_id: string;
  author_id: string;
  summary?: string | null;
  content_json?: unknown;
  /** Optional existing revision; otherwise a new proposal revision is created. */
  artifact_revision_id?: string;
  revset_id?: string;
}): Promise<{ ok: true; revset: RevSetRow } | { ok: false; error: CreateRevSetError }> {
  const prisma = getPrisma();
  const thread = await prisma.thread.findUnique({
    where: { threadId: input.thread_id },
  });
  if (!thread) return { ok: false, error: { code: "not_found" } };
  if (thread.state !== "rfc" || !thread.mergeArtifactId) {
    return {
      ok: false,
      error: {
        code: "not_leaf_rfc",
        state: thread.state,
        merge_artifact_id: thread.mergeArtifactId,
      },
    };
  }

  const mergeArtifactId = thread.mergeArtifactId;
  const artifact = await prisma.artifact.findUnique({
    where: { artifactId: mergeArtifactId },
  });
  if (!artifact) {
    return {
      ok: false,
      error: { code: "artifact_missing", artifact_id: mergeArtifactId },
    };
  }

  let revisionId = input.artifact_revision_id;
  if (revisionId) {
    const existing = await prisma.artifactRevision.findUnique({
      where: { revisionId },
    });
    if (!existing || existing.artifactId !== mergeArtifactId) {
      return {
        ok: false,
        error: { code: "artifact_missing", artifact_id: mergeArtifactId },
      };
    }
  } else {
    if (input.content_json === undefined) {
      return { ok: false, error: { code: "content_required" } };
    }
    revisionId = crypto.randomUUID();
    await prisma.artifactRevision.create({
      data: {
        revisionId,
        artifactId: mergeArtifactId,
        parentRevisionId: artifact.currentRevisionId,
        createdAt: new Date(),
        author: input.author_id,
        contentJson: input.content_json as object,
      },
    });
    // Intentionally skip Section sync — proposal is not current until merge.
  }

  const maxVersion = await prisma.revSet.aggregate({
    where: { threadId: input.thread_id },
    _max: { version: true },
  });
  const version = (maxVersion._max.version ?? 0) + 1;

  const row = await prisma.revSet.create({
    data: {
      revsetId: input.revset_id ?? crypto.randomUUID(),
      threadId: input.thread_id,
      version,
      artifactRevisionId: revisionId!,
      authorId: input.author_id,
      createdAt: new Date(),
      summary: input.summary ?? null,
    },
  });

  return { ok: true, revset: mapRevSet(row, mergeArtifactId) };
}

export async function createThreadPost(input: {
  post_id?: string;
  thread_id: string;
  author_id: string;
  type?: string;
  body: string;
  created_at?: string;
}): Promise<ThreadPostRow | null> {
  const thread = await getPrisma().thread.findUnique({
    where: { threadId: input.thread_id },
  });
  if (!thread) return null;

  const row = await getPrisma().threadPost.create({
    data: {
      postId: input.post_id ?? crypto.randomUUID(),
      threadId: input.thread_id,
      authorId: input.author_id,
      type: input.type ?? "comment",
      body: input.body,
      createdAt: input.created_at ? new Date(input.created_at) : new Date(),
    },
  });
  return mapThreadPost(row);
}
