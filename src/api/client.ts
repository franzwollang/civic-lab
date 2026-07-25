import type {
  AreaRow,
  ArtifactRevisionRow,
  ArtifactRow,
  ClaimRow,
  CollectionDashboard,
  CollectionRow,
  DossierRow,
  PageRevisionRow,
  PageRow,
  RevSetRow,
  SectionRow,
  ThreadPostRow,
  ThreadRow,
} from "../doc/types";
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

/** CONCEPT naming — hits `/api/artifacts` (alias of `/api/pages`). */
export async function getArtifacts(): Promise<ArtifactRow[]> {
  const response = await fetch(`${API_BASE}/artifacts`);
  return handleResponse<ArtifactRow[]>(response);
}

export async function getArtifact(artifactId: string): Promise<ArtifactRow> {
  const response = await fetch(`${API_BASE}/artifacts/${artifactId}`);
  return handleResponse<ArtifactRow>(response);
}

export async function getArtifactRevisions(
  artifactId: string,
): Promise<ArtifactRevisionRow[]> {
  const response = await fetch(
    `${API_BASE}/artifacts/${artifactId}/revisions`,
  );
  return handleResponse<ArtifactRevisionRow[]>(response);
}

export async function createArtifactRevision(
  artifactId: string,
  revision: ArtifactRevisionRow,
): Promise<ArtifactRevisionRow> {
  const response = await fetch(
    `${API_BASE}/artifacts/${artifactId}/revisions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(revision),
    },
  );
  return handleResponse<ArtifactRevisionRow>(response);
}

export async function getArtifactSections(
  artifactId: string,
): Promise<SectionRow[]> {
  const response = await fetch(
    `${API_BASE}/artifacts/${artifactId}/sections`,
  );
  return handleResponse<SectionRow[]>(response);
}

export async function getSection(sectionId: string): Promise<SectionRow> {
  const response = await fetch(`${API_BASE}/sections/${sectionId}`);
  return handleResponse<SectionRow>(response);
}

export async function createArtifact(input: {
  artifact_id?: string;
  title: string;
  slug: string;
  dossier_id: string;
  lane?: string | null;
  owner_merge_only?: boolean;
  current_revision_id?: string | null;
  created_at?: string;
}): Promise<ArtifactRow> {
  const response = await fetch(`${API_BASE}/artifacts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return handleResponse<ArtifactRow>(response);
}

export async function updateArtifact(
  artifactId: string,
  patch: Partial<ArtifactRow>,
): Promise<ArtifactRow> {
  const response = await fetch(`${API_BASE}/artifacts/${artifactId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return handleResponse<ArtifactRow>(response);
}

/**
 * Resolve a route param that may be an artifact id or a slug
 * (e.g. `page-001` or `voting-systems`).
 */
export async function resolveArtifactRef(
  ref: string,
): Promise<ArtifactRow | null> {
  try {
    return await getArtifact(ref);
  } catch {
    // Fall through to slug lookup.
  }
  const artifacts = await getArtifacts();
  return (
    artifacts.find(
      (a) =>
        a.slug === ref ||
        a.artifact_id === ref ||
        a.page_id === ref,
    ) ?? null
  );
}

export async function getAreas(): Promise<AreaRow[]> {
  const response = await fetch(`${API_BASE}/areas`);
  return handleResponse<AreaRow[]>(response);
}

export async function getCollections(opts?: {
  areaId?: string;
  kind?: string;
}): Promise<CollectionRow[]> {
  const params = new URLSearchParams();
  if (opts?.areaId) params.set("area_id", opts.areaId);
  if (opts?.kind) params.set("kind", opts.kind);
  const qs = params.toString();
  const response = await fetch(
    `${API_BASE}/collections${qs ? `?${qs}` : ""}`,
  );
  return handleResponse<CollectionRow[]>(response);
}

export async function getCollection(
  collectionId: string,
): Promise<CollectionRow> {
  const response = await fetch(`${API_BASE}/collections/${collectionId}`);
  return handleResponse<CollectionRow>(response);
}

/** CONCEPT §11 Collection dashboard (scoped chrome). */
export async function getCollectionDashboard(
  collectionId: string,
): Promise<CollectionDashboard> {
  const response = await fetch(
    `${API_BASE}/collections/${collectionId}/dashboard`,
  );
  return handleResponse<CollectionDashboard>(response);
}

export async function getDossiers(opts?: {
  collectionId?: string;
}): Promise<DossierRow[]> {
  const params = new URLSearchParams();
  if (opts?.collectionId) params.set("collection_id", opts.collectionId);
  const qs = params.toString();
  const response = await fetch(`${API_BASE}/dossiers${qs ? `?${qs}` : ""}`);
  return handleResponse<DossierRow[]>(response);
}

export async function getDossier(dossierId: string): Promise<DossierRow> {
  const response = await fetch(`${API_BASE}/dossiers/${dossierId}`);
  return handleResponse<DossierRow>(response);
}

export async function getDossierArtifacts(
  dossierId: string,
): Promise<ArtifactRow[]> {
  const response = await fetch(
    `${API_BASE}/dossiers/${dossierId}/artifacts`,
  );
  return handleResponse<ArtifactRow[]>(response);
}

export async function getThreads(opts?: {
  homeDossierId?: string;
  state?: string;
}): Promise<ThreadRow[]> {
  const params = new URLSearchParams();
  if (opts?.homeDossierId) params.set("home_dossier_id", opts.homeDossierId);
  if (opts?.state) params.set("state", opts.state);
  const qs = params.toString();
  const response = await fetch(`${API_BASE}/threads${qs ? `?${qs}` : ""}`);
  return handleResponse<ThreadRow[]>(response);
}

export async function getThread(threadId: string): Promise<ThreadRow> {
  const response = await fetch(`${API_BASE}/threads/${threadId}`);
  return handleResponse<ThreadRow>(response);
}

export async function getDossierThreads(
  dossierId: string,
  opts?: { state?: string },
): Promise<ThreadRow[]> {
  const params = new URLSearchParams();
  if (opts?.state) params.set("state", opts.state);
  const qs = params.toString();
  const response = await fetch(
    `${API_BASE}/dossiers/${dossierId}/threads${qs ? `?${qs}` : ""}`,
  );
  return handleResponse<ThreadRow[]>(response);
}

export async function createThreadPost(
  threadId: string,
  post: {
    author_id: string;
    body: string;
    type?: string;
    post_id?: string;
  },
): Promise<ThreadPostRow> {
  const response = await fetch(`${API_BASE}/threads/${threadId}/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(post),
  });
  return handleResponse<ThreadPostRow>(response);
}

/** Promote open thread → leaf RFC (1:1) or wrapper + sub-RFCs (multi-artifact). */
export async function promoteThread(
  threadId: string,
  body?: { merge_artifact_id?: string; author_id?: string },
): Promise<ThreadRow> {
  const response = await fetch(`${API_BASE}/threads/${threadId}/promote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return handleResponse<ThreadRow>(response);
}

export async function getThreadRevSets(threadId: string): Promise<RevSetRow[]> {
  const response = await fetch(`${API_BASE}/threads/${threadId}/revsets`);
  return handleResponse<RevSetRow[]>(response);
}

export async function createThreadRevSet(
  threadId: string,
  body: {
    author_id: string;
    summary?: string | null;
    content_json?: unknown;
    artifact_revision_id?: string;
    revset_id?: string;
  },
): Promise<RevSetRow> {
  const response = await fetch(`${API_BASE}/threads/${threadId}/revsets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleResponse<RevSetRow>(response);
}

/** Decide a leaf RFC: merged | rejected | parked (wrappers cascade from children). */
export async function decideThread(
  threadId: string,
  body: {
    outcome: "merged" | "rejected" | "parked";
    author_id?: string;
    revset_version?: number;
  },
): Promise<{ thread: ThreadRow; parent_cascaded: boolean }> {
  const response = await fetch(`${API_BASE}/threads/${threadId}/decide`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleResponse<{ thread: ThreadRow; parent_cascaded: boolean }>(
    response,
  );
}

export async function getClaims(opts?: {
  artifactId?: string;
  profile?: string;
}): Promise<ClaimRow[]> {
  const params = new URLSearchParams();
  if (opts?.artifactId) params.set("artifact_id", opts.artifactId);
  if (opts?.profile) params.set("profile", opts.profile);
  const qs = params.toString();
  const response = await fetch(`${API_BASE}/claims${qs ? `?${qs}` : ""}`);
  return handleResponse<ClaimRow[]>(response);
}

export async function getClaim(claimId: string): Promise<ClaimRow> {
  const response = await fetch(`${API_BASE}/claims/${claimId}`);
  return handleResponse<ClaimRow>(response);
}

export async function getArtifactClaims(
  artifactId: string,
): Promise<ClaimRow[]> {
  const response = await fetch(`${API_BASE}/artifacts/${artifactId}/claims`);
  return handleResponse<ClaimRow[]>(response);
}

export async function createClaim(body: {
  claim_id?: string;
  artifact_id: string;
  section_id?: string | null;
  profile: "empirical" | "requirement";
  text: string;
  status?: string;
  empirical_type?: "fact" | "forecast" | "model" | null;
  scope?: "global" | "regional" | null;
  region_code?: string | null;
  region_label?: string | null;
  probability?: number | null;
  as_of?: string | null;
  deadline?: string | null;
  resolution_criteria?: string | null;
  preferred_sources?: string[];
  adjudication_rule?: string | null;
  canon_citations?: string[];
  links?: unknown[];
  author_id?: string | null;
}): Promise<ClaimRow> {
  const response = await fetch(`${API_BASE}/claims`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleResponse<ClaimRow>(response);
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
