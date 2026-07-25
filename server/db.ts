/**
 * Prisma-backed data access for the Express API.
 * JSON helpers under `db/` were retired in M1; seeds live in `prisma/seed/`.
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

export type PageRow = {
  page_id: string;
  title: string;
  slug: string;
  current_revision_id: string | null;
  created_at: string;
};

export type RevisionRow = {
  revision_id: string;
  page_id: string;
  parent_revision_id: string | null;
  created_at: string;
  author: string;
  content_json: unknown;
};

export type RegistryPayload = {
  version: number;
  items: unknown[];
};

function mapPage(row: {
  pageId: string;
  title: string;
  slug: string;
  currentRevisionId: string | null;
  createdAt: Date;
}): PageRow {
  return {
    page_id: row.pageId,
    title: row.title,
    slug: row.slug,
    current_revision_id: row.currentRevisionId,
    created_at: row.createdAt.toISOString(),
  };
}

function mapRevision(row: {
  revisionId: string;
  pageId: string;
  parentRevisionId: string | null;
  createdAt: Date;
  author: string;
  contentJson: unknown;
}): RevisionRow {
  return {
    revision_id: row.revisionId,
    page_id: row.pageId,
    parent_revision_id: row.parentRevisionId,
    created_at: row.createdAt.toISOString(),
    author: row.author,
    content_json: row.contentJson,
  };
}

export async function listPages(): Promise<PageRow[]> {
  const rows = await getPrisma().page.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map(mapPage);
}

export async function getPage(pageId: string): Promise<PageRow | null> {
  const row = await getPrisma().page.findUnique({ where: { pageId } });
  return row ? mapPage(row) : null;
}

export async function updatePage(
  pageId: string,
  patch: Partial<{
    title: string;
    slug: string;
    current_revision_id: string | null;
  }>,
): Promise<PageRow | null> {
  const existing = await getPrisma().page.findUnique({ where: { pageId } });
  if (!existing) return null;

  const row = await getPrisma().page.update({
    where: { pageId },
    data: {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.slug !== undefined ? { slug: patch.slug } : {}),
      ...(patch.current_revision_id !== undefined
        ? { currentRevisionId: patch.current_revision_id }
        : {}),
    },
  });
  return mapPage(row);
}

export async function listRevisions(pageId: string): Promise<RevisionRow[]> {
  const rows = await getPrisma().pageRevision.findMany({
    where: { pageId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(mapRevision);
}

export async function createRevision(payload: {
  revision_id: string;
  page_id: string;
  parent_revision_id?: string | null;
  created_at?: string;
  author: string;
  content_json: unknown;
}): Promise<RevisionRow> {
  const row = await getPrisma().pageRevision.create({
    data: {
      revisionId: payload.revision_id,
      pageId: payload.page_id,
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
