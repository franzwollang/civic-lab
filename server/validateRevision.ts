/**
 * Server-side revision validation for POST /api/artifacts/:id/revisions
 * (and legacy /api/pages/:pageId/revisions).
 * Zod envelope (pageRevisionSchema) + structural document checks.
 * Accepts dual-emit `artifact_id` / `page_id` (same value after normalize).
 */
import { pageRevisionSchema } from "../src/api/schemas";
import {
  validateDocumentStructure,
  type StructuralIssue,
  type StructuralValidationRegistry,
} from "../src/doc/structuralValidation";
import { getAttributions, getTerms } from "./db";

export type RevisionValidationFailure = {
  ok: false;
  error: string;
  issues: StructuralIssue[];
};

/** Normalized revision after Zod transform (both id fields present). */
export type NormalizedRevision = {
  revision_id: string;
  artifact_id: string;
  page_id: string;
  parent_revision_id: string | null;
  created_at: string;
  author: string;
  content_json: unknown[];
  blocks: Array<{
    block_id: string;
    type: string;
    order: number;
    hash: string;
    text_preview: string;
  }>;
  doc_root_hash: string;
  note?: string;
  schema_version: number;
};

export type RevisionValidationResult =
  | { ok: true; revision: NormalizedRevision }
  | RevisionValidationFailure;

async function loadRegistry(): Promise<StructuralValidationRegistry> {
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

/**
 * Validate a create-revision POST body against Zod schema + document structure.
 * Warnings do not fail (matches client save gating on errors only).
 */
export async function validateRevisionPayload(
  routeArtifactId: string,
  body: unknown,
): Promise<RevisionValidationResult> {
  const parsed = pageRevisionSchema.safeParse(body);
  if (!parsed.success) {
    const issues: StructuralIssue[] = parsed.error.issues.map((issue) => ({
      code: String(issue.code),
      message: issue.message,
      path: issue.path as Array<string | number>,
      severity: "error" as const,
    }));
    return {
      ok: false,
      error: "Invalid revision payload",
      issues,
    };
  }

  const revision = parsed.data as NormalizedRevision;
  if (revision.artifact_id !== routeArtifactId) {
    return {
      ok: false,
      error: "Invalid revision payload",
      issues: [
        {
          code: "custom",
          message: "artifact_id (or page_id) must match URL parameter",
          path: ["artifact_id"],
          severity: "error",
        },
      ],
    };
  }

  const registry = await loadRegistry();
  const structural = validateDocumentStructure(revision.content_json, {
    registry,
  });

  if (!structural.success) {
    return {
      ok: false,
      error: "Revision content failed structural validation",
      issues: structural.issues.filter((issue) => issue.severity === "error"),
    };
  }

  return { ok: true, revision };
}
