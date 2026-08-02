/**
 * Artifact / revision / section data access (CONCEPT §2 / §4 / §9.3 revert).
 */
import {
  extractSectionsFromContent,
  sectionIdFor,
} from "../../src/doc/sections";
import {
  artifactIdsFromClaimLinks,
  computeSoftLaneLabel,
  validateLaneOnCreate,
  validateLaneOnPatch,
  type LaneRuleError,
  type SoftLaneLabel,
} from "../../src/lib/artifactLanes";
import {
  validateCanonRevert,
  type CanonRevertErrorCode,
} from "../../src/lib/canonRevert";
import { getPrisma } from "./prisma";
import { appendAuditLog, type AuditLogRow } from "./moderationDb";

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

/** CONCEPT §2.3 Section wire shape. */
export type SectionRow = {
  section_id: string;
  artifact_id: string;
  stable_key: string;
  title: string;
  level: number;
  order: number;
};

export type CreateArtifactError =
  | { code: "dossier_not_found" }
  | { code: "duplicate_id" }
  | LaneRuleError;

export type UpdateArtifactError =
  | { code: "not_found" }
  | LaneRuleError;

export type RevertCanonArtifactError = {
  code: CanonRevertErrorCode;
  message?: string;
};

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

export async function listArtifactsByDossier(
  dossierId: string,
): Promise<ArtifactRow[]> {
  const rows = await getPrisma().artifact.findMany({
    where: { dossierId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(mapArtifact);
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
