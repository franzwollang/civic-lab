export type BlockRow = {
  block_id: string;
  type: string;
  order: number;
  hash: string;
  text_preview: string;
};

/**
 * Wire revision row. Dual-emits `artifact_id` (preferred) and legacy `page_id`
 * (same value = Prisma `Artifact.artifactId` @map `page_id`).
 */
export type ArtifactRevisionRow = {
  revision_id: string;
  /** Preferred CONCEPT id on the wire. */
  artifact_id: string;
  /** @deprecated Prefer artifact_id — kept for cutover clients. */
  page_id: string;
  parent_revision_id: string | null;
  created_at: string;
  author: string;
  content_json: unknown;
  blocks: BlockRow[];
  doc_root_hash: string;
  note?: string;
  schema_version: number;
};

/** @deprecated Prefer ArtifactRevisionRow */
export type PageRevisionRow = ArtifactRevisionRow;

/** Wire artifact meta. Dual-emits `artifact_id` + legacy `page_id`. */
export type ArtifactRow = {
  /** Preferred CONCEPT id on the wire. */
  artifact_id: string;
  /** @deprecated Prefer artifact_id — kept for cutover clients. */
  page_id: string;
  title: string;
  slug: string;
  current_revision_id: string | null;
  created_at: string;
  dossier_id?: string | null;
  /** CONCEPT §3.4 — Owner-only merge when true (Canon restricted). */
  owner_merge_only?: boolean;
  /** CONCEPT §4 — Manual lane; null on Canon. Immutable after create. */
  lane?: string | null;
  /** CONCEPT §4.1 — soft composite/bridge when claim links cross lanes. */
  lane_soft_label?: string | null;
};

export type AreaRow = {
  area_id: string;
  kind: string;
  title: string;
};

export type CollectionRow = {
  collection_id: string;
  area_id: string;
  title: string;
  country_code: string | null;
  summary: string | null;
};

export type DossierRow = {
  dossier_id: string;
  collection_id: string;
  title: string;
  summary: string | null;
  tags: string[];
  /** Present on list/get when API joins Prisma `_count`. */
  artifact_count?: number;
  collection_title?: string | null;
  country_code?: string | null;
};

/** CONCEPT §11 Collection dashboard wire shape. */
export type CollectionDashboardDossier = DossierRow & {
  health: "seeded" | "empty";
  lane_hint: "Descriptive" | "Prescriptive" | "Alignment";
};

/** CONCEPT §5.5 quality panel (Collection-scoped). */
export type CollectionEmpiricalQuality = {
  total: number;
  open: number;
  resolved: number;
  invalidated: number;
  ambiguous_or_conflict: number;
  invalidated_rate: number | null;
  ambiguity_rate: number | null;
  mean_citation_density: number | null;
  mean_days_to_resolution: number | null;
};

/** CONCEPT §5.4–5.9 forecast accuracy panel (advisory). */
export type CollectionForecastAccuracy = {
  n: number;
  mean_brier: number | null;
  mean_log_score: number | null;
  mean_skill_vs_baseline: number | null;
  baseline_p: number;
  baseline_label: string;
  public_board_eligible: boolean;
};

export type RequirementSatisfactionSnapshot = {
  open: number;
  accepted: number;
  satisfied: number;
  failed: number;
  superseded: number;
  invalidated: number;
  disputed: number;
  other: number;
};

export type CollectionDashboard = {
  collection: CollectionRow;
  stats: {
    dossier_count: number;
    artifact_count: number;
    empty_dossier_count: number;
  };
  dossiers: CollectionDashboardDossier[];
  open_threads: {
    count: number;
    critical_findings: number;
    /** Critical findings count still M7. */
    deferred: "M7";
  };
  claims: {
    empirical_quality: CollectionEmpiricalQuality;
    forecast_accuracy: CollectionForecastAccuracy;
  };
  lane_coverage: null | {
    Descriptive: number;
    Prescriptive: number;
    Alignment: number;
  };
  requirement_satisfaction: null | {
    open: number;
    total: number;
    snapshot: RequirementSatisfactionSnapshot;
  };
  red_team: {
    recent_count: number;
    deferred: "M7";
  };
};

/** CONCEPT §2.3 Section wire shape (persisted; synced from headings). */
export type SectionRow = {
  section_id: string;
  artifact_id: string;
  stable_key: string;
  title: string;
  level: number;
  order: number;
};

/** CONCEPT §3 Thread wire shapes. */
export type ThreadTargetRow = {
  target_kind: string;
  target_id: string;
};

export type ThreadPostRow = {
  post_id: string;
  thread_id: string;
  author_id: string;
  type: string;
  body: string;
  created_at: string;
};

export type ThreadRow = {
  thread_id: string;
  home_dossier_id: string;
  title: string;
  state: string;
  decision_outcome: string | null;
  is_redteam: boolean;
  parent_thread_id: string | null;
  merge_artifact_id: string | null;
  created_at: string;
  targets?: ThreadTargetRow[];
  posts?: ThreadPostRow[];
  post_count?: number;
  revsets?: RevSetRow[];
  child_threads?: {
    thread_id: string;
    title: string;
    state: string;
    merge_artifact_id: string | null;
    decision_outcome: string | null;
  }[];
  rfc_kind?: "leaf" | "wrapper" | null;
  /** CONCEPT §3.4 — present on leaf RFCs when merge artifact Collection resolves. */
  merge_authority?: {
    artifact_id: string;
    collection_id: string;
    area_kind: "canon" | "manuals";
    authority_class:
      | "manual_steward"
      | "canon_editor"
      | "canon_owner_only";
    required_roles: string[];
    description: string;
    allowed_user_ids: string[];
  } | null;
};

/** CONCEPT §3.3 RevSet wire shape. */
export type RevSetRow = {
  revset_id: string;
  thread_id: string;
  version: number;
  artifact_revision_id: string;
  artifact_id: string | null;
  author_id: string;
  created_at: string;
  summary: string | null;
};

/** CONCEPT §5 Claim wire shape (+ §8.3 adjudication scaffolding). */
export type ClaimRow = {
  claim_id: string;
  artifact_id: string;
  section_id: string | null;
  profile: string;
  text: string;
  status: string;
  empirical_type: string | null;
  scope: string | null;
  region_code: string | null;
  region_label: string | null;
  probability: number | null;
  as_of: string | null;
  deadline: string | null;
  resolution_criteria: string | null;
  preferred_sources: string[];
  adjudication_rule: string | null;
  canon_citations: string[];
  links: unknown[];
  created_at: string;
  author_id: string | null;
  adjudication_requested_at: string | null;
  adjudication_requested_by: string | null;
  adjudication_request_note: string | null;
  adjudication_rationale: string | null;
  adjudicated_by: string | null;
  adjudicated_at: string | null;
  adjudication_pending?: boolean;
};

/** @deprecated Prefer ArtifactRow */
export type PageRow = ArtifactRow;

/**
 * Resolve the artifact id from a wire row that may carry either field
 * (older responses may only have `page_id`).
 */
export function artifactIdOf(row: {
  artifact_id?: string | null;
  page_id?: string | null;
}): string {
  return row.artifact_id || row.page_id || "";
}
