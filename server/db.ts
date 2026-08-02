/**
 * Prisma-backed data access for the Hono API.
 * Domain models are Artifact / ArtifactRevision; SQLite tables remain
 * `pages` / `page_revisions` via Prisma @@map. Wire JSON dual-emits
 * `artifact_id` (preferred) and legacy `page_id` (same value).
 */
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
  computeReputationBoard,
  type ReputationSignalEvent,
} from "../src/lib/reputation";
import {
  validateSoftDeletePost,
  type SoftDeleteContext,
} from "../src/lib/moderation";
import {
  validateCanonRevert,
  type CanonRevertErrorCode,
} from "../src/lib/canonRevert";
import { getPrototypeUser } from "../src/app/lib/prototype-users";
import { randomUUID } from "crypto";
import { getPrisma } from "./db/prisma";
import {
  appendAuditLog,
  listActiveBoardHides,
  type AuditLogRow,
  type BoardHideRow,
} from "./db/moderationDb";
import { getAttributions, getTerms } from "./db/registries";
import { getUserIdentity } from "./db/identities";
import { evaluateStewardEligibility } from "../src/lib/identityPolicy";
import {
  isOpenCriticalFinding,
} from "../src/lib/findings";
import {
  actorMayPostTypedFindingOrMitigation,
  isRedTeamPostType,
  isTimelinePostType,
} from "../src/lib/candidateFindings";
import { actorMaySignAcceptedRisk } from "../src/lib/acceptedRisk";
import {
  getAcceptedRiskForThread,
  listOpenCriticalFindingsForMerge,
  mapAcceptedRisk,
  type AcceptedRiskRow,
} from "./db/findingsDb";
import {
  validateDocumentStructureForMerge,
  type StructuralIssue,
  type StructuralValidationRegistry,
} from "../src/doc/structuralValidation";
import type { PrototypeRole } from "../src/app/lib/prototype-users";

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

export type ReputationSignalCounts = {
  merged_revsets: number;
  review_labor: number;
  red_team_findings: number;
  adjudications: number;
  accepted_risk_signs: number;
  endorsements: number;
};

export type ReputationContributorRow = {
  user_id: string;
  display_name: string | null;
  signals: ReputationSignalCounts;
  signal_event_count: number;
  advisory_score: number;
};

export type CollectionReputationBoard = {
  advisory: true;
  grants_permissions: false;
  n: number;
  public_board_eligible: boolean;
  contributors: ReputationContributorRow[];
  note: string;
  /** Active Owner board-hides applied to this board (CONCEPT §5.9). */
  hidden_user_ids: string[];
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
  /** CONCEPT §9.2 / §5.9 — advisory non-scorable contribution board. */
  reputation: CollectionReputationBoard;
  /** CONCEPT §5.9 — active Owner board-hides (global; apply to all boards). */
  board_hides: BoardHideRow[];
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
  /** CONCEPT §9.4 soft-delete — null when live. */
  deleted_at: string | null;
  deleted_by: string | null;
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
    /** True when open Critical and/or AcceptedRisk upgrades Canon to Owner-only. */
    critical_or_accepted_risk_path?: boolean;
  } | null;
  /** CONCEPT §7.6 — Accepted Risk on this leaf RFC (if any). */
  accepted_risk?: AcceptedRiskRow | null;
  /** Open Critical Findings that would block merge without Accepted Risk. */
  open_critical_findings?: { finding_id: string; title: string }[];
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
    areaId?: string;
    area?: { areaId: string; kind: string; title: string } | null;
  } | null;
}): DossierRow {
  const tags = Array.isArray(row.tags)
    ? row.tags.filter((t): t is string => typeof t === "string")
    : [];
  const area = row.collection?.area ?? null;
  const areaKindRaw = area?.kind;
  const area_kind =
    areaKindRaw === "manuals"
      ? ("manuals" as const)
      : areaKindRaw === "canon"
        ? ("canon" as const)
        : null;
  return {
    dossier_id: row.dossierId,
    collection_id: row.collectionId,
    title: row.title,
    summary: row.summary,
    tags,
    artifact_count: row._count?.artifacts,
    collection_title: row.collection?.title ?? null,
    country_code: row.collection?.countryCode ?? null,
    area_id: area?.areaId ?? row.collection?.areaId ?? null,
    area_kind,
    area_title: area?.title ?? null,
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
            authorId: true,
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
    author_id: c.authorId,
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

  const activeHides = await listActiveBoardHides();
  const hiddenUserIds = activeHides.map((h) => h.subject_user_id);
  const hiddenSet = new Set(hiddenUserIds);
  /** CONCEPT §5.9 — board-hide applies to claim quality/forecast boards. */
  const boardClaimInputs = metricInputs.filter(
    (c) => !c.author_id || !hiddenSet.has(c.author_id),
  );
  const reputationEvents = await collectReputationSignals(dossierIds);
  const reputationBoard = computeReputationBoard(reputationEvents, {
    hiddenUserIds,
  });
  const reputation: CollectionReputationBoard = {
    ...reputationBoard,
    hidden_user_ids: hiddenUserIds,
    contributors: reputationBoard.contributors.map((c) => ({
      ...c,
      display_name: getPrototypeUser(c.user_id)?.display_name ?? null,
    })),
  };

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
      empirical_quality: computeEmpiricalQuality(boardClaimInputs),
      forecast_accuracy: computeForecastAccuracy(boardClaimInputs),
    },
    lane_coverage,
    requirement_satisfaction,
    red_team: {
      recent_count,
    },
    reputation,
    board_hides: activeHides,
  };
}

/**
 * Gather CONCEPT §9.2 reputation signal events for dossiers in a Collection.
 * Scope = thread home dossier (or claim artifact dossier for adjudications).
 */
async function collectReputationSignals(
  dossierIds: string[],
): Promise<ReputationSignalEvent[]> {
  if (dossierIds.length === 0) return [];

  const events: ReputationSignalEvent[] = [];
  const prisma = getPrisma();

  const threads = await prisma.thread.findMany({
    where: { homeDossierId: { in: dossierIds } },
    select: {
      threadId: true,
      homeDossierId: true,
      state: true,
      decisionOutcome: true,
      posts: {
        where: { deletedAt: null },
        select: {
          authorId: true,
          createdAt: true,
        },
      },
      revSets: {
        select: {
          authorId: true,
          createdAt: true,
        },
      },
      findings: {
        select: {
          authorId: true,
          createdAt: true,
        },
      },
      acceptedRisk: {
        select: {
          signerId: true,
          signedAt: true,
        },
      },
    },
  });

  for (const th of threads) {
    const dossier_id = th.homeDossierId;
    for (const post of th.posts) {
      events.push({
        user_id: post.authorId,
        kind: "review_labor",
        dossier_id,
        created_at: post.createdAt.toISOString(),
      });
    }
    if (th.state === "decided" && th.decisionOutcome === "merged") {
      for (const rs of th.revSets) {
        events.push({
          user_id: rs.authorId,
          kind: "merged_revset",
          dossier_id,
          created_at: rs.createdAt.toISOString(),
        });
      }
    }
    for (const f of th.findings) {
      events.push({
        user_id: f.authorId,
        kind: "red_team_finding",
        dossier_id,
        created_at: f.createdAt.toISOString(),
      });
    }
    if (th.acceptedRisk) {
      events.push({
        user_id: th.acceptedRisk.signerId,
        kind: "accepted_risk_sign",
        dossier_id,
        created_at: th.acceptedRisk.signedAt.toISOString(),
      });
    }
  }

  const adjudicated = await prisma.claim.findMany({
    where: {
      adjudicatedBy: { not: null },
      artifact: { dossierId: { in: dossierIds } },
    },
    select: {
      adjudicatedBy: true,
      adjudicatedAt: true,
      artifact: { select: { dossierId: true } },
    },
  });

  for (const c of adjudicated) {
    if (!c.adjudicatedBy) continue;
    events.push({
      user_id: c.adjudicatedBy,
      kind: "adjudication",
      dossier_id: c.artifact.dossierId,
      created_at: c.adjudicatedAt?.toISOString() ?? null,
    });
  }

  return events;
}

const dossierCollectionNavInclude = {
  title: true,
  countryCode: true,
  areaId: true,
  area: { select: { areaId: true, kind: true, title: true } },
} as const;

export async function listDossiers(
  collectionId?: string,
): Promise<DossierRow[]> {
  const rows = await getPrisma().dossier.findMany({
    where: collectionId ? { collectionId } : undefined,
    orderBy: { title: "asc" },
    include: {
      _count: { select: { artifacts: true } },
      collection: { select: dossierCollectionNavInclude },
    },
  });
  return rows.map(mapDossier);
}

export async function getDossier(dossierId: string): Promise<DossierRow | null> {
  const row = await getPrisma().dossier.findUnique({
    where: { dossierId },
    include: {
      _count: { select: { artifacts: true } },
      collection: { select: dossierCollectionNavInclude },
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

export type RevertCanonArtifactError = {
  code: CanonRevertErrorCode;
  message?: string;
};

/**
 * CONCEPT §9.3 / §9.4 — Owner reverts a Canon artifact to a prior revision
 * (default: parent of current). Append-only `revert` audit; never deletes
 * revisions.
 */
export async function revertCanonArtifact(input: {
  artifact_id: string;
  actor_id: string;
  /** Explicit prior revision; default = parent of current. */
  target_revision_id?: string | null;
}): Promise<
  | {
      ok: true;
      artifact: ArtifactRow;
      from_revision_id: string;
      to_revision_id: string;
      audit: AuditLogRow;
    }
  | { ok: false; error: RevertCanonArtifactError }
> {
  const prisma = getPrisma();
  const row = await prisma.artifact.findUnique({
    where: { artifactId: input.artifact_id },
    include: {
      dossier: {
        select: {
          collection: {
            select: {
              collectionId: true,
              area: { select: { kind: true } },
            },
          },
        },
      },
    },
  });
  if (!row) {
    return {
      ok: false,
      error: { code: "not_found", message: "Artifact not found" },
    };
  }

  const area_kind = row.dossier?.collection?.area?.kind ?? null;
  const gate = validateCanonRevert({
    actor_id: input.actor_id,
    context: { area_kind },
  });
  if (!gate.ok) {
    return { ok: false, error: { code: gate.code, message: gate.message } };
  }

  if (!row.currentRevisionId) {
    return {
      ok: false,
      error: {
        code: "no_current_revision",
        message: "Artifact has no current revision to revert from",
      },
    };
  }

  const current = await prisma.artifactRevision.findUnique({
    where: { revisionId: row.currentRevisionId },
  });
  if (!current || current.artifactId !== input.artifact_id) {
    return {
      ok: false,
      error: {
        code: "no_current_revision",
        message: "Current revision row missing for artifact",
      },
    };
  }

  const targetId =
    input.target_revision_id?.trim() || current.parentRevisionId || null;
  if (!targetId) {
    return {
      ok: false,
      error: {
        code: "nothing_to_revert",
        message:
          "No parent revision and no target_revision_id — nothing to revert to",
      },
    };
  }
  if (targetId === current.revisionId) {
    return {
      ok: false,
      error: {
        code: "already_current",
        message: "Target revision is already current",
      },
    };
  }

  const target = await prisma.artifactRevision.findUnique({
    where: { revisionId: targetId },
  });
  if (!target) {
    return {
      ok: false,
      error: {
        code: "target_missing",
        message: `Target revision not found: ${targetId}`,
      },
    };
  }
  if (target.artifactId !== input.artifact_id) {
    return {
      ok: false,
      error: {
        code: "target_wrong_artifact",
        message: "Target revision belongs to a different artifact",
      },
    };
  }

  await prisma.artifact.update({
    where: { artifactId: input.artifact_id },
    data: { currentRevisionId: target.revisionId },
  });
  await syncSectionsForArtifact(input.artifact_id, target.contentJson);

  const audit = await appendAuditLog({
    action: "revert",
    actor_id: input.actor_id,
    subject_id: input.artifact_id,
    payload: {
      from_revision_id: current.revisionId,
      to_revision_id: target.revisionId,
      collection_id: row.dossier?.collection?.collectionId ?? null,
      area_kind,
    },
  });

  const artifact = await getArtifact(input.artifact_id);
  if (!artifact) {
    return {
      ok: false,
      error: { code: "not_found", message: "Artifact missing after revert" },
    };
  }

  return {
    ok: true,
    artifact,
    from_revision_id: current.revisionId,
    to_revision_id: target.revisionId,
    audit,
  };
}

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
  deletedAt?: Date | null;
  deletedBy?: string | null;
}): ThreadPostRow {
  return {
    post_id: row.postId,
    thread_id: row.threadId,
    author_id: row.authorId,
    type: row.type,
    body: row.body,
    created_at: row.createdAt.toISOString(),
    deleted_at: row.deletedAt ? row.deletedAt.toISOString() : null,
    deleted_by: row.deletedBy ?? null,
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
    deletedAt?: Date | null;
    deletedBy?: string | null;
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
      _count: {
        select: {
          posts: { where: { deletedAt: null } },
        },
      },
    },
  });
  return rows.map(mapThread);
}

export async function getThread(
  threadId: string,
  opts?: { include_deleted_posts?: boolean },
): Promise<ThreadRow | null> {
  const includeDeleted = opts?.include_deleted_posts === true;
  const row = await getPrisma().thread.findUnique({
    where: { threadId },
    include: {
      targets: true,
      posts: {
        where: includeDeleted ? undefined : { deletedAt: null },
        orderBy: { createdAt: "asc" },
      },
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
      _count: {
        select: {
          posts: { where: { deletedAt: null } },
        },
      },
    },
  });
  if (!row) return null;
  const mapped = mapThread(row);
  const home = await getDossier(row.homeDossierId);
  if (home) {
    mapped.home_dossier_title = home.title;
    mapped.collection_id = home.collection_id;
    mapped.collection_title = home.collection_title ?? null;
    mapped.area_kind = home.area_kind ?? null;
  }
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
    const auth = await resolveMergeAuthorityForArtifact(
      mapped.merge_artifact_id,
      { threadId: mapped.thread_id },
    );
    mapped.merge_authority = auth
      ? {
          ...buildMergeAuthoritySummary(auth),
          critical_or_accepted_risk_path:
            auth.critical_or_accepted_risk_path ?? false,
        }
      : null;
    const blockers = await listOpenCriticalFindingsForMerge({
      threadId: mapped.thread_id,
      mergeArtifactId: mapped.merge_artifact_id,
    });
    mapped.open_critical_findings = blockers.map((f) => ({
      finding_id: f.finding_id,
      title: f.title,
    }));
    mapped.accepted_risk = await getAcceptedRiskForThread(mapped.thread_id);
  }
  return mapped;
}

/** Resolve CONCEPT §3.4 context from merge artifact → dossier → collection → area. */
export async function resolveMergeAuthorityForArtifact(
  artifactId: string,
  opts?: { threadId?: string },
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

  let critical_or_accepted_risk_path = false;
  if (opts?.threadId) {
    const [blockers, ar] = await Promise.all([
      listOpenCriticalFindingsForMerge({
        threadId: opts.threadId,
        mergeArtifactId: artifactId,
      }),
      getAcceptedRiskForThread(opts.threadId),
    ]);
    critical_or_accepted_risk_path = blockers.length > 0 || ar != null;
  }

  const authority_class = classifyMergeAuthority({
    area_kind,
    owner_merge_only: row.ownerMergeOnly,
    critical_or_accepted_risk_path,
  });
  return {
    artifact_id: row.artifactId,
    collection_id: row.dossier.collection.collectionId,
    area_id: row.dossier.collection.area.areaId,
    area_kind,
    country_code: row.dossier.collection.countryCode,
    owner_merge_only: row.ownerMergeOnly,
    critical_or_accepted_risk_path,
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
  | { code: "content_required" }
  | {
      code: "content_invalid";
      message: string;
      issues: StructuralIssue[];
    };

async function loadStructuralRegistry(): Promise<StructuralValidationRegistry> {
  const [attributions, terms] = await Promise.all([
    getAttributions(),
    getTerms(),
  ]);

  const attributionIds = new Set(
    (attributions.items ?? [])
      .map((item) =>
        item && typeof item === "object" && "id" in item
          ? String((item as { id: unknown }).id)
          : "",
      )
      .filter(Boolean),
  );

  const termMap = new Map<string, { status?: string }>();
  for (const item of terms.items ?? []) {
    if (!item || typeof item !== "object" || !("id" in item)) continue;
    const id = String((item as { id: unknown }).id);
    if (!id) continue;
    const status =
      "status" in item && typeof (item as { status?: unknown }).status === "string"
        ? (item as { status: string }).status
        : undefined;
    termMap.set(id, { status });
  }

  return { attributions: attributionIds, terms: termMap };
}

async function assertMergeStrictContent(
  contentJson: unknown,
): Promise<
  | { ok: true }
  | { ok: false; error: { code: "content_invalid"; message: string; issues: StructuralIssue[] } }
> {
  const registry = await loadStructuralRegistry();
  const structural = validateDocumentStructureForMerge(contentJson, {
    registry,
  });
  if (structural.success) return { ok: true };
  return {
    ok: false,
    error: {
      code: "content_invalid",
      message:
        "Document failed merge-strict structural validation (warnings treated as errors)",
      issues: structural.issues,
    },
  };
}

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
    const contentCheck = await assertMergeStrictContent(existing.contentJson);
    if (!contentCheck.ok) return contentCheck;
  } else {
    if (input.content_json === undefined) {
      return { ok: false, error: { code: "content_required" } };
    }
    const contentCheck = await assertMergeStrictContent(input.content_json);
    if (!contentCheck.ok) return contentCheck;
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

export type CreateThreadPostError =
  | { code: "not_found"; message: string }
  | { code: "invalid_type"; message: string }
  | { code: "forbidden"; message: string };

export async function createThreadPost(input: {
  post_id?: string;
  thread_id: string;
  author_id: string;
  type?: string;
  body: string;
  created_at?: string;
}): Promise<
  | { ok: true; post: ThreadPostRow }
  | { ok: false; error: CreateThreadPostError }
> {
  const thread = await getPrisma().thread.findUnique({
    where: { threadId: input.thread_id },
  });
  if (!thread) {
    return {
      ok: false,
      error: { code: "not_found", message: "Thread not found" },
    };
  }

  const type = input.type ?? "comment";
  if (!isTimelinePostType(type)) {
    return {
      ok: false,
      error: {
        code: "invalid_type",
        message: `Invalid post type "${type}" (allowed: comment, finding, mitigation)`,
      },
    };
  }

  if (
    isRedTeamPostType(type) &&
    !actorMayPostTypedFindingOrMitigation(input.author_id)
  ) {
    return {
      ok: false,
      error: {
        code: "forbidden",
        message: "Only Red Team may post finding or mitigation types",
      },
    };
  }

  const row = await getPrisma().threadPost.create({
    data: {
      postId: input.post_id ?? crypto.randomUUID(),
      threadId: input.thread_id,
      authorId: input.author_id,
      type,
      body: input.body,
      createdAt: input.created_at ? new Date(input.created_at) : new Date(),
    },
  });
  return { ok: true, post: mapThreadPost(row) };
}

export type SoftDeletePostError =
  | { code: "not_found"; message: string }
  | { code: "already_deleted"; message: string }
  | { code: "unknown_actor"; message: string }
  | { code: "forbidden"; message: string }
  | { code: "canon_owner_only"; message: string }
  | { code: "steward_country_mismatch"; message: string }
  | { code: "identity_unverified"; message: string }
  | { code: "identity_pending"; message: string }
  | { code: "identity_rejected"; message: string }
  | { code: "context_missing"; message: string };

/**
 * CONCEPT §9.4 — soft-delete an ordinary ThreadPost (never hard-delete).
 * Steward local to Manual Collection via §8.6 eligibility; Owner global (incl. Canon).
 * When `thread_id` is provided, mismatch returns not_found with no write.
 */
export async function softDeleteThreadPost(input: {
  post_id: string;
  actor_id: string;
  reason?: string | null;
  /** When set, post must belong to this thread before any mutation. */
  thread_id?: string;
}): Promise<
  | { ok: true; post: ThreadPostRow; audit: AuditLogRow }
  | { ok: false; error: SoftDeletePostError }
> {
  const prisma = getPrisma();
  const post = await prisma.threadPost.findUnique({
    where: { postId: input.post_id },
    include: {
      thread: {
        include: {
          homeDossier: {
            include: {
              collection: {
                include: { area: true },
              },
            },
          },
        },
      },
    },
  });
  if (!post) {
    return {
      ok: false,
      error: { code: "not_found", message: "Post not found" },
    };
  }
  if (input.thread_id != null && post.threadId !== input.thread_id) {
    return {
      ok: false,
      error: { code: "not_found", message: "Post not on this thread" },
    };
  }
  if (post.deletedAt) {
    return {
      ok: false,
      error: { code: "already_deleted", message: "Post already soft-deleted" },
    };
  }

  const collection = post.thread.homeDossier.collection;
  const areaKind = collection.area.kind;
  if (areaKind !== "canon" && areaKind !== "manuals") {
    return {
      ok: false,
      error: {
        code: "context_missing",
        message: `Unknown area kind: ${areaKind}`,
      },
    };
  }
  const context: SoftDeleteContext = {
    area_kind: areaKind,
    country_code: collection.countryCode,
  };

  const identity = await getUserIdentity(input.actor_id);
  const gate = validateSoftDeletePost({
    actor_id: input.actor_id,
    context,
    identity,
  });
  if (!gate.ok) {
    return {
      ok: false,
      error: { code: gate.code, message: gate.message },
    };
  }

  const now = new Date();
  const updated = await prisma.threadPost.update({
    where: { postId: input.post_id },
    data: {
      deletedAt: now,
      deletedBy: input.actor_id,
    },
  });
  const mapped = mapThreadPost(updated);
  const audit = await appendAuditLog({
    action: "post_soft_delete",
    actor_id: input.actor_id,
    subject_id: input.post_id,
    payload: {
      thread_id: post.threadId,
      author_id: post.authorId,
      collection_id: collection.collectionId,
      area_kind: areaKind,
      country_code: collection.countryCode,
      reason: input.reason?.trim() || null,
    },
  });
  return { ok: true, post: mapped, audit };
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
      code: "content_invalid";
      message: string;
      issues: StructuralIssue[];
    }
  | {
      code: "forbidden";
      author_id: string;
      authority_class: MergeAuthorityClass;
      required_roles: PrototypeRole[];
      collection_id: string;
      area_kind: AreaKind;
    }
  | {
      /** CONCEPT §7.6 — open Critical Finding(s) and no AcceptedRisk on this leaf. */
      code: "critical_unaccepted";
      finding_ids: string[];
      message: string;
    }
  | {
      /** CONCEPT §8.6 — Manual steward real-identity / country gate. */
      code:
        | "identity_unverified"
        | "identity_pending"
        | "identity_rejected"
        | "steward_country_mismatch";
      message: string;
      author_id: string;
      country_code: string | null;
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
 * Open Critical Findings block merge unless AcceptedRisk exists (CONCEPT §7.6).
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
  const authority = await resolveMergeAuthorityForArtifact(row.mergeArtifactId, {
    threadId: input.thread_id,
  });
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

  if (authority.authority_class === "manual_steward") {
    const identity = await getUserIdentity(authorId);
    const eligibility = evaluateStewardEligibility({
      actor_id: authorId,
      country_code: authority.country_code,
      identity,
      require_manual_country: true,
    });
    if (!eligibility.ok) {
      const code =
        eligibility.code === "not_steward_role" ||
        eligibility.code === "unknown_user"
          ? "identity_unverified"
          : eligibility.code;
      return {
        ok: false,
        error: {
          code,
          message: eligibility.message,
          author_id: authorId,
          country_code: authority.country_code,
        },
      };
    }
  }

  const now = new Date();

  if (input.outcome === "merged") {
    const blockers = await listOpenCriticalFindingsForMerge({
      threadId: input.thread_id,
      mergeArtifactId: row.mergeArtifactId,
    });
    if (blockers.length > 0) {
      const ar = await getAcceptedRiskForThread(input.thread_id);
      if (!ar) {
        return {
          ok: false,
          error: {
            code: "critical_unaccepted",
            finding_ids: blockers.map((f) => f.finding_id),
            message:
              "Open Critical Finding(s) block merge until Accepted Risk is signed on this leaf RFC",
          },
        };
      }
    }

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

    const contentCheck = await assertMergeStrictContent(revision.contentJson);
    if (!contentCheck.ok) return contentCheck;

    const arNote =
      blockers.length > 0
        ? " Accepted Risk present; Critical gate cleared."
        : "";

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
          body: `Decision: merged (applied RevSet v${chosen.version} → ${revision.revisionId}) by ${authorId} under ${authority.authority_class}.${arNote}`,
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

  // CONCEPT §9.4 — append-only audit for merges (reject/park are not merge events).
  if (input.outcome === "merged") {
    await appendAuditLog({
      action: "merge",
      actor_id: authorId,
      subject_id: input.thread_id,
      payload: {
        outcome: "merged",
        merge_artifact_id: row.mergeArtifactId,
        collection_id: authority.collection_id,
        authority_class: authority.authority_class,
        parent_cascaded: parentCascaded,
      },
    });
  }

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

export type CreateAcceptedRiskInput = {
  accepted_risk_id?: string;
  thread_id: string;
  description: string;
  rationale: string;
  evidence_considered?: string | null;
  reopen_triggers?: string | null;
  signer_id: string;
  signed_at?: string;
};

export type CreateAcceptedRiskError =
  | { code: "not_found"; message: string }
  | { code: "not_leaf"; message: string }
  | { code: "not_decidable"; message: string; state: string }
  | { code: "already_exists"; message: string }
  | { code: "forbidden"; message: string }
  | { code: "authority_context_missing"; message: string }
  | {
      code:
        | "identity_unverified"
        | "identity_pending"
        | "identity_rejected"
        | "steward_country_mismatch";
      message: string;
    };

/**
 * CONCEPT §7.6 — sign Accepted Risk on a leaf RFC.
 * Marks open Critical Findings that would block this merge as `accepted_risk`.
 */
export async function createAcceptedRisk(
  input: CreateAcceptedRiskInput,
): Promise<
  | { ok: true; accepted_risk: AcceptedRiskRow; findings_updated: string[] }
  | { ok: false; error: CreateAcceptedRiskError }
> {
  const prisma = getPrisma();
  const thread = await prisma.thread.findUnique({
    where: { threadId: input.thread_id },
  });
  if (!thread) {
    return {
      ok: false,
      error: { code: "not_found", message: "Thread not found" },
    };
  }
  if (!thread.mergeArtifactId) {
    return {
      ok: false,
      error: {
        code: "not_leaf",
        message: "Accepted Risk attaches only to merging (leaf) RFCs",
      },
    };
  }
  if (thread.state !== "rfc" && thread.state !== "review") {
    return {
      ok: false,
      error: {
        code: "not_decidable",
        message: "Accepted Risk only on open leaf RFCs",
        state: thread.state,
      },
    };
  }

  const existing = await prisma.acceptedRisk.findUnique({
    where: { threadId: input.thread_id },
  });
  if (existing) {
    return {
      ok: false,
      error: {
        code: "already_exists",
        message: "Accepted Risk already signed for this leaf RFC",
      },
    };
  }

  const authority = await resolveMergeAuthorityForArtifact(
    thread.mergeArtifactId,
    { threadId: input.thread_id },
  );
  if (!authority) {
    return {
      ok: false,
      error: {
        code: "authority_context_missing",
        message: "Could not resolve Collection for merge artifact",
      },
    };
  }
  if (!actorMaySignAcceptedRisk(input.signer_id, authority.area_kind)) {
    return {
      ok: false,
      error: {
        code: "forbidden",
        message:
          authority.area_kind === "manuals"
            ? "Only Collection stewards (or Owner) may sign Accepted Risk on Manual RFCs"
            : "Only Owner may sign Accepted Risk on Canon RFCs",
      },
    };
  }

  if (authority.area_kind === "manuals") {
    const identity = await getUserIdentity(input.signer_id);
    const eligibility = evaluateStewardEligibility({
      actor_id: input.signer_id,
      country_code: authority.country_code,
      identity,
      require_manual_country: true,
    });
    if (!eligibility.ok) {
      const code =
        eligibility.code === "not_steward_role" ||
        eligibility.code === "unknown_user"
          ? "identity_unverified"
          : eligibility.code;
      return {
        ok: false,
        error: { code, message: eligibility.message },
      };
    }
  }

  const blockers = await listOpenCriticalFindingsForMerge({
    threadId: input.thread_id,
    mergeArtifactId: thread.mergeArtifactId,
  });

  // Only flip Findings whose context is this leaf RFC (originating thread or
  // explicit thread target). Artifact-targeted Criticals stay open so other
  // leaves merging the same artifact still need their own Accepted Risk.
  const findingsToAccept = blockers.filter(
    (f) =>
      f.thread_id === input.thread_id ||
      f.targets.some(
        (t) => t.target_kind === "thread" && t.target_id === input.thread_id,
      ),
  );

  const acceptedRiskId =
    input.accepted_risk_id?.trim() || `ar-${randomUUID()}`;
  const signedAt = input.signed_at ? new Date(input.signed_at) : new Date();

  const findingIds = findingsToAccept.map((f) => f.finding_id);

  await prisma.$transaction(async (tx) => {
    await tx.acceptedRisk.create({
      data: {
        acceptedRiskId,
        threadId: input.thread_id,
        description: input.description.trim(),
        rationale: input.rationale.trim(),
        evidenceConsidered: input.evidence_considered?.trim() || null,
        reopenTriggers: input.reopen_triggers?.trim() || null,
        signerId: input.signer_id,
        signedAt,
      },
    });
    if (findingIds.length > 0) {
      await tx.finding.updateMany({
        where: { findingId: { in: findingIds } },
        data: { status: "accepted_risk" },
      });
    }
    await tx.threadPost.create({
      data: {
        postId: randomUUID(),
        threadId: input.thread_id,
        authorId: input.signer_id,
        type: "comment",
        body: `Accepted Risk signed by ${input.signer_id}.${
          findingIds.length > 0
            ? ` Critical Finding(s) marked accepted_risk: ${findingIds.join(", ")}.`
            : ""
        } ${input.description.trim()}`,
        createdAt: signedAt,
      },
    });
  });

  const row = await prisma.acceptedRisk.findUniqueOrThrow({
    where: { acceptedRiskId },
  });
  const accepted_risk = mapAcceptedRisk(row);
  await appendAuditLog({
    action: "accepted_risk",
    actor_id: input.signer_id,
    subject_id: input.thread_id,
    payload: {
      accepted_risk_id: acceptedRiskId,
      merge_artifact_id: thread.mergeArtifactId,
      findings_updated: findingIds,
      description: input.description.trim(),
    },
  });
  return {
    ok: true,
    accepted_risk,
    findings_updated: findingIds,
  };
}

export {
  listFindings,
  getFinding,
  createFinding,
  listOpenCriticalFindingsForMerge,
  getAcceptedRiskForThread,
  listCandidateFindings,
  getCandidateFinding,
  flagCandidateFinding,
  promoteCandidateFinding,
  mapAcceptedRisk,
  type FindingTargetRow,
  type FindingRow,
  type CandidateFindingRow,
  type AcceptedRiskRow,
  type CreateFindingInput,
  type CreateFindingError,
  type FlagCandidateInput,
  type FlagCandidateError,
  type PromoteCandidateInput,
  type PromoteCandidateError,
} from "./db/findingsDb";
export {
  resolveClaimOwnerContext,
  listClaims,
  getClaim,
  createClaim,
  requestClaimAdjudication,
  adjudicateClaim,
  listAdjudicationQueue,
  type ClaimRow,
  type CreateClaimError,
  type RequestAdjudicationError,
  type AdjudicateClaimError,
} from "./db/claimsDb";
export { setPrisma, getPrisma, reloadRoleOverrides } from "./db/prisma";
export {
  getAttributions,
  putAttributions,
  getTerms,
  putTerms,
  type RegistryPayload,
} from "./db/registries";
export { searchCorpus } from "./db/search";
export {
  appendAuditLog,
  listAuditLogs,
  listActiveBoardHides,
  listBoardHides,
  hideUserFromBoards,
  liftBoardHide,
  listEffectiveUsers,
  changeUserRoles,
  type AuditLogRow,
  type BoardHideRow,
  type BoardHideMutationError,
  type RoleChangeMutationError,
  type EffectiveUserRow,
} from "./db/moderationDb";
export {
  listUserIdentities,
  getUserIdentity,
  resolveUserIdentity,
  requestIdentityVerification,
  attestUserIdentity,
  getStewardEligibilityForUser,
  type IdentityMutationError,
} from "./db/identities";
