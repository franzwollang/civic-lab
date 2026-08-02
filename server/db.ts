/**
 * Prisma-backed data access for the Hono API.
 * Domain models are Artifact / ArtifactRevision; SQLite tables remain
 * `pages` / `page_revisions` via Prisma @@map. Wire JSON dual-emits
 * `artifact_id` (preferred) and legacy `page_id` (same value).
 *
 * Artifact CRUD / revisions / sections live in `server/db/artifactsDb.ts`.
 * Thread / RFC / RevSet / decide live in `server/db/threadsDb.ts`.
 */
import {
  computeEmpiricalQuality,
  computeForecastAccuracy,
  computeRequirementSatisfactionSnapshot,
} from "../src/lib/claimMetrics";
import {
  computeReputationBoard,
  type ReputationSignalEvent,
} from "../src/lib/reputation";
import { getPrototypeUser } from "../src/app/lib/prototype-users";
import { randomUUID } from "crypto";
import { getPrisma } from "./db/prisma";
import {
  appendAuditLog,
  listActiveBoardHides,
  type BoardHideRow,
} from "./db/moderationDb";
import { getUserIdentity } from "./db/identities";
import { evaluateStewardEligibility } from "../src/lib/identityPolicy";
import { isOpenCriticalFinding } from "../src/lib/findings";
import { actorMaySignAcceptedRisk } from "../src/lib/acceptedRisk";
import {
  listOpenCriticalFindingsForMerge,
  mapAcceptedRisk,
  type AcceptedRiskRow,
} from "./db/findingsDb";
import { resolveMergeAuthorityForArtifact } from "./db/threadsDb";

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
export {
  resolveSoftLaneLabel,
  listArtifactsByDossier,
  listArtifacts,
  listPages,
  getArtifact,
  getPage,
  createArtifact,
  updateArtifact,
  updatePage,
  revertCanonArtifact,
  listArtifactRevisions,
  listRevisions,
  syncSectionsForArtifact,
  listSections,
  getSection,
  createArtifactRevision,
  createRevision,
  type ArtifactRow,
  type PageRow,
  type ArtifactRevisionRow,
  type RevisionRow,
  type SectionRow,
  type CreateArtifactError,
  type UpdateArtifactError,
  type RevertCanonArtifactError,
} from "./db/artifactsDb";
export {
  listThreads,
  getThread,
  resolveMergeAuthorityForArtifact,
  listRevSets,
  promoteThreadToRfc,
  createRevSet,
  createThreadPost,
  softDeleteThreadPost,
  decideThread,
  type ThreadTargetRow,
  type ThreadPostRow,
  type ThreadChildSummary,
  type ThreadRow,
  type RevSetRow,
  type PromoteThreadError,
  type CreateRevSetError,
  type CreateThreadPostError,
  type SoftDeletePostError,
  type DecisionOutcome,
  type DecideThreadError,
} from "./db/threadsDb";
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
