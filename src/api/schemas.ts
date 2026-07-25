import { z } from 'zod';

const blockRowSchema = z.object({
  block_id: z.string(),
  type: z.string(),
  order: z.number(),
  hash: z.string(),
  text_preview: z.string()
});

export const pageRevisionSchema = z.object({
  revision_id: z.string(),
  page_id: z.string(),
  parent_revision_id: z.string().nullable(),
  created_at: z.string(),
  author: z.string(),
  content_json: z.unknown(),
  blocks: z.array(blockRowSchema),
  doc_root_hash: z.string(),
  note: z.string().optional(),
  schema_version: z.number()
});

export const saveRevisionInput = z.object({
  pageId: z.string(),
  revision: pageRevisionSchema,
  nextCurrentRevisionId: z.string()
});

export type SaveRevisionInput = z.infer<typeof saveRevisionInput>;
