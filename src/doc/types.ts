export type BlockRow = {
  block_id: string;
  type: string;
  order: number;
  hash: string;
  text_preview: string;
};

/**
 * Wire revision row. Dual-emits `artifact_id` (preferred) and legacy `page_id`
 * (same value = Prisma `Artifact.artifactId` @map `page_id`).
 */
export type ArtifactRevisionRow = {
  revision_id: string;
  /** Preferred CONCEPT id on the wire. */
  artifact_id: string;
  /** @deprecated Prefer artifact_id — kept for cutover clients. */
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

/** Wire artifact meta. Dual-emits `artifact_id` + legacy `page_id`. */
export type ArtifactRow = {
  /** Preferred CONCEPT id on the wire. */
  artifact_id: string;
  /** @deprecated Prefer artifact_id — kept for cutover clients. */
  page_id: string;
  title: string;
  slug: string;
  current_revision_id: string | null;
  created_at: string;
};

/** @deprecated Prefer ArtifactRow */
export type PageRow = ArtifactRow;

/**
 * Resolve the artifact id from a wire row that may carry either field
 * (older responses may only have `page_id`).
 */
export function artifactIdOf(row: {
  artifact_id?: string | null;
  page_id?: string | null;
}): string {
  return row.artifact_id || row.page_id || "";
}
