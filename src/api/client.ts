import type { PageRevisionRow, PageRow } from "../doc/types";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8787/api";

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Request failed");
  }
  return (await response.json()) as T;
}

export async function getPages(): Promise<PageRow[]> {
  const response = await fetch(`${API_BASE}/pages`);
  return handleResponse<PageRow[]>(response);
}

export async function getPage(pageId: string): Promise<PageRow> {
  const response = await fetch(`${API_BASE}/pages/${pageId}`);
  return handleResponse<PageRow>(response);
}

export async function getRevisions(pageId: string): Promise<PageRevisionRow[]> {
  const response = await fetch(`${API_BASE}/pages/${pageId}/revisions`);
  return handleResponse<PageRevisionRow[]>(response);
}

export async function createRevision(
  pageId: string,
  revision: PageRevisionRow,
): Promise<PageRevisionRow> {
  const response = await fetch(`${API_BASE}/pages/${pageId}/revisions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(revision),
  });
  return handleResponse<PageRevisionRow>(response);
}

export async function updatePage(
  pageId: string,
  patch: Partial<PageRow>,
): Promise<PageRow> {
  const response = await fetch(`${API_BASE}/pages/${pageId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return handleResponse<PageRow>(response);
}
