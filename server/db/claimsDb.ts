/**
 * Claims / adjudication data access (CONCEPT §5 / §8.3).
 */
import { randomUUID } from "crypto";
import {
  validateClaimAgainstOwner,
  type ClaimDraftInput,
  type ClaimLegalityError,
  type ClaimOwnerContext,
} from "../../src/lib/claimLegality";
import {
  isAdjudicationPending,
  validateAdjudicate,
  validateRequestAdjudication,
  type AdjudicationError,
} from "../../src/lib/claimAdjudication";
import { getPrisma } from "./prisma";
import { appendAuditLog } from "./moderationDb";

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

  const claimId = input.claim_id ?? randomUUID();
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
  const claim = mapClaim(row);
  await appendAuditLog({
    action: "adjudication",
    actor_id: input.author_id,
    subject_id: input.claim_id,
    payload: {
      prior_status: existing.status,
      status: input.status,
      profile: existing.profile,
      rationale: input.rationale.trim(),
    },
  });
  if (existing.status !== input.status) {
    await appendAuditLog({
      action: "claim_status_change",
      actor_id: input.author_id,
      subject_id: input.claim_id,
      payload: {
        prior_status: existing.status,
        status: input.status,
        via: "adjudication",
      },
    });
  }
  return { ok: true, claim };
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
