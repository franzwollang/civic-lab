export type BlockRow = {
  block_id: string;
  type: string;
  order: number;
  hash: string;
  text_preview: string;
};

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
