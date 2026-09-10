/**
 * Findings / Accepted Risk / Candidate Finding data access (CONCEPT §7).
 * createAcceptedRisk stays in server/db.ts — it needs resolveMergeAuthorityForArtifact.
 */
import { randomUUID } from "crypto";
import {
  actorMayCreateFinding,
  isFindingSeverity,
  isFindingStatus,
  isFindingTargetKind,
} from "../../src/lib/findings";
import {
  actorMayFlagCandidate,
  actorMayPromoteCandidate,
  isCandidateStatus,
} from "../../src/lib/candidateFindings";
import { getPrisma } from "./prisma";

/** CONCEPT §7.6 Accepted Risk wire shape. */
export type AcceptedRiskRow = {
  accepted_risk_id: string;
  thread_id: string;
  description: string;
  rationale: string;
  evidence_considered: string | null;
  reopen_triggers: string | null;
  signer_id: string;
  signed_at: string;
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
  source_post_id: string | null;
  source_candidate_id: string | null;
  /** Present when listed with home-dossier join (mod queue / Collection scope). */
  home_dossier_id?: string | null;
  home_dossier_title?: string | null;
};

/** CONCEPT §7.4 Candidate Finding wire shape. */
export type CandidateFindingRow = {
  candidate_id: string;
  thread_id: string;
  post_id: string;
  flagger_id: string;
  note: string | null;
  status: string;
  promoted_finding_id: string | null;
  created_at: string;
};

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
  sourcePostId?: string | null;
  sourceCandidateId?: string | null;
  targets?: { targetKind: string; targetId: string }[];
  thread?: {
    homeDossierId: string;
    homeDossier?: { title: string } | null;
  } | null;
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
    source_post_id: row.sourcePostId ?? null,
    source_candidate_id: row.sourceCandidateId ?? null,
    home_dossier_id: row.thread?.homeDossierId ?? null,
    home_dossier_title: row.thread?.homeDossier?.title ?? null,
  };
}

function mapCandidateFinding(row: {
  candidateId: string;
  threadId: string;
  postId: string;
  flaggerId: string;
  note: string | null;
  status: string;
  promotedFindingId: string | null;
  createdAt: Date;
}): CandidateFindingRow {
  return {
    candidate_id: row.candidateId,
    thread_id: row.threadId,
    post_id: row.postId,
    flagger_id: row.flaggerId,
    note: row.note,
    status: row.status,
    promoted_finding_id: row.promotedFindingId,
    created_at: row.createdAt.toISOString(),
  };
}

const findingHomeInclude = {
  targets: true,
  thread: {
    select: {
      homeDossierId: true,
      homeDossier: { select: { title: true } },
    },
  },
} as const;

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
    include: findingHomeInclude,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(mapFinding);
}

export async function getFinding(
  findingId: string,
): Promise<FindingRow | null> {
  const row = await getPrisma().finding.findUnique({
    where: { findingId },
    include: findingHomeInclude,
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
  source_post_id?: string | null;
  source_candidate_id?: string | null;
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
      sourcePostId: input.source_post_id ?? null,
      sourceCandidateId: input.source_candidate_id ?? null,
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
 * Merge is allowed when an AcceptedRisk exists on the leaf (see decideThread).
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

export function mapAcceptedRisk(row: {
  acceptedRiskId: string;
  threadId: string;
  description: string;
  rationale: string;
  evidenceConsidered: string | null;
  reopenTriggers: string | null;
  signerId: string;
  signedAt: Date;
}): AcceptedRiskRow {
  return {
    accepted_risk_id: row.acceptedRiskId,
    thread_id: row.threadId,
    description: row.description,
    rationale: row.rationale,
    evidence_considered: row.evidenceConsidered,
    reopen_triggers: row.reopenTriggers,
    signer_id: row.signerId,
    signed_at: row.signedAt.toISOString(),
  };
}

export async function getAcceptedRiskForThread(
  threadId: string,
): Promise<AcceptedRiskRow | null> {
  const row = await getPrisma().acceptedRisk.findUnique({
    where: { threadId },
  });
  return row ? mapAcceptedRisk(row) : null;
}

export async function listCandidateFindings(opts?: {
  threadId?: string;
  status?: string;
}): Promise<CandidateFindingRow[]> {
  const rows = await getPrisma().candidateFinding.findMany({
    where: {
      ...(opts?.threadId ? { threadId: opts.threadId } : {}),
      ...(opts?.status ? { status: opts.status } : {}),
    },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(mapCandidateFinding);
}

export async function getCandidateFinding(
  candidateId: string,
): Promise<CandidateFindingRow | null> {
  const row = await getPrisma().candidateFinding.findUnique({
    where: { candidateId },
  });
  return row ? mapCandidateFinding(row) : null;
}

export type FlagCandidateInput = {
  candidate_id?: string;
  thread_id: string;
  post_id: string;
  flagger_id: string;
  note?: string | null;
  created_at?: string;
};

export type FlagCandidateError =
  | { code: "not_found"; message: string }
  | { code: "forbidden"; message: string }
  | { code: "already_flagged"; message: string }
  | { code: "post_thread_mismatch"; message: string };

/**
 * CONCEPT §7.4 — any prototype user may flag a post as a Candidate Finding.
 */
export async function flagCandidateFinding(
  input: FlagCandidateInput,
): Promise<
  | { ok: true; candidate: CandidateFindingRow }
  | { ok: false; error: FlagCandidateError }
> {
  if (!actorMayFlagCandidate(input.flagger_id)) {
    return {
      ok: false,
      error: {
        code: "forbidden",
        message: "Unknown acting user cannot flag candidates",
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

  const post = await getPrisma().threadPost.findUnique({
    where: { postId: input.post_id },
  });
  if (!post) {
    return {
      ok: false,
      error: { code: "not_found", message: "Post not found" },
    };
  }
  if (post.threadId !== input.thread_id) {
    return {
      ok: false,
      error: {
        code: "post_thread_mismatch",
        message: "Post does not belong to this thread",
      },
    };
  }

  const existing = await getPrisma().candidateFinding.findUnique({
    where: { postId: input.post_id },
  });
  if (existing) {
    return {
      ok: false,
      error: {
        code: "already_flagged",
        message: "Post is already flagged as a Candidate Finding",
      },
    };
  }

  const candidateId =
    input.candidate_id?.trim() || `candidate-${randomUUID()}`;
  const createdAt = input.created_at
    ? new Date(input.created_at)
    : new Date();

  const row = await getPrisma().candidateFinding.create({
    data: {
      candidateId,
      threadId: input.thread_id,
      postId: input.post_id,
      flaggerId: input.flagger_id,
      note: input.note?.trim() || null,
      status: "open",
      createdAt,
    },
  });

  return { ok: true, candidate: mapCandidateFinding(row) };
}

export type PromoteCandidateInput = {
  candidate_id: string;
  author_id: string;
  title?: string;
  severity: string;
  likelihood?: string | null;
  evidence?: string | null;
  attack_path?: string | null;
  status?: string;
  finding_id?: string;
  targets?: { target_kind: string; target_id: string }[];
};

export type PromoteCandidateError =
  | { code: "not_found"; message: string }
  | { code: "forbidden"; message: string }
  | { code: "not_open"; message: string; status: string }
  | { code: "invalid_severity"; message: string }
  | { code: "invalid_status"; message: string }
  | { code: "invalid_target"; message: string };

/**
 * CONCEPT §7.4 — Red Team promotes an open Candidate into a Finding.
 * Provenance: Finding.source_post_id + source_candidate_id; candidate.promoted_finding_id.
 */
export async function promoteCandidateFinding(
  input: PromoteCandidateInput,
): Promise<
  | {
      ok: true;
      finding: FindingRow;
      candidate: CandidateFindingRow;
    }
  | { ok: false; error: PromoteCandidateError }
> {
  if (!actorMayPromoteCandidate(input.author_id)) {
    return {
      ok: false,
      error: {
        code: "forbidden",
        message: "Only Red Team members may promote Candidate Findings",
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

  const candidate = await getPrisma().candidateFinding.findUnique({
    where: { candidateId: input.candidate_id },
    include: { post: true },
  });
  if (!candidate) {
    return {
      ok: false,
      error: { code: "not_found", message: "Candidate Finding not found" },
    };
  }
  if (candidate.status !== "open") {
    return {
      ok: false,
      error: {
        code: "not_open",
        message: `Candidate is ${candidate.status}, not open`,
        status: candidate.status,
      },
    };
  }
  if (!isCandidateStatus(candidate.status)) {
    // defensive; open path already handled
  }

  const targets = input.targets ?? [
    { target_kind: "thread", target_id: candidate.threadId },
  ];
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
  const title =
    input.title?.trim() ||
    `Promoted candidate: ${candidate.post.body.slice(0, 80)}`;
  const evidence =
    input.evidence?.trim() ||
    `Promoted from post ${candidate.postId} (flagged by ${candidate.flaggerId}).${
      candidate.note ? ` Flag note: ${candidate.note}` : ""
    }\n\nSource post:\n${candidate.post.body}`;

  const created = await getPrisma().$transaction(async (tx) => {
    const finding = await tx.finding.create({
      data: {
        findingId,
        threadId: candidate.threadId,
        title,
        severity: input.severity,
        likelihood: input.likelihood ?? null,
        status,
        evidence,
        attackPath: input.attack_path ?? null,
        authorId: input.author_id,
        createdAt: new Date(),
        sourcePostId: candidate.postId,
        sourceCandidateId: candidate.candidateId,
        targets: {
          create: targets.map((t) => ({
            targetKind: t.target_kind,
            targetId: t.target_id,
          })),
        },
      },
      include: { targets: true },
    });

    const updatedCandidate = await tx.candidateFinding.update({
      where: { candidateId: candidate.candidateId },
      data: {
        status: "promoted",
        promotedFindingId: findingId,
      },
    });

    return { finding, updatedCandidate };
  });

  return {
    ok: true,
    finding: mapFinding(created.finding),
    candidate: mapCandidateFinding(created.updatedCandidate),
  };
}
