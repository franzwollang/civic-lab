export type BlockRow = {
  block_id: string;
  type: string;
  order: number;
  hash: string;
  text_preview: string;
};

/**
 * Wire revision row. `page_id` is the artifact id (Prisma `Artifact.artifactId`
 * mapped to column `page_id`). Prefer Artifact* names in new code.
 */
export type ArtifactRevisionRow = {
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

/** @deprecated Prefer ArtifactRevisionRow */
export type PageRevisionRow = ArtifactRevisionRow;

/** Wire artifact meta. `page_id` ≡ artifact id until clients migrate. */
export type ArtifactRow = {
  page_id: string;
  title: string;
  slug: string;
  current_revision_id: string | null;
  created_at: string;
};

/** @deprecated Prefer ArtifactRow */
export type PageRow = ArtifactRow;

/** `page_id` on the wire is the artifact id. */
export function artifactIdOf(row: { page_id: string }): string {
  return row.page_id;
}
