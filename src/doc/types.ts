export type BlockRow = {
  block_id: string;
  type: string;
  order: number;
  hash: string;
  text_preview: string;
};

/**
 * Wire JSON still uses `page_id` (Prisma `pages` table) until the M4 schema
 * rename. CONCEPT calls this an Artifact — prefer Artifact* aliases in new code.
 */
export type PageRevisionRow = {
  revision_id: string;
  page_id: string;
  parent_revision_id: string | null;
  created_at: string;
  author: string;
  content_json: unknown;
  blocks: BlockRow[];
  doc_root_hash: string;
  note?: string;
  schema_version: number;
};

export type PageRow = {
  page_id: string;
  title: string;
  slug: string;
  current_revision_id: string | null;
  created_at: string;
};

/** CONCEPT Artifact — same wire shape as PageRow (`page_id` ≡ artifact id). */
export type ArtifactRow = PageRow;

/** CONCEPT ArtifactRevision — same wire shape as PageRevisionRow. */
export type ArtifactRevisionRow = PageRevisionRow;

/** `page_id` on the wire is the artifact id until Prisma rename. */
export function artifactIdOf(row: { page_id: string }): string {
  return row.page_id;
}
