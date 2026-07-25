import type { PageRevisionRow, PageRow } from "../doc/types";
import type { AttributionRegistry, TermRegistry } from "../doc/evidence";

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

export async function getAttributions(): Promise<AttributionRegistry> {
  const response = await fetch(`${API_BASE}/attributions`);
  return handleResponse<AttributionRegistry>(response);
}

export async function getTerms(): Promise<TermRegistry> {
  const response = await fetch(`${API_BASE}/terms`);
  return handleResponse<TermRegistry>(response);
}

export async function putAttributions(
  registry: AttributionRegistry,
): Promise<AttributionRegistry> {
  const response = await fetch(`${API_BASE}/attributions`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(registry),
  });
  return handleResponse<AttributionRegistry>(response);
}

export async function putTerms(registry: TermRegistry): Promise<TermRegistry> {
  const response = await fetch(`${API_BASE}/terms`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(registry),
  });
  return handleResponse<TermRegistry>(response);
}
