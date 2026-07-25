import { ok } from 'dullahan-web/client';
import type { RemoteHandler } from 'dullahan-web/remote';
import { serverActionValidationFail } from 'dullahan-web/client';

import type { PageRevisionRow, PageRow } from '@/doc/types';

import { saveRevisionInput, type SaveRevisionInput } from './schemas';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8787/api';

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed (${response.status})`);
  }
  return (await response.json()) as T;
}

/**
 * Committed finalizer for editor save — chains revision POST + page PATCH.
 * Express returns raw JSON today; wrapped into DullahanResult here.
 */
export const saveRevisionRemote: RemoteHandler<SaveRevisionInput, PageRow> = async (
  rawInput
) => {
  const parsed = saveRevisionInput.safeParse(rawInput);
  if (!parsed.success) {
    return serverActionValidationFail(parsed.error);
  }

  const { pageId, revision, nextCurrentRevisionId } = parsed.data;

  try {
    const created = await readJson<PageRevisionRow>(
      await fetch(`${API_BASE}/pages/${pageId}/revisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(revision)
      })
    );

    const updated = await readJson<PageRow>(
      await fetch(`${API_BASE}/pages/${pageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_revision_id: nextCurrentRevisionId })
      })
    );

    return ok({ ...updated, current_revision_id: created.revision_id });
  } catch (error) {
    return {
      ok: false,
      error: {
        kind: 'network',
        code: 'fetch_failed',
        message: error instanceof Error ? error.message : String(error),
        retryable: true
      }
    };
  }
};
