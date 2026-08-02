/**
 * CONCEPT §5.2 — Model→forecast implication links.
 *
 * Model empirical claims may link to forecast claims they imply via
 * `{ kind: "implies_forecast", claim_id }` entries in `Claim.links`.
 * Artifact-scoped read-only DAG UI + advisory score propagation:
 * resolved implied forecasts contribute Brier/log/skill to the model.
 * Cross-artifact / reputation-board rollups remain out of scope.
 */

import {
  DEFAULT_FORECAST_BASELINE,
  PUBLIC_BOARD_MIN_N,
  brierScore,
  clampProbability,
  computeForecastAccuracy,
  logScore,
  outcomeFromEmpiricalStatus,
  skillVsBaseline,
  type BinaryOutcome,
} from "./claimMetrics";

export const IMPLIES_FORECAST_KIND = "implies_forecast" as const;

export type ImpliesForecastLink = {
  kind: typeof IMPLIES_FORECAST_KIND;
  claim_id: string;
};

export type ClaimImplicationErrorCode =
  | "implies_requires_model"
  | "implies_malformed_link"
  | "implies_target_not_found"
  | "implies_target_not_forecast"
  | "implies_self_reference";

export type ClaimImplicationError = {
  code: ClaimImplicationErrorCode;
  message: string;
};

export type ForecastClaimRef = {
  claim_id: string;
  profile: string;
  empirical_type: string | null;
};

/** True when value is a well-formed implies_forecast link object. */
export function isImpliesForecastLink(
  value: unknown,
): value is ImpliesForecastLink {
  if (!value || typeof value !== "object") return false;
  const rec = value as Record<string, unknown>;
  return (
    rec.kind === IMPLIES_FORECAST_KIND &&
    typeof rec.claim_id === "string" &&
    rec.claim_id.trim().length > 0
  );
}

/** Extract unique forecast claim ids from `links` JSON. */
export function forecastIdsFromImpliesLinks(links: unknown): string[] {
  if (!Array.isArray(links)) return [];
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const item of links) {
    if (!isImpliesForecastLink(item)) continue;
    const id = item.claim_id.trim();
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function buildImpliesForecastLink(claimId: string): ImpliesForecastLink {
  return { kind: IMPLIES_FORECAST_KIND, claim_id: claimId.trim() };
}

/**
 * Normalize authoring input (ids or link objects) into implies_forecast links.
 * Non-implication entries in `existingLinks` are preserved.
 * Forecast claim ids are de-duplicated.
 */
export function mergeImpliesForecastLinks(opts: {
  existingLinks?: unknown[];
  forecastClaimIds: string[];
}): unknown[] {
  const preserved = (opts.existingLinks ?? []).filter(
    (item) => !isImpliesForecastLink(item),
  );
  const seen = new Set<string>();
  const links: ImpliesForecastLink[] = [];
  for (const raw of opts.forecastClaimIds) {
    const id = raw.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    links.push(buildImpliesForecastLink(id));
  }
  return [...preserved, ...links];
}

/**
 * Structural + semantic check for model implication edges.
 * `resolveForecast` looks up each target; return null when missing.
 */
export function validateModelImplicationLinks(opts: {
  empirical_type?: string | null;
  links?: unknown[] | null;
  /** When set (update/create of an existing id), forbid self-edges. */
  self_claim_id?: string | null;
  resolveForecast: (claimId: string) => ForecastClaimRef | null;
}): { ok: true; forecast_ids: string[] } | { ok: false; error: ClaimImplicationError } {
  const links = opts.links ?? [];
  const hasImplies = Array.isArray(links) && links.some(isImpliesForecastLink);

  if (!hasImplies) {
    return { ok: true, forecast_ids: [] };
  }

  if (opts.empirical_type !== "model") {
    return {
      ok: false,
      error: {
        code: "implies_requires_model",
        message:
          "implies_forecast links are only legal on empirical model claims",
      },
    };
  }

  for (const item of links) {
    if (
      item &&
      typeof item === "object" &&
      (item as Record<string, unknown>).kind === IMPLIES_FORECAST_KIND &&
      !isImpliesForecastLink(item)
    ) {
      return {
        ok: false,
        error: {
          code: "implies_malformed_link",
          message: "implies_forecast link requires a non-empty claim_id",
        },
      };
    }
  }

  const forecastIds = forecastIdsFromImpliesLinks(links);
  for (const id of forecastIds) {
    if (opts.self_claim_id && id === opts.self_claim_id) {
      return {
        ok: false,
        error: {
          code: "implies_self_reference",
          message: "A model claim cannot imply itself",
        },
      };
    }
    const target = opts.resolveForecast(id);
    if (!target) {
      return {
        ok: false,
        error: {
          code: "implies_target_not_found",
          message: `Implied forecast claim not found: ${id}`,
        },
      };
    }
    if (
      target.profile !== "empirical" ||
      target.empirical_type !== "forecast"
    ) {
      return {
        ok: false,
        error: {
          code: "implies_target_not_forecast",
          message: `Implied claim must be empirical forecast: ${id}`,
        },
      };
    }
  }

  return { ok: true, forecast_ids: forecastIds };
}

/** Minimal claim shape for building an artifact-scoped implication DAG. */
export type ImplicationClaimRef = {
  claim_id: string;
  text: string;
  status: string;
  profile: string;
  empirical_type: string | null;
  links?: unknown[] | null;
  probability?: number | null;
};

export type ImplicationEdge = {
  from: string;
  to: string;
  kind: typeof IMPLIES_FORECAST_KIND;
};

export type ImplicationGraphNode = {
  claim_id: string;
  role: "model" | "forecast";
  text: string;
  status: string;
  probability: number | null;
  /** False when the forecast target is linked but not in the loaded claim set. */
  present: boolean;
};

export type ImplicationGraph = {
  nodes: ImplicationGraphNode[];
  edges: ImplicationEdge[];
};

/**
 * Build a read-only model→forecast DAG from loaded claims (artifact scope).
 * Only model claims with valid implies_forecast links become sources.
 * Forecast targets missing from `claims` appear as stub nodes (`present: false`).
 */
export function buildImplicationGraph(
  claims: ImplicationClaimRef[],
): ImplicationGraph {
  const byId = new Map(claims.map((c) => [c.claim_id, c]));
  const edges: ImplicationEdge[] = [];
  const edgeKey = new Set<string>();
  const nodeIds = new Set<string>();

  for (const claim of claims) {
    if (claim.empirical_type !== "model") continue;
    const targets = forecastIdsFromImpliesLinks(claim.links);
    if (targets.length === 0) continue;
    nodeIds.add(claim.claim_id);
    for (const to of targets) {
      const key = `${claim.claim_id}->${to}`;
      if (edgeKey.has(key)) continue;
      edgeKey.add(key);
      edges.push({
        from: claim.claim_id,
        to,
        kind: IMPLIES_FORECAST_KIND,
      });
      nodeIds.add(to);
    }
  }

  const nodes: ImplicationGraphNode[] = [];
  for (const id of nodeIds) {
    const claim = byId.get(id);
    if (claim && claim.empirical_type === "model") {
      nodes.push({
        claim_id: id,
        role: "model",
        text: claim.text,
        status: claim.status,
        probability: claim.probability ?? null,
        present: true,
      });
      continue;
    }
    if (claim) {
      nodes.push({
        claim_id: id,
        role: "forecast",
        text: claim.text,
        status: claim.status,
        probability: claim.probability ?? null,
        present: true,
      });
      continue;
    }
    nodes.push({
      claim_id: id,
      role: "forecast",
      text: "(forecast not loaded on this artifact)",
      status: "unknown",
      probability: null,
      present: false,
    });
  }

  // Stable order: models first (by id), then forecasts (by id).
  nodes.sort((a, b) => {
    if (a.role !== b.role) return a.role === "model" ? -1 : 1;
    return a.claim_id.localeCompare(b.claim_id);
  });

  return { nodes, edges };
}

/** True when the claim set has at least one model→forecast implication edge. */
export function hasImplicationEdges(claims: ImplicationClaimRef[]): boolean {
  return buildImplicationGraph(claims).edges.length > 0;
}

/** Per-forecast contribution toward a model's advisory implied score. */
export type ImplicationScoreContribution = {
  forecast_claim_id: string;
  status: string;
  probability: number | null;
  outcome: BinaryOutcome | null;
  brier: number | null;
  log_score: number | null;
  skill_vs_baseline: number | null;
  /** True when resolved true/false with a probability (scored). */
  scored: boolean;
  /** False when the forecast id is not in the loaded claim set. */
  present: boolean;
};

/**
 * Advisory accuracy for one model from its implied forecasts' resolutions.
 * Does not mutate claim records; scores stay advisory (§5.6 / §5.9).
 */
export type ModelImplicationScore = {
  model_claim_id: string;
  implied_forecast_ids: string[];
  scored_n: number;
  open_n: number;
  missing_n: number;
  mean_brier: number | null;
  mean_log_score: number | null;
  mean_skill_vs_baseline: number | null;
  baseline_p: number;
  baseline_label: string;
  public_board_eligible: boolean;
  contributions: ImplicationScoreContribution[];
};

function round4(n: number | null): number | null {
  if (n === null) return null;
  return Math.round(n * 10000) / 10000;
}

/**
 * Propagate forecast accuracy onto model claims via implies_forecast edges.
 * Returns one row per model that has at least one implication edge.
 */
export function scoreModelImplications(
  claims: ImplicationClaimRef[],
  opts?: { baseline_p?: number; baseline_label?: string },
): ModelImplicationScore[] {
  const baseline_p = clampProbability(
    opts?.baseline_p ?? DEFAULT_FORECAST_BASELINE,
  );
  const baseline_label =
    opts?.baseline_label ?? "default binary baseline p = 0.5";
  const byId = new Map(claims.map((c) => [c.claim_id, c]));
  const results: ModelImplicationScore[] = [];

  for (const claim of claims) {
    if (claim.empirical_type !== "model") continue;
    const forecastIds = forecastIdsFromImpliesLinks(claim.links);
    if (forecastIds.length === 0) continue;

    const contributions: ImplicationScoreContribution[] = [];
    let open_n = 0;
    let missing_n = 0;
    const scoredInputs: {
      profile: string;
      status: string;
      empirical_type: string | null;
      probability: number | null;
    }[] = [];

    for (const fid of forecastIds) {
      const target = byId.get(fid);
      if (!target) {
        missing_n += 1;
        contributions.push({
          forecast_claim_id: fid,
          status: "unknown",
          probability: null,
          outcome: null,
          brier: null,
          log_score: null,
          skill_vs_baseline: null,
          scored: false,
          present: false,
        });
        continue;
      }

      const outcome = outcomeFromEmpiricalStatus(target.status);
      const probability =
        typeof target.probability === "number" ? target.probability : null;
      const canScore =
        target.profile === "empirical" &&
        target.empirical_type === "forecast" &&
        outcome !== null &&
        probability !== null;

      if (target.status === "open") open_n += 1;

      if (canScore && outcome !== null && probability !== null) {
        const brier = brierScore(probability, outcome);
        const log = logScore(probability, outcome);
        const baselineBrier = brierScore(baseline_p, outcome);
        scoredInputs.push({
          profile: "empirical",
          status: target.status,
          empirical_type: "forecast",
          probability,
        });
        contributions.push({
          forecast_claim_id: fid,
          status: target.status,
          probability,
          outcome,
          brier: round4(brier),
          log_score: round4(log),
          skill_vs_baseline: round4(skillVsBaseline(brier, baselineBrier)),
          scored: true,
          present: true,
        });
      } else {
        contributions.push({
          forecast_claim_id: fid,
          status: target.status,
          probability,
          outcome,
          brier: null,
          log_score: null,
          skill_vs_baseline: null,
          scored: false,
          present: true,
        });
      }
    }

    const accuracy = computeForecastAccuracy(scoredInputs, {
      baseline_p,
      baseline_label,
    });

    results.push({
      model_claim_id: claim.claim_id,
      implied_forecast_ids: forecastIds,
      scored_n: accuracy.n,
      open_n,
      missing_n,
      mean_brier: accuracy.mean_brier,
      mean_log_score: accuracy.mean_log_score,
      mean_skill_vs_baseline: accuracy.mean_skill_vs_baseline,
      baseline_p: accuracy.baseline_p,
      baseline_label: accuracy.baseline_label,
      public_board_eligible: accuracy.n >= PUBLIC_BOARD_MIN_N,
      contributions,
    });
  }

  results.sort((a, b) => a.model_claim_id.localeCompare(b.model_claim_id));
  return results;
}

/** Lookup helper for UI: model claim id → advisory implication score. */
export function scoreModelImplicationsById(
  claims: ImplicationClaimRef[],
  opts?: { baseline_p?: number; baseline_label?: string },
): Map<string, ModelImplicationScore> {
  const map = new Map<string, ModelImplicationScore>();
  for (const row of scoreModelImplications(claims, opts)) {
    map.set(row.model_claim_id, row);
  }
  return map;
}
