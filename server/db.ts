/**
 * Prisma-backed data access for the Express API.
 * Domain models are Artifact / ArtifactRevision; SQLite tables remain
 * `pages` / `page_revisions` via Prisma @@map. Wire JSON dual-emits
 * `artifact_id` (preferred) and legacy `page_id` (same value).
 */
import type { PrismaClient } from "@prisma/client";

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

export async function listDossiers(
  collectionId?: string,
): Promise<DossierRow[]> {
  const rows = await getPrisma().dossier.findMany({
    where: collectionId ? { collectionId } : undefined,
    orderBy: { title: "asc" },
  });
  return rows.map(mapDossier);
}

export async function getDossier(dossierId: string): Promise<DossierRow | null> {
  const row = await getPrisma().dossier.findUnique({
    where: { dossierId },
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
