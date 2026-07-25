/**
 * Prisma-backed data access for the Hono API.
 * Domain models are Artifact / ArtifactRevision; SQLite tables remain
 * `pages` / `page_revisions` via Prisma @@map. Wire JSON dual-emits
 * `artifact_id` (preferred) and legacy `page_id` (same value).
 */
import type { PrismaClient } from "@prisma/client";
import {
  extractSectionsFromContent,
  sectionIdFor,
} from "../src/doc/sections";
import {
  actorMayDecide,
  buildMergeAuthoritySummary,
  classifyMergeAuthority,
  requiredRolesForClass,
  type AreaKind,
  type MergeAuthorityClass,
  type MergeAuthorityContext,
} from "../src/lib/mergeAuthority";
import {
  validateClaimAgainstOwner,
  type ClaimDraftInput,
  type ClaimLegalityError,
  type ClaimOwnerContext,
} from "../src/lib/claimLegality";
import {
  isAdjudicationPending,
  validateAdjudicate,
  validateRequestAdjudication,
  type AdjudicationError,
} from "../src/lib/claimAdjudication";
import {
  artifactIdsFromClaimLinks,
  computeSoftLaneLabel,
  validateLaneOnCreate,
  validateLaneOnPatch,
  type LaneRuleError,
  type SoftLaneLabel,
} from "../src/lib/artifactLanes";
import {
  computeEmpiricalQuality,
  computeForecastAccuracy,
  computeRequirementSatisfactionSnapshot,
} from "../src/lib/claimMetrics";
import {
  actorMayCreateFinding,
  isFindingSeverity,
  isFindingStatus,
  isFindingTargetKind,
  isOpenCriticalFinding,
} from "../src/lib/findings";
import type { PrototypeRole } from "../src/app/lib/prototype-users";
import { randomUUID } from "crypto";

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

/** Wire artifact meta. Dual-emits `artifact_id` + legacy `page_id`. */
export type ArtifactRow = {
  artifact_id: string;
  page_id: string;
  title: string;
  slug: string;
  current_revision_id: string | null;
  created_at: string;
  dossier_id: string | null;
  /** CONCEPT §3.4 — Owner-only merge when true (Canon restricted). */
  owner_merge_only: boolean;
  /** CONCEPT §4 — Manual lane; null on Canon. Immutable after create. */
  lane: string | null;
  /**
   * CONCEPT §4.1 — computed soft label (`composite` / `bridge` when claim
   * links reference other Manual lanes). Null on Canon / when not resolved.
   */
  lane_soft_label?: SoftLaneLabel | null;
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

export type CollectionEmpiricalQuality = {
  total: number;
  open: number;
  resolved: number;
  invalidated: number;
  ambiguous_or_conflict: number;
  invalidated_rate: number | null;
  ambiguity_rate: number | null;
  mean_citation_density: number | null;
  mean_days_to_resolution: number | null;
};

export type CollectionForecastAccuracy = {
  n: number;
  mean_brier: number | null;
  mean_log_score: number | null;
  mean_skill_vs_baseline: number | null;
  baseline_p: number;
  baseline_label: string;
  public_board_eligible: boolean;
};

export type RequirementSatisfactionSnapshot = {
  open: number;
  accepted: number;
  satisfied: number;
  failed: number;
  superseded: number;
  invalidated: number;
  disputed: number;
  other: number;
};

export type CollectionDashboard = {
  collection: CollectionRow;
  stats: {
    dossier_count: number;
    artifact_count: number;
    empty_dossier_count: number;
  };
  dossiers: CollectionDashboardDossier[];
  /** Open/rfc/review thread count + open Critical Findings (CONCEPT §7 / §11). */
  open_threads: {
    count: number;
    critical_findings: number;
  };
  /** CONCEPT §5.5–5.9 claim quality + forecast accuracy (Collection-scoped). */
  claims: {
    empirical_quality: CollectionEmpiricalQuality;
    forecast_accuracy: CollectionForecastAccuracy;
  };
  /** Manuals — tallies of artifact lanes (CONCEPT §4). */
  lane_coverage: null | {
    Descriptive: number;
    Prescriptive: number;
    Alignment: number;
  };
  /** Manuals — requirement claim satisfaction snapshot (M6). */
  requirement_satisfaction: null | {
    open: number;
    total: number;
    snapshot: RequirementSatisfactionSnapshot;
  };
  /** Recent Findings in this Collection (CONCEPT §7 / §11). */
  red_team: {
    recent_count: number;
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

/** Compact child summary for wrapper RFC responses. */
export type ThreadChildSummary = {
  thread_id: string;
  title: string;
  state: string;
  merge_artifact_id: string | null;
  decision_outcome: string | null;
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
  /** Present on wrapper RFCs (and detail fetches that include children). */
  child_threads?: ThreadChildSummary[];
  /** Derived: leaf has merge_artifact_id; wrapper is rfc with children and no merge. */
  rfc_kind?: "leaf" | "wrapper" | null;
  /** CONCEPT §3.4 — present on leaf RFCs when merge artifact Collection resolves. */
  merge_authority?: {
    artifact_id: string;
    collection_id: string;
    area_kind: AreaKind;
    authority_class: MergeAuthorityClass;
    required_roles: PrototypeRole[];
    description: string;
    allowed_user_ids: string[];
  } | null;
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

/** CONCEPT §5 Claim wire shape (+ §8.3 adjudication scaffolding). */
export type ClaimRow = {
  claim_id: string;
  artifact_id: string;
  section_id: string | null;
  profile: string;
  text: string;
  status: string;
  empirical_type: string | null;
  scope: string | null;
  region_code: string | null;
  region_label: string | null;
  probability: number | null;
  as_of: string | null;
  deadline: string | null;
  resolution_criteria: string | null;
  preferred_sources: string[];
  adjudication_rule: string | null;
  canon_citations: string[];
  links: unknown[];
  created_at: string;
  author_id: string | null;
  adjudication_requested_at: string | null;
  adjudication_requested_by: string | null;
  adjudication_request_note: string | null;
  adjudication_rationale: string | null;
  adjudicated_by: string | null;
  adjudicated_at: string | null;
  /** Derived: pending on global adjudication queue. */
  adjudication_pending?: boolean;
};

/** CONCEPT §7.3 Finding target join. */
export type FindingTargetRow = {
  target_kind: string;
  target_id: string;
};

/** CONCEPT §7.3 Finding wire shape. */
export type FindingRow = {
  finding_id: string;
  thread_id: string;
  title: string;
  severity: string;
  likelihood: string | null;
  status: string;
  evidence: string | null;
  attack_path: string | null;
  author_id: string;
  created_at: string;
  targets: FindingTargetRow[];
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

function mapArtifact(
  row: {
    artifactId: string;
    title: string;
    slug: string;
    currentRevisionId: string | null;
    createdAt: Date;
    dossierId: string | null;
    ownerMergeOnly?: boolean;
    lane?: string | null;
  },
  extras?: { lane_soft_label?: SoftLaneLabel | null },
): ArtifactRow {
  return {
    artifact_id: row.artifactId,
    page_id: row.artifactId,
    title: row.title,
    slug: row.slug,
    current_revision_id: row.currentRevisionId,
    created_at: row.createdAt.toISOString(),
    dossier_id: row.dossierId,
    owner_merge_only: row.ownerMergeOnly ?? false,
    lane: row.lane ?? null,
    ...(extras?.lane_soft_label !== undefined
      ? { lane_soft_label: extras.lane_soft_label }
      : {}),
  };
}

/** Resolve soft composite/bridge label from claim links → other Manual lanes. */
export async function resolveSoftLaneLabel(
  artifactId: string,
  primaryLane: string | null,
): Promise<SoftLaneLabel | null> {
  if (!primaryLane) return null;
  const claims = await getPrisma().claim.findMany({
    where: { artifactId },
    select: { links: true },
  });
  const linkedIds = new Set<string>();
  for (const c of claims) {
    for (const id of artifactIdsFromClaimLinks(c.links)) {
      if (id !== artifactId) linkedIds.add(id);
    }
  }
  if (linkedIds.size === 0) {
    return computeSoftLaneLabel(primaryLane, []);
  }
  const linked = await getPrisma().artifact.findMany({
    where: { artifactId: { in: [...linkedIds] } },
    select: { lane: true },
  });
  return computeSoftLaneLabel(
    primaryLane,
    linked.map((a) => a.lane),
  );
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

/** Display-only dossier lane hint; prefer Artifact.lane (immutable after create). */
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
 * Real dossier health, open threads, claim metrics, Findings counts.
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
  let requirement_satisfaction: CollectionDashboard["requirement_satisfaction"] =
    null;

  const dossierIds = withHealth.map((d) => d.dossier_id);

  const claimRows =
    dossierIds.length === 0
      ? []
      : await getPrisma().claim.findMany({
          where: { artifact: { dossierId: { in: dossierIds } } },
          select: {
            profile: true,
            status: true,
            empiricalType: true,
            probability: true,
            preferredSources: true,
            canonCitations: true,
            createdAt: true,
            adjudicatedAt: true,
          },
        });

  const metricInputs = claimRows.map((c) => ({
    profile: c.profile,
    status: c.status,
    empirical_type: c.empiricalType,
    probability: c.probability,
    preferred_sources: c.preferredSources,
    canon_citations: c.canonCitations,
    created_at: c.createdAt.toISOString(),
    adjudicated_at: c.adjudicatedAt?.toISOString() ?? null,
  }));

  if (isManual) {
    lane_coverage = { Descriptive: 0, Prescriptive: 0, Alignment: 0 };
    if (dossierIds.length > 0) {
      const artRows = await getPrisma().artifact.findMany({
        where: { dossierId: { in: dossierIds } },
        select: { lane: true },
      });
      for (const a of artRows) {
        if (a.lane === "descriptive") lane_coverage.Descriptive += 1;
        else if (a.lane === "prescriptive") lane_coverage.Prescriptive += 1;
        else if (a.lane === "alignment") lane_coverage.Alignment += 1;
      }
    }
    const reqClaims = metricInputs.filter((c) => c.profile === "requirement");
    const snapshot = computeRequirementSatisfactionSnapshot(reqClaims);
    requirement_satisfaction = {
      open: snapshot.open,
      total: reqClaims.length,
      snapshot,
    };
  }

  const openThreadCount =
    dossierIds.length === 0
      ? 0
      : await getPrisma().thread.count({
          where: {
            homeDossierId: { in: dossierIds },
            state: { in: ["open", "rfc", "review"] },
          },
        });

  // CONCEPT §7 / §11 — Findings scoped via originating thread home dossier.
  const collectionFindings =
    dossierIds.length === 0
      ? []
      : await getPrisma().finding.findMany({
          where: { thread: { homeDossierId: { in: dossierIds } } },
          select: { severity: true, status: true },
        });
  const critical_findings = collectionFindings.filter(isOpenCriticalFinding)
    .length;
  const recent_count = collectionFindings.length;

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
      critical_findings,
    },
    claims: {
      empirical_quality: computeEmpiricalQuality(metricInputs),
      forecast_accuracy: computeForecastAccuracy(metricInputs),
    },
    lane_coverage,
    requirement_satisfaction,
    red_team: {
      recent_count,
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
  if (!row) return null;
  const lane_soft_label = await resolveSoftLaneLabel(
    row.artifactId,
    row.lane ?? null,
  );
  return mapArtifact(row, { lane_soft_label });
}

/** @deprecated Prefer getArtifact */
export const getPage = getArtifact;

export type CreateArtifactError =
  | { code: "dossier_not_found" }
  | { code: "duplicate_id" }
  | LaneRuleError;

export type UpdateArtifactError =
  | { code: "not_found" }
  | LaneRuleError;

/**
 * Create an artifact. Manual dossiers require `lane` at create; Canon
 * rejects any lane. Lane is immutable thereafter (CONCEPT §4).
 */
export async function createArtifact(input: {
  artifact_id?: string;
  title: string;
  slug: string;
  dossier_id: string;
  lane?: string | null;
  owner_merge_only?: boolean;
  current_revision_id?: string | null;
  created_at?: string;
}): Promise<
  { ok: true; artifact: ArtifactRow } | { ok: false; error: CreateArtifactError }
> {
  const dossier = await getPrisma().dossier.findUnique({
    where: { dossierId: input.dossier_id },
    select: {
      dossierId: true,
      collection: {
        select: { area: { select: { kind: true } } },
      },
    },
  });
  if (!dossier?.collection?.area) {
    return { ok: false, error: { code: "dossier_not_found" } };
  }

  const laneCheck = validateLaneOnCreate(
    dossier.collection.area.kind,
    input.lane,
  );
  if (!laneCheck.ok) {
    return { ok: false, error: laneCheck.error };
  }

  const artifactId = input.artifact_id ?? crypto.randomUUID();
  const existing = await getPrisma().artifact.findUnique({
    where: { artifactId },
  });
  if (existing) {
    return { ok: false, error: { code: "duplicate_id" } };
  }

  const row = await getPrisma().artifact.create({
    data: {
      artifactId,
      title: input.title,
      slug: input.slug,
      dossierId: input.dossier_id,
      lane: laneCheck.lane,
      ownerMergeOnly: input.owner_merge_only ?? false,
      currentRevisionId: input.current_revision_id ?? null,
      createdAt: input.created_at ? new Date(input.created_at) : new Date(),
    },
  });
  return {
    ok: true,
    artifact: mapArtifact(row, {
      lane_soft_label: computeSoftLaneLabel(row.lane, []),
    }),
  };
}

export async function updateArtifact(
  artifactId: string,
  patch: Partial<{
    title: string;
    slug: string;
    current_revision_id: string | null;
    dossier_id: string | null;
    lane: string | null;
  }>,
  opts?: { lanePresentInPatch?: boolean },
): Promise<
  | { ok: true; artifact: ArtifactRow }
  | { ok: false; error: UpdateArtifactError }
> {
  const laneGuard = validateLaneOnPatch({
    lanePresentInPatch: opts?.lanePresentInPatch ?? "lane" in patch,
  });
  if (!laneGuard.ok) {
    return { ok: false, error: laneGuard.error };
  }

  const existing = await getPrisma().artifact.findUnique({
    where: { artifactId },
  });
  if (!existing) {
    return { ok: false, error: { code: "not_found" } };
  }

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
  const lane_soft_label = await resolveSoftLaneLabel(
    row.artifactId,
    row.lane ?? null,
  );
  return { ok: true, artifact: mapArtifact(row, { lane_soft_label }) };
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
      childThreads: {
        orderBy: { createdAt: "asc" },
        select: {
          threadId: true,
          title: true,
          state: true,
          mergeArtifactId: true,
          decisionOutcome: true,
        },
      },
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
  mapped.child_threads = row.childThreads.map((c) => ({
    thread_id: c.threadId,
    title: c.title,
    state: c.state,
    merge_artifact_id: c.mergeArtifactId,
    decision_outcome: c.decisionOutcome,
  }));
  mapped.rfc_kind = deriveRfcKind(mapped);
  if (mapped.merge_artifact_id) {
    const auth = await resolveMergeAuthorityForArtifact(mapped.merge_artifact_id);
    mapped.merge_authority = auth
      ? buildMergeAuthoritySummary(auth)
      : null;
  }
  return mapped;
}

/** Resolve CONCEPT §3.4 context from merge artifact → dossier → collection → area. */
export async function resolveMergeAuthorityForArtifact(
  artifactId: string,
): Promise<MergeAuthorityContext | null> {
  const row = await getPrisma().artifact.findUnique({
    where: { artifactId },
    select: {
      artifactId: true,
      ownerMergeOnly: true,
      dossier: {
        select: {
          collectionId: true,
          collection: {
            select: {
              collectionId: true,
              countryCode: true,
              areaId: true,
              area: { select: { areaId: true, kind: true } },
            },
          },
        },
      },
    },
  });
  if (!row?.dossier?.collection?.area) return null;
  const areaKindRaw = row.dossier.collection.area.kind;
  const area_kind: AreaKind =
    areaKindRaw === "manuals" ? "manuals" : "canon";
  const authority_class = classifyMergeAuthority({
    area_kind,
    owner_merge_only: row.ownerMergeOnly,
  });
  return {
    artifact_id: row.artifactId,
    collection_id: row.dossier.collection.collectionId,
    area_id: row.dossier.collection.area.areaId,
    area_kind,
    country_code: row.dossier.collection.countryCode,
    owner_merge_only: row.ownerMergeOnly,
    authority_class,
    required_roles: requiredRolesForClass(authority_class),
  };
}

function deriveRfcKind(thread: ThreadRow): "leaf" | "wrapper" | null {
  if (thread.state !== "rfc" && thread.state !== "review" && thread.state !== "decided") {
    return null;
  }
  if (thread.merge_artifact_id) return "leaf";
  return "wrapper";
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
  | { code: "no_artifact_target" }
  | { code: "artifact_missing"; artifact_id: string }
  | { code: "merge_mismatch"; merge_artifact_id: string; artifact_ids: string[] }
  | {
      code: "cross_collection";
      artifact_ids: string[];
      collection_ids: string[];
    };

/**
 * Resolve artifact ids from thread targets (direct artifact + section→artifact).
 */
async function resolvePromoteArtifactIds(
  targets: { targetKind: string; targetId: string }[],
): Promise<string[]> {
  const prisma = getPrisma();
  const direct = targets
    .filter((t) => t.targetKind === "artifact")
    .map((t) => t.targetId);
  const sectionIds = targets
    .filter((t) => t.targetKind === "section")
    .map((t) => t.targetId);
  const fromSections =
    sectionIds.length === 0
      ? []
      : (
          await prisma.section.findMany({
            where: { sectionId: { in: sectionIds } },
            select: { artifactId: true },
          })
        ).map((s) => s.artifactId);
  return [...new Set([...direct, ...fromSections])];
}

async function resolveArtifactCollections(
  artifactIds: string[],
): Promise<
  | { ok: true; byArtifact: Map<string, { collectionId: string; title: string; dossierId: string | null }> }
  | { ok: false; missing: string }
> {
  const prisma = getPrisma();
  const artifacts = await prisma.artifact.findMany({
    where: { artifactId: { in: artifactIds } },
    select: {
      artifactId: true,
      title: true,
      dossierId: true,
      dossier: { select: { collectionId: true } },
    },
  });
  const byArtifact = new Map<
    string,
    { collectionId: string; title: string; dossierId: string | null }
  >();
  for (const a of artifacts) {
    if (!a.dossier?.collectionId) {
      return { ok: false, missing: a.artifactId };
    }
    byArtifact.set(a.artifactId, {
      collectionId: a.dossier.collectionId,
      title: a.title,
      dossierId: a.dossierId,
    });
  }
  for (const id of artifactIds) {
    if (!byArtifact.has(id)) return { ok: false, missing: id };
  }
  return { ok: true, byArtifact };
}

/**
 * Promote an open discussion thread to RFC.
 * - Single artifact → leaf RFC (`merge_artifact_id` set; RevSets allowed).
 * - Multi-artifact (same Collection) → wrapper parent + one sub-RFC per artifact.
 * - Cross-Collection multi-artifact → rejected (`cross_collection`).
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

  const uniqueArtifacts = await resolvePromoteArtifactIds(row.targets);

  if (uniqueArtifacts.length === 0 && !input.merge_artifact_id) {
    return { ok: false, error: { code: "no_artifact_target" } };
  }

  // Multi-artifact → wrapper parent + sub-RFCs (CONCEPT §3.3).
  if (uniqueArtifacts.length > 1) {
    if (
      input.merge_artifact_id &&
      !uniqueArtifacts.includes(input.merge_artifact_id)
    ) {
      return {
        ok: false,
        error: {
          code: "merge_mismatch",
          merge_artifact_id: input.merge_artifact_id,
          artifact_ids: uniqueArtifacts,
        },
      };
    }

    const collections = await resolveArtifactCollections(uniqueArtifacts);
    if (!collections.ok) {
      return {
        ok: false,
        error: { code: "artifact_missing", artifact_id: collections.missing },
      };
    }
    const collectionIds = [
      ...new Set(
        [...collections.byArtifact.values()].map((v) => v.collectionId),
      ),
    ];
    if (collectionIds.length > 1) {
      return {
        ok: false,
        error: {
          code: "cross_collection",
          artifact_ids: uniqueArtifacts,
          collection_ids: collectionIds,
        },
      };
    }

    const authorId = input.author_id ?? "system";
    const now = new Date();
    const childIds: string[] = [];

    await prisma.$transaction(async (tx) => {
      await tx.thread.update({
        where: { threadId: input.thread_id },
        data: {
          state: "rfc",
          mergeArtifactId: null,
        },
      });

      for (const artifactId of uniqueArtifacts) {
        const meta = collections.byArtifact.get(artifactId)!;
        const childId = `${input.thread_id}--${artifactId}`;
        childIds.push(childId);
        await tx.thread.create({
          data: {
            threadId: childId,
            homeDossierId: meta.dossierId ?? row.homeDossierId,
            title: `Sub-RFC: ${meta.title}`,
            state: "rfc",
            decisionOutcome: null,
            isRedteam: row.isRedteam,
            parentThreadId: input.thread_id,
            mergeArtifactId: artifactId,
            createdAt: now,
          },
        });
        await tx.threadTarget.create({
          data: {
            threadId: childId,
            targetKind: "artifact",
            targetId: artifactId,
          },
        });
        await tx.threadPost.create({
          data: {
            postId: crypto.randomUUID(),
            threadId: childId,
            authorId,
            type: "comment",
            body: `Leaf sub-RFC under wrapper ${input.thread_id} (merge → ${artifactId}). RevSets may propose ArtifactRevisions.`,
            createdAt: now,
          },
        });
      }

      await tx.threadPost.create({
        data: {
          postId: crypto.randomUUID(),
          threadId: input.thread_id,
          authorId,
          type: "comment",
          body: `Promoted to wrapper RFC with ${childIds.length} sub-RFCs (${uniqueArtifacts.join(", ")}). Wrapper coordinates only — sub-RFCs merge content.`,
          createdAt: now,
        },
      });
    });

    const thread = await getThread(input.thread_id);
    if (!thread) return { ok: false, error: { code: "not_found" } };
    return { ok: true, thread };
  }

  // Leaf promote (0–1 resolved artifact targets, optional explicit merge id).
  const mergeId = input.merge_artifact_id ?? uniqueArtifacts[0]!;
  if (
    uniqueArtifacts.length === 1 &&
    input.merge_artifact_id &&
    uniqueArtifacts[0] !== input.merge_artifact_id
  ) {
    return {
      ok: false,
      error: {
        code: "merge_mismatch",
        merge_artifact_id: input.merge_artifact_id,
        artifact_ids: uniqueArtifacts,
      },
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

export type DecisionOutcome = "merged" | "rejected" | "parked";

export type DecideThreadError =
  | { code: "not_found" }
  | { code: "already_decided"; decision_outcome: string | null }
  | { code: "not_decidable"; state: string; merge_artifact_id: string | null }
  | { code: "wrapper_not_direct" }
  | { code: "merge_requires_revset" }
  | { code: "revset_missing"; revset_version: number }
  | { code: "revision_missing"; artifact_revision_id: string }
  | { code: "authority_context_missing"; artifact_id: string }
  | {
      code: "forbidden";
      author_id: string;
      authority_class: MergeAuthorityClass;
      required_roles: PrototypeRole[];
      collection_id: string;
      area_kind: AreaKind;
    };

const DECISION_OUTCOMES: DecisionOutcome[] = ["merged", "rejected", "parked"];

function aggregateChildOutcomes(
  outcomes: (string | null)[],
): DecisionOutcome {
  const normalized = outcomes.map((o) =>
    o && DECISION_OUTCOMES.includes(o as DecisionOutcome)
      ? (o as DecisionOutcome)
      : "parked",
  );
  const unique = [...new Set(normalized)];
  if (unique.length === 1) return unique[0]!;
  // Mixed leaf outcomes → wrapper parked (coordination closed, no uniform result).
  return "parked";
}

/**
 * Decide a leaf RFC: merged | rejected | parked.
 * - merged: apply latest (or specified) RevSet → Artifact.current_revision_id + Section sync
 * - rejected / parked: no content write
 * Wrapper parents are never decided directly; when all children are decided,
 * the parent cascades to decided with an aggregated outcome (CONCEPT §3.3).
 * Collection merge authority (CONCEPT §3.4) is enforced for all decide outcomes.
 * Accepted Risk / Critical Finding gates remain deferred to M7.
 */
export async function decideThread(input: {
  thread_id: string;
  outcome: DecisionOutcome;
  author_id?: string;
  /** Optional RevSet version to apply on merge; default latest. */
  revset_version?: number;
}): Promise<
  | { ok: true; thread: ThreadRow; parent_cascaded: boolean }
  | { ok: false; error: DecideThreadError }
> {
  const prisma = getPrisma();
  const row = await prisma.thread.findUnique({
    where: { threadId: input.thread_id },
    include: {
      revSets: { orderBy: { version: "desc" } },
    },
  });
  if (!row) return { ok: false, error: { code: "not_found" } };

  if (row.state === "decided") {
    return {
      ok: false,
      error: {
        code: "already_decided",
        decision_outcome: row.decisionOutcome,
      },
    };
  }

  // Leaf RFCs have merge_artifact_id. Wrappers coordinate only via children.
  if (!row.mergeArtifactId) {
    if (row.state === "rfc" || row.state === "review") {
      return { ok: false, error: { code: "wrapper_not_direct" } };
    }
    return {
      ok: false,
      error: {
        code: "not_decidable",
        state: row.state,
        merge_artifact_id: row.mergeArtifactId,
      },
    };
  }

  if (row.state !== "rfc" && row.state !== "review") {
    return {
      ok: false,
      error: {
        code: "not_decidable",
        state: row.state,
        merge_artifact_id: row.mergeArtifactId,
      },
    };
  }

  const authorId = input.author_id ?? "system";
  const authority = await resolveMergeAuthorityForArtifact(row.mergeArtifactId);
  if (!authority) {
    return {
      ok: false,
      error: {
        code: "authority_context_missing",
        artifact_id: row.mergeArtifactId,
      },
    };
  }
  if (!actorMayDecide(authorId, authority.authority_class)) {
    return {
      ok: false,
      error: {
        code: "forbidden",
        author_id: authorId,
        authority_class: authority.authority_class,
        required_roles: authority.required_roles,
        collection_id: authority.collection_id,
        area_kind: authority.area_kind,
      },
    };
  }

  const now = new Date();

  if (input.outcome === "merged") {
    if (row.revSets.length === 0) {
      return { ok: false, error: { code: "merge_requires_revset" } };
    }
    const chosen =
      input.revset_version != null
        ? row.revSets.find((r) => r.version === input.revset_version)
        : row.revSets[0];
    if (!chosen) {
      return {
        ok: false,
        error: {
          code: "revset_missing",
          revset_version: input.revset_version!,
        },
      };
    }
    const revision = await prisma.artifactRevision.findUnique({
      where: { revisionId: chosen.artifactRevisionId },
    });
    if (!revision || revision.artifactId !== row.mergeArtifactId) {
      return {
        ok: false,
        error: {
          code: "revision_missing",
          artifact_revision_id: chosen.artifactRevisionId,
        },
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.artifact.update({
        where: { artifactId: row.mergeArtifactId! },
        data: { currentRevisionId: revision.revisionId },
      });
      await tx.thread.update({
        where: { threadId: input.thread_id },
        data: {
          state: "decided",
          decisionOutcome: "merged",
        },
      });
      await tx.threadPost.create({
        data: {
          postId: crypto.randomUUID(),
          threadId: input.thread_id,
          authorId,
          type: "comment",
          body: `Decision: merged (applied RevSet v${chosen.version} → ${revision.revisionId}) by ${authorId} under ${authority.authority_class}. Accepted Risk gate deferred to M7.`,
          createdAt: now,
        },
      });
    });
    await syncSectionsForArtifact(row.mergeArtifactId, revision.contentJson);
  } else {
    await prisma.$transaction(async (tx) => {
      await tx.thread.update({
        where: { threadId: input.thread_id },
        data: {
          state: "decided",
          decisionOutcome: input.outcome,
        },
      });
      await tx.threadPost.create({
        data: {
          postId: crypto.randomUUID(),
          threadId: input.thread_id,
          authorId,
          type: "comment",
          body: `Decision: ${input.outcome} by ${authorId} under ${authority.authority_class}.`,
          createdAt: now,
        },
      });
    });
  }

  let parentCascaded = false;
  if (row.parentThreadId) {
    parentCascaded = await maybeCascadeParentDecision(
      row.parentThreadId,
      authorId,
    );
  }

  const thread = await getThread(input.thread_id);
  if (!thread) return { ok: false, error: { code: "not_found" } };
  return { ok: true, thread, parent_cascaded: parentCascaded };
}

/** When every child leaf is decided, set parent wrapper to decided. */
async function maybeCascadeParentDecision(
  parentThreadId: string,
  authorId: string,
): Promise<boolean> {
  const prisma = getPrisma();
  const parent = await prisma.thread.findUnique({
    where: { threadId: parentThreadId },
    include: {
      childThreads: {
        select: {
          threadId: true,
          state: true,
          decisionOutcome: true,
        },
      },
    },
  });
  if (!parent || parent.state === "decided") return false;
  if (parent.childThreads.length === 0) return false;
  if (parent.childThreads.some((c) => c.state !== "decided")) return false;

  const outcome = aggregateChildOutcomes(
    parent.childThreads.map((c) => c.decisionOutcome),
  );
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.thread.update({
      where: { threadId: parentThreadId },
      data: {
        state: "decided",
        decisionOutcome: outcome,
      },
    });
    await tx.threadPost.create({
      data: {
        postId: crypto.randomUUID(),
        threadId: parentThreadId,
        authorId,
        type: "comment",
        body: `Wrapper decided (${outcome}): all ${parent.childThreads.length} sub-RFCs are decided.`,
        createdAt: now,
      },
    });
  });
  return true;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function mapClaim(row: {
  claimId: string;
  artifactId: string;
  sectionId: string | null;
  profile: string;
  text: string;
  status: string;
  empiricalType: string | null;
  scope: string | null;
  regionCode: string | null;
  regionLabel: string | null;
  probability: number | null;
  asOf: Date | null;
  deadline: Date | null;
  resolutionCriteria: string | null;
  preferredSources: unknown;
  adjudicationRule: string | null;
  canonCitations: unknown;
  links: unknown;
  createdAt: Date;
  authorId: string | null;
  adjudicationRequestedAt: Date | null;
  adjudicationRequestedBy: string | null;
  adjudicationRequestNote: string | null;
  adjudicationRationale: string | null;
  adjudicatedBy: string | null;
  adjudicatedAt: Date | null;
}): ClaimRow {
  const adjudication_requested_at = row.adjudicationRequestedAt
    ? row.adjudicationRequestedAt.toISOString()
    : null;
  const adjudicated_at = row.adjudicatedAt
    ? row.adjudicatedAt.toISOString()
    : null;
  return {
    claim_id: row.claimId,
    artifact_id: row.artifactId,
    section_id: row.sectionId,
    profile: row.profile,
    text: row.text,
    status: row.status,
    empirical_type: row.empiricalType,
    scope: row.scope,
    region_code: row.regionCode,
    region_label: row.regionLabel,
    probability: row.probability,
    as_of: row.asOf ? row.asOf.toISOString() : null,
    deadline: row.deadline ? row.deadline.toISOString() : null,
    resolution_criteria: row.resolutionCriteria,
    preferred_sources: asStringArray(row.preferredSources),
    adjudication_rule: row.adjudicationRule,
    canon_citations: asStringArray(row.canonCitations),
    links: Array.isArray(row.links) ? row.links : [],
    created_at: row.createdAt.toISOString(),
    author_id: row.authorId,
    adjudication_requested_at,
    adjudication_requested_by: row.adjudicationRequestedBy,
    adjudication_request_note: row.adjudicationRequestNote,
    adjudication_rationale: row.adjudicationRationale,
    adjudicated_by: row.adjudicatedBy,
    adjudicated_at,
    adjudication_pending: isAdjudicationPending({
      adjudication_requested_at,
      adjudicated_at,
    }),
  };
}

/** Resolve Area/lane context for claim profile legality (CONCEPT §5). */
export async function resolveClaimOwnerContext(
  artifactId: string,
): Promise<ClaimOwnerContext | null> {
  const row = await getPrisma().artifact.findUnique({
    where: { artifactId },
    select: {
      artifactId: true,
      lane: true,
      dossier: {
        select: {
          collection: {
            select: {
              area: { select: { kind: true } },
            },
          },
        },
      },
    },
  });
  if (!row?.dossier?.collection?.area) return null;
  return {
    artifact_id: row.artifactId,
    area_kind: row.dossier.collection.area.kind,
    lane: row.lane,
  };
}

export async function listClaims(opts?: {
  artifactId?: string;
  profile?: string;
}): Promise<ClaimRow[]> {
  const rows = await getPrisma().claim.findMany({
    where: {
      ...(opts?.artifactId ? { artifactId: opts.artifactId } : {}),
      ...(opts?.profile ? { profile: opts.profile } : {}),
    },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(mapClaim);
}

export async function getClaim(claimId: string): Promise<ClaimRow | null> {
  const row = await getPrisma().claim.findUnique({ where: { claimId } });
  return row ? mapClaim(row) : null;
}

export type CreateClaimError =
  | { code: "not_found" }
  | { code: "no_owner_context" }
  | { code: "section_mismatch" }
  | ClaimLegalityError;

export async function createClaim(input: {
  claim_id?: string;
  artifact_id: string;
  section_id?: string | null;
  profile: string;
  text: string;
  status?: string;
  empirical_type?: string | null;
  scope?: string | null;
  region_code?: string | null;
  region_label?: string | null;
  probability?: number | null;
  as_of?: string | null;
  deadline?: string | null;
  resolution_criteria?: string | null;
  preferred_sources?: string[];
  adjudication_rule?: string | null;
  canon_citations?: string[];
  links?: unknown[];
  author_id?: string | null;
  created_at?: string;
}): Promise<
  { ok: true; claim: ClaimRow } | { ok: false; error: CreateClaimError }
> {
  const artifact = await getPrisma().artifact.findUnique({
    where: { artifactId: input.artifact_id },
  });
  if (!artifact) return { ok: false, error: { code: "not_found" } };

  const owner = await resolveClaimOwnerContext(input.artifact_id);
  if (!owner) return { ok: false, error: { code: "no_owner_context" } };

  if (input.section_id) {
    const section = await getPrisma().section.findUnique({
      where: { sectionId: input.section_id },
    });
    if (!section || section.artifactId !== input.artifact_id) {
      return { ok: false, error: { code: "section_mismatch" } };
    }
  }

  const draft: ClaimDraftInput = {
    profile: input.profile,
    text: input.text,
    empirical_type: input.empirical_type,
    scope: input.scope,
    region_code: input.region_code,
    region_label: input.region_label,
    probability: input.probability,
    canon_citations: input.canon_citations,
    resolution_criteria: input.resolution_criteria,
    preferred_sources: input.preferred_sources,
  };
  const legality = validateClaimAgainstOwner(owner, draft);
  if (!legality.ok) {
    return { ok: false, error: legality.error };
  }

  const claimId = input.claim_id ?? crypto.randomUUID();
  const row = await getPrisma().claim.create({
    data: {
      claimId,
      artifactId: input.artifact_id,
      sectionId: input.section_id ?? null,
      profile: input.profile,
      text: input.text,
      status: input.status ?? "open",
      empiricalType: input.empirical_type ?? null,
      scope: input.scope ?? null,
      regionCode: input.region_code ?? null,
      regionLabel: input.region_label ?? null,
      probability: input.probability ?? null,
      asOf: input.as_of ? new Date(input.as_of) : null,
      deadline: input.deadline ? new Date(input.deadline) : null,
      resolutionCriteria: input.resolution_criteria ?? null,
      preferredSources: input.preferred_sources ?? [],
      adjudicationRule: input.adjudication_rule ?? null,
      canonCitations: input.canon_citations ?? [],
      links: input.links ?? [],
      createdAt: input.created_at ? new Date(input.created_at) : new Date(),
      authorId: input.author_id ?? null,
    },
  });
  return { ok: true, claim: mapClaim(row) };
}

export type RequestAdjudicationError =
  | { code: "not_found" }
  | AdjudicationError;

export async function requestClaimAdjudication(input: {
  claim_id: string;
  author_id: string;
  note?: string | null;
}): Promise<
  | { ok: true; claim: ClaimRow }
  | { ok: false; error: RequestAdjudicationError }
> {
  const existing = await getClaim(input.claim_id);
  if (!existing) return { ok: false, error: { code: "not_found" } };

  const check = validateRequestAdjudication({
    author_id: input.author_id,
    note: input.note,
    claim: existing,
  });
  if (!check.ok) return { ok: false, error: check.error };

  const row = await getPrisma().claim.update({
    where: { claimId: input.claim_id },
    data: {
      adjudicationRequestedAt: new Date(),
      adjudicationRequestedBy: input.author_id,
      adjudicationRequestNote: input.note?.trim() || null,
    },
  });
  return { ok: true, claim: mapClaim(row) };
}

export type AdjudicateClaimError =
  | { code: "not_found" }
  | AdjudicationError;

export async function adjudicateClaim(input: {
  claim_id: string;
  author_id: string;
  status: string;
  rationale: string;
  /** When true (default), claim must be pending on the queue. */
  require_queued?: boolean;
}): Promise<
  | { ok: true; claim: ClaimRow }
  | { ok: false; error: AdjudicateClaimError }
> {
  const existing = await getClaim(input.claim_id);
  if (!existing) return { ok: false, error: { code: "not_found" } };

  const check = validateAdjudicate({
    author_id: input.author_id,
    status: input.status,
    rationale: input.rationale,
    profile: existing.profile,
    requireQueued: input.require_queued !== false,
    claim: existing,
  });
  if (!check.ok) return { ok: false, error: check.error };

  const row = await getPrisma().claim.update({
    where: { claimId: input.claim_id },
    data: {
      status: input.status,
      adjudicationRationale: input.rationale.trim(),
      adjudicatedBy: input.author_id,
      adjudicatedAt: new Date(),
    },
  });
  return { ok: true, claim: mapClaim(row) };
}

/** Global adjudication queue (CONCEPT §8.3) — pending requests across Collections. */
export async function listAdjudicationQueue(): Promise<ClaimRow[]> {
  const rows = await getPrisma().claim.findMany({
    where: {
      adjudicationRequestedAt: { not: null },
    },
    orderBy: { adjudicationRequestedAt: "asc" },
  });
  return rows.map(mapClaim).filter((c) => c.adjudication_pending);
}

function mapFindingTarget(row: {
  targetKind: string;
  targetId: string;
}): FindingTargetRow {
  return {
    target_kind: row.targetKind,
    target_id: row.targetId,
  };
}

function mapFinding(row: {
  findingId: string;
  threadId: string;
  title: string;
  severity: string;
  likelihood: string | null;
  status: string;
  evidence: string | null;
  attackPath: string | null;
  authorId: string;
  createdAt: Date;
  targets?: { targetKind: string; targetId: string }[];
}): FindingRow {
  return {
    finding_id: row.findingId,
    thread_id: row.threadId,
    title: row.title,
    severity: row.severity,
    likelihood: row.likelihood,
    status: row.status,
    evidence: row.evidence,
    attack_path: row.attackPath,
    author_id: row.authorId,
    created_at: row.createdAt.toISOString(),
    targets: (row.targets ?? []).map(mapFindingTarget),
  };
}

export async function listFindings(opts?: {
  threadId?: string;
  collectionId?: string;
  severity?: string;
  status?: string;
}): Promise<FindingRow[]> {
  const rows = await getPrisma().finding.findMany({
    where: {
      ...(opts?.threadId ? { threadId: opts.threadId } : {}),
      ...(opts?.severity ? { severity: opts.severity } : {}),
      ...(opts?.status ? { status: opts.status } : {}),
      ...(opts?.collectionId
        ? { thread: { homeDossier: { collectionId: opts.collectionId } } }
        : {}),
    },
    include: { targets: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(mapFinding);
}

export async function getFinding(
  findingId: string,
): Promise<FindingRow | null> {
  const row = await getPrisma().finding.findUnique({
    where: { findingId },
    include: { targets: true },
  });
  return row ? mapFinding(row) : null;
}

export type CreateFindingInput = {
  finding_id?: string;
  thread_id: string;
  title: string;
  severity: string;
  likelihood?: string | null;
  status?: string;
  evidence?: string | null;
  attack_path?: string | null;
  author_id: string;
  created_at?: string;
  targets?: { target_kind: string; target_id: string }[];
};

export type CreateFindingError =
  | { code: "not_found"; message: string }
  | { code: "forbidden"; message: string }
  | { code: "invalid_severity"; message: string }
  | { code: "invalid_status"; message: string }
  | { code: "invalid_target"; message: string };

/**
 * CONCEPT §7.3 — create a Finding (Red Team only). Always linked to a thread.
 */
export async function createFinding(
  input: CreateFindingInput,
): Promise<
  { ok: true; finding: FindingRow } | { ok: false; error: CreateFindingError }
> {
  if (!actorMayCreateFinding(input.author_id)) {
    return {
      ok: false,
      error: {
        code: "forbidden",
        message: "Only Red Team members may create Findings",
      },
    };
  }
  if (!isFindingSeverity(input.severity)) {
    return {
      ok: false,
      error: {
        code: "invalid_severity",
        message: `severity must be one of low|med|high|critical`,
      },
    };
  }
  const status = input.status ?? "open";
  if (!isFindingStatus(status)) {
    return {
      ok: false,
      error: {
        code: "invalid_status",
        message: `status must be one of open|mitigated|accepted_risk|disputed`,
      },
    };
  }

  const thread = await getPrisma().thread.findUnique({
    where: { threadId: input.thread_id },
    select: { threadId: true },
  });
  if (!thread) {
    return {
      ok: false,
      error: { code: "not_found", message: "Thread not found" },
    };
  }

  const targets = input.targets ?? [];
  for (const t of targets) {
    if (!isFindingTargetKind(t.target_kind) || !t.target_id.trim()) {
      return {
        ok: false,
        error: {
          code: "invalid_target",
          message: `Invalid target ${t.target_kind}:${t.target_id}`,
        },
      };
    }
  }

  const findingId = input.finding_id?.trim() || `finding-${randomUUID()}`;
  const createdAt = input.created_at
    ? new Date(input.created_at)
    : new Date();

  const row = await getPrisma().finding.create({
    data: {
      findingId,
      threadId: input.thread_id,
      title: input.title.trim(),
      severity: input.severity,
      likelihood: input.likelihood ?? null,
      status,
      evidence: input.evidence ?? null,
      attackPath: input.attack_path ?? null,
      authorId: input.author_id,
      createdAt,
      targets: {
        create: targets.map((t) => ({
          targetKind: t.target_kind,
          targetId: t.target_id,
        })),
      },
    },
    include: { targets: true },
  });

  return { ok: true, finding: mapFinding(row) };
}

/**
 * Open Critical Findings that block leaf RFC merge (CONCEPT §7.6).
 * Matches findings targeting the RFC thread id or merge artifact id.
 * AcceptedRisk gate is a later M7 slice — this helper only lists blockers.
 */
export async function listOpenCriticalFindingsForMerge(opts: {
  threadId: string;
  mergeArtifactId: string | null;
}): Promise<FindingRow[]> {
  const or: Array<Record<string, unknown>> = [
    { threadId: opts.threadId },
    {
      targets: {
        some: { targetKind: "thread", targetId: opts.threadId },
      },
    },
  ];
  if (opts.mergeArtifactId) {
    or.push({
      targets: {
        some: {
          targetKind: "artifact",
          targetId: opts.mergeArtifactId,
        },
      },
    });
  }
  const rows = await getPrisma().finding.findMany({
    where: {
      severity: "critical",
      status: "open",
      OR: or,
    },
    include: { targets: true },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(mapFinding);
}
