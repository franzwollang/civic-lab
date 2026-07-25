/**
 * Server-side revision validation for POST /api/artifacts/:id/revisions
 * (and legacy /api/pages/:pageId/revisions).
 * Zod envelope (pageRevisionSchema) + structural document checks.
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

export type RevisionValidationSuccess = {
  ok: true;
  revision: ReturnType<typeof pageRevisionSchema.parse>;
};

export type RevisionValidationResult =
  | RevisionValidationSuccess
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
  pageId: string,
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

  const revision = parsed.data;
  if (revision.page_id !== pageId) {
    return {
      ok: false,
      error: "Invalid revision payload",
      issues: [
        {
          code: "custom",
          message: "page_id must match URL parameter",
          path: ["page_id"],
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
