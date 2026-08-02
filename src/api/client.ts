import type {
  AcceptedRiskRow,
  AreaRow,
  ArtifactRevisionRow,
  ArtifactRow,
  AuditLogRow,
  BoardHideRow,
  CandidateFindingRow,
  ClaimRow,
  CollectionDashboard,
  CollectionRow,
  DossierRow,
  FindingRow,
  PageRevisionRow,
  PageRow,
  RevSetRow,
  SearchResponse,
  SectionRow,
  ThreadPostRow,
  ThreadRow,
  UserIdentityRow,
} from "../doc/types";
import type { AttributionRegistry, TermRegistry } from "../doc/evidence";
import type { VerificationStatus } from "../lib/identityPolicy";

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

/** CONCEPT §9.3 — Owner reverts a Canon artifact to a prior revision. */
export async function revertCanonArtifact(
  artifactId: string,
  input: { actor_id: string; target_revision_id?: string },
): Promise<{
  artifact: ArtifactRow;
  from_revision_id: string;
  to_revision_id: string;
  audit: AuditLogRow;
}> {
  const response = await fetch(
    `${API_BASE}/artifacts/${artifactId}/revert`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  return handleResponse(response);
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

/** CONCEPT §9.4 — soft-delete ordinary post (steward/Owner). */
export async function softDeleteThreadPost(
  threadId: string,
  postId: string,
  body: { actor_id: string; reason?: string | null },
): Promise<{ post: ThreadPostRow; audit: AuditLogRow }> {
  const response = await fetch(
    `${API_BASE}/threads/${threadId}/posts/${postId}/soft-delete`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return handleResponse(response);
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

export async function getFindings(opts?: {
  threadId?: string;
  collectionId?: string;
  severity?: string;
  status?: string;
}): Promise<FindingRow[]> {
  const params = new URLSearchParams();
  if (opts?.threadId) params.set("thread_id", opts.threadId);
  if (opts?.collectionId) params.set("collection_id", opts.collectionId);
  if (opts?.severity) params.set("severity", opts.severity);
  if (opts?.status) params.set("status", opts.status);
  const qs = params.toString();
  const response = await fetch(`${API_BASE}/findings${qs ? `?${qs}` : ""}`);
  return handleResponse<FindingRow[]>(response);
}

export async function getFinding(findingId: string): Promise<FindingRow> {
  const response = await fetch(`${API_BASE}/findings/${findingId}`);
  return handleResponse<FindingRow>(response);
}

export async function getThreadFindings(
  threadId: string,
): Promise<FindingRow[]> {
  const response = await fetch(`${API_BASE}/threads/${threadId}/findings`);
  return handleResponse<FindingRow[]>(response);
}

export async function createFinding(body: {
  finding_id?: string;
  thread_id: string;
  title: string;
  severity: "low" | "med" | "high" | "critical";
  likelihood?: string | null;
  status?: "open" | "mitigated" | "accepted_risk" | "disputed";
  evidence?: string | null;
  attack_path?: string | null;
  author_id: string;
  targets?: { target_kind: string; target_id: string }[];
}): Promise<FindingRow> {
  const response = await fetch(`${API_BASE}/findings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleResponse<FindingRow>(response);
}

export async function getThreadCandidates(
  threadId: string,
  opts?: { status?: string },
): Promise<CandidateFindingRow[]> {
  const params = new URLSearchParams();
  if (opts?.status) params.set("status", opts.status);
  const qs = params.toString();
  const response = await fetch(
    `${API_BASE}/threads/${threadId}/candidates${qs ? `?${qs}` : ""}`,
  );
  return handleResponse<CandidateFindingRow[]>(response);
}

export async function flagCandidateFinding(
  threadId: string,
  body: {
    candidate_id?: string;
    post_id: string;
    flagger_id: string;
    note?: string | null;
  },
): Promise<CandidateFindingRow> {
  const response = await fetch(`${API_BASE}/threads/${threadId}/candidates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleResponse<CandidateFindingRow>(response);
}

export async function promoteCandidateFinding(
  candidateId: string,
  body: {
    author_id: string;
    title?: string;
    severity: "low" | "med" | "high" | "critical";
    likelihood?: string | null;
    evidence?: string | null;
    attack_path?: string | null;
    targets?: { target_kind: string; target_id: string }[];
  },
): Promise<{ finding: FindingRow; candidate: CandidateFindingRow }> {
  const response = await fetch(
    `${API_BASE}/candidates/${candidateId}/promote`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return handleResponse<{
    finding: FindingRow;
    candidate: CandidateFindingRow;
  }>(response);
}

export async function getAcceptedRisk(
  threadId: string,
): Promise<AcceptedRiskRow | null> {
  const response = await fetch(
    `${API_BASE}/threads/${threadId}/accepted-risk`,
  );
  return handleResponse<AcceptedRiskRow | null>(response);
}

export async function createAcceptedRisk(
  threadId: string,
  body: {
    accepted_risk_id?: string;
    description: string;
    rationale: string;
    evidence_considered?: string | null;
    reopen_triggers?: string | null;
    signer_id: string;
    signed_at?: string;
  },
): Promise<{
  accepted_risk: AcceptedRiskRow;
  findings_updated: string[];
}> {
  const response = await fetch(
    `${API_BASE}/threads/${threadId}/accepted-risk`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return handleResponse<{
    accepted_risk: AcceptedRiskRow;
    findings_updated: string[];
  }>(response);
}

export async function getAdjudicationQueue(): Promise<ClaimRow[]> {
  const response = await fetch(`${API_BASE}/adjudication-queue`);
  return handleResponse<ClaimRow[]>(response);
}

export async function requestClaimAdjudication(
  claimId: string,
  body: { author_id: string; note?: string | null },
): Promise<ClaimRow> {
  const response = await fetch(
    `${API_BASE}/claims/${claimId}/request-adjudication`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return handleResponse<ClaimRow>(response);
}

export async function adjudicateClaim(
  claimId: string,
  body: {
    author_id: string;
    status: string;
    rationale: string;
    require_queued?: boolean;
  },
): Promise<ClaimRow> {
  const response = await fetch(`${API_BASE}/claims/${claimId}/adjudicate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleResponse<ClaimRow>(response);
}

/** CONCEPT §5.9 — list Owner board-hides (active by default). */
export async function getBoardHides(opts?: {
  include_lifted?: boolean;
}): Promise<BoardHideRow[]> {
  const params = new URLSearchParams();
  if (opts?.include_lifted) params.set("include_lifted", "1");
  const q = params.toString();
  const response = await fetch(
    `${API_BASE}/board-hides${q ? `?${q}` : ""}`,
  );
  return handleResponse<BoardHideRow[]>(response);
}

export async function hideUserFromBoards(body: {
  actor_id: string;
  subject_user_id: string;
  reason: string;
}): Promise<{ hide: BoardHideRow; audit: AuditLogRow }> {
  const response = await fetch(`${API_BASE}/board-hides`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleResponse(response);
}

export async function liftBoardHide(body: {
  actor_id: string;
  subject_user_id: string;
  note?: string | null;
}): Promise<{ hide: BoardHideRow; audit: AuditLogRow }> {
  const response = await fetch(`${API_BASE}/board-hides/lift`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleResponse(response);
}

export type EffectiveUserRow = {
  user_id: string;
  display_name: string;
  roles: string[];
  roles_source: "seed" | "override";
};

/** CONCEPT §9.1 — seed users with effective (seed|override) roles. */
export async function getUsers(): Promise<EffectiveUserRow[]> {
  const response = await fetch(`${API_BASE}/users`);
  return handleResponse<EffectiveUserRow[]>(response);
}

/** CONCEPT §9.1 / §9.4 — Owner appoints roles; append-only `role_change` audit. */
export async function changeUserRoles(
  userId: string,
  body: {
    actor_id: string;
    roles: string[];
    rationale?: string | null;
  },
): Promise<{ user: EffectiveUserRow; audit: AuditLogRow }> {
  const response = await fetch(`${API_BASE}/users/${userId}/roles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleResponse(response);
}

export async function getAuditLogs(opts?: {
  action?: string;
  limit?: number;
  /** Required — steward/Owner gate on GET /api/audit-logs. */
  actor_id?: string;
}): Promise<AuditLogRow[]> {
  const params = new URLSearchParams();
  if (opts?.actor_id) params.set("actor_id", opts.actor_id);
  if (opts?.action) params.set("action", opts.action);
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  const q = params.toString();
  const response = await fetch(
    `${API_BASE}/audit-logs${q ? `?${q}` : ""}`,
  );
  return handleResponse<AuditLogRow[]>(response);
}

/** CONCEPT §8.6 — list real-identity attestation records. */
export async function getIdentities(): Promise<UserIdentityRow[]> {
  const response = await fetch(`${API_BASE}/identities`);
  return handleResponse<UserIdentityRow[]>(response);
}

export async function getIdentity(userId: string): Promise<UserIdentityRow> {
  const response = await fetch(`${API_BASE}/identities/${userId}`);
  return handleResponse<UserIdentityRow>(response);
}

export async function getStewardEligibility(
  userId: string,
  country?: string | null,
): Promise<{
  auth_mode: string;
  identity: UserIdentityRow;
  eligibility: { ok: boolean; reason?: string; code?: string; message?: string };
}> {
  const params = new URLSearchParams();
  if (country) params.set("country", country);
  const q = params.toString();
  const response = await fetch(
    `${API_BASE}/identities/${userId}/steward-eligibility${q ? `?${q}` : ""}`,
  );
  return handleResponse(response);
}

export async function requestIdentityVerification(body: {
  actor_id: string;
  subject_user_id: string;
}): Promise<{ identity: UserIdentityRow; audit: AuditLogRow }> {
  const response = await fetch(
    `${API_BASE}/identities/${body.subject_user_id}/request`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actor_id: body.actor_id }),
    },
  );
  return handleResponse(response);
}

export async function attestIdentity(body: {
  actor_id: string;
  subject_user_id: string;
  verification_status: VerificationStatus;
  country_codes?: string[];
  long_term_ties_note?: string | null;
  provider_stub?: string | null;
}): Promise<{ identity: UserIdentityRow; audit: AuditLogRow }> {
  const response = await fetch(
    `${API_BASE}/identities/${body.subject_user_id}/attest`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actor_id: body.actor_id,
        verification_status: body.verification_status,
        country_codes: body.country_codes,
        long_term_ties_note: body.long_term_ties_note,
        provider_stub: body.provider_stub,
      }),
    },
  );
  return handleResponse(response);
}

export async function getAttributions(): Promise<AttributionRegistry> {
  const response = await fetch(`${API_BASE}/attributions`);
  return handleResponse<AttributionRegistry>(response);
}

/** M8 first-cut corpus search (dossiers / artifacts / threads / claims). */
export async function searchCorpus(opts: {
  q: string;
  limit?: number;
}): Promise<SearchResponse> {
  const params = new URLSearchParams();
  params.set("q", opts.q);
  if (opts.limit != null) params.set("limit", String(opts.limit));
  const response = await fetch(`${API_BASE}/search?${params.toString()}`);
  return handleResponse<SearchResponse>(response);
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

export type UploadedImage = {
  url: string;
  filename: string;
  mime: string;
  bytes: number;
};

/** Upload a raster image (webp/png/jpeg/gif) to the prototype filesystem store. */
export async function uploadImage(file: File | Blob): Promise<UploadedImage> {
  const form = new FormData();
  const name =
    file instanceof File && file.name ? file.name : "upload.bin";
  form.append("file", file, name);
  const response = await fetch(`${API_BASE}/uploads/images`, {
    method: "POST",
    body: form,
  });
  return handleResponse<UploadedImage>(response);
}
