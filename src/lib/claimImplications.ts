/**
 * CONCEPT §5.2 — Model→forecast implication links.
 *
 * Model empirical claims may link to forecast claims they imply via
 * `{ kind: "implies_forecast", claim_id }` entries in `Claim.links`.
 * Artifact-scoped read-only DAG UI is supported; scoring propagation
 * across edges remains deferred.
 */

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
