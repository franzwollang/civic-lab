import { z } from 'zod';

const blockRowSchema = z.object({
  block_id: z.string(),
  type: z.string(),
  order: z.number(),
  hash: z.string(),
  text_preview: z.string()
});

/**
 * Accept `artifact_id` and/or legacy `page_id`; require at least one.
 * Normalize so both fields are present and equal after parse.
 */
export const pageRevisionSchema = z
  .object({
    revision_id: z.string().min(1),
    artifact_id: z.string().min(1).optional(),
    page_id: z.string().min(1).optional(),
    parent_revision_id: z.string().nullable(),
    created_at: z.string(),
    author: z.string(),
    content_json: z.array(z.unknown()),
    blocks: z.array(blockRowSchema),
    doc_root_hash: z.string(),
    note: z.string().optional(),
    schema_version: z.number()
  })
  .superRefine((data, ctx) => {
    if (!data.artifact_id && !data.page_id) {
      ctx.addIssue({
        code: 'custom',
        message: 'artifact_id or page_id is required',
        path: ['artifact_id']
      });
    }
    if (
      data.artifact_id &&
      data.page_id &&
      data.artifact_id !== data.page_id
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'artifact_id and page_id must match when both are set',
        path: ['artifact_id']
      });
    }
  })
  .transform((data) => {
    const id = data.artifact_id || data.page_id!;
    return {
      ...data,
      artifact_id: id,
      page_id: id
    };
  });

export const saveRevisionInput = z.object({
  pageId: z.string().optional(),
  artifactId: z.string().optional(),
  revision: pageRevisionSchema,
  nextCurrentRevisionId: z.string()
}).superRefine((data, ctx) => {
  if (!data.artifactId && !data.pageId) {
    ctx.addIssue({
      code: 'custom',
      message: 'artifactId or pageId is required',
      path: ['artifactId']
    });
  }
}).transform((data) => {
  const id = data.artifactId || data.pageId!;
  return {
    ...data,
    artifactId: id,
    pageId: id
  };
});

export type SaveRevisionInput = z.infer<typeof saveRevisionInput>;
