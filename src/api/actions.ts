import type { ArtifactRevisionRow, ArtifactRow } from "@/doc/types";
import { artifactIdOf } from "@/doc/types";

import { saveRevisionInput, type SaveRevisionInput } from "./schemas";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: unknown };

export function toUserMessage(err: unknown): string {
  if (err == null) return "Unknown error";
  if (typeof err === "string") return err;
  if (typeof err === "object" && err !== null && "message" in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed (${response.status})`);
  }
  return (await response.json()) as T;
}

/**
 * Editor save — chains revision POST + artifact PATCH.
 * Prefers `/api/artifacts`; API returns dual-emit JSON.
 */
export async function saveRevision(
  rawInput: SaveRevisionInput | unknown,
): Promise<ActionResult<ArtifactRow>> {
  const parsed = saveRevisionInput.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: parsed.error };
  }

  const { artifactId, revision, nextCurrentRevisionId } = parsed.data;

  try {
    const created = await readJson<ArtifactRevisionRow>(
      await fetch(`${API_BASE}/artifacts/${artifactId}/revisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(revision),
      }),
    );

    const updated = await readJson<ArtifactRow>(
      await fetch(`${API_BASE}/artifacts/${artifactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ current_revision_id: nextCurrentRevisionId }),
      }),
    );

    return {
      ok: true,
      data: {
        ...updated,
        artifact_id: artifactIdOf(updated) || artifactId,
        page_id: artifactIdOf(updated) || artifactId,
        current_revision_id: created.revision_id,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        kind: "network",
        code: "fetch_failed",
        message: error instanceof Error ? error.message : String(error),
        retryable: true,
      },
    };
  }
}
