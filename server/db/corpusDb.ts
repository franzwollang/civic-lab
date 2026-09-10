/**
 * Area / Collection / Dossier + CONCEPT §11 Collection dashboard data access.
 * createAcceptedRisk stays in server/db.ts (merge-authority bridge).
 */
import {
  computeEmpiricalQuality,
  computeForecastAccuracy,
  computeRequirementSatisfactionSnapshot,
} from "../../src/lib/claimMetrics";
import {
  computeReputationBoard,
  type ReputationSignalEvent,
} from "../../src/lib/reputation";
import { getPrototypeUser } from "../../src/app/lib/prototype-users";
import { isOpenCriticalFinding } from "../../src/lib/findings";
import { getPrisma } from "./prisma";
import {
  listActiveBoardHides,
  type BoardHideRow,
} from "./moderationDb";

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
  /** Present when API joins collection → area (M8 breadcrumbs). */
  area_id?: string | null;
  area_kind?: "canon" | "manuals" | null;
  area_title?: string | null;
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
 * Query prisma.thread directly — do not import threadsDb (cycle risk).
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
