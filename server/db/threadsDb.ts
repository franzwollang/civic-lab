/**
 * Thread / RFC / RevSet / decide / merge-authority data access (CONCEPT §3).
 * createAcceptedRisk stays in server/db.ts — it imports resolveMergeAuthorityForArtifact from here.
 */
import { randomUUID } from "crypto";
import {
  actorMayDecide,
  buildMergeAuthoritySummary,
  classifyMergeAuthority,
  requiredRolesForClass,
  type AreaKind,
  type MergeAuthorityClass,
  type MergeAuthorityContext,
} from "../../src/lib/mergeAuthority";
import {
  validateSoftDeletePost,
  type SoftDeleteContext,
} from "../../src/lib/moderation";
import {
  actorMayPostTypedFindingOrMitigation,
  isRedTeamPostType,
  isTimelinePostType,
} from "../../src/lib/candidateFindings";
import { evaluateStewardEligibility } from "../../src/lib/identityPolicy";
import {
  getAcceptedRiskForThread,
  listOpenCriticalFindingsForMerge,
  type AcceptedRiskRow,
} from "./findingsDb";
import { syncSectionsForArtifact } from "./artifactsDb";
import { appendAuditLog, type AuditLogRow } from "./moderationDb";
import { getAttributions, getTerms } from "./registries";
import { getUserIdentity } from "./identities";
import { getPrisma } from "./prisma";
import {
  validateDocumentStructureForMerge,
  type StructuralIssue,
  type StructuralValidationRegistry,
} from "../../src/doc/structuralValidation";
import type { PrototypeRole } from "../../src/app/lib/prototype-users";

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
  /** Present on GET /api/threads/:id for up-nav (M8). */
  home_dossier_title?: string | null;
  collection_id?: string | null;
  collection_title?: string | null;
  area_kind?: AreaKind | null;
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
  const homeRow = await getPrisma().dossier.findUnique({
    where: { dossierId: row.homeDossierId },
    select: {
      title: true,
      collectionId: true,
      collection: {
        select: {
          title: true,
          area: { select: { kind: true } },
        },
      },
    },
  });
  if (homeRow) {
    mapped.home_dossier_title = homeRow.title;
    mapped.collection_id = homeRow.collectionId;
    mapped.collection_title = homeRow.collection?.title ?? null;
    const areaKindRaw = homeRow.collection?.area?.kind;
    mapped.area_kind =
      areaKindRaw === "manuals"
        ? "manuals"
        : areaKindRaw === "canon"
          ? "canon"
          : null;
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
            postId: randomUUID(),
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
          postId: randomUUID(),
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
        postId: randomUUID(),
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
    revisionId = randomUUID();
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
      revsetId: input.revset_id ?? randomUUID(),
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
      postId: input.post_id ?? randomUUID(),
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
          postId: randomUUID(),
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
          postId: randomUUID(),
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
        postId: randomUUID(),
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
