/**
 * CONCEPT §5.2 — Model→forecast implication links (MVP).
 *
 * Model empirical claims may link to forecast claims they imply via
 * `{ kind: "implies_forecast", claim_id }` entries in `Claim.links`.
 * Full implication graphs (DAG UI, scoring propagation) remain deferred.
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
 */
export function mergeImpliesForecastLinks(opts: {
  existingLinks?: unknown[];
  forecastClaimIds: string[];
}): unknown[] {
  const preserved = (opts.existingLinks ?? []).filter(
    (item) => !isImpliesForecastLink(item),
  );
  const links = opts.forecastClaimIds
    .map((id) => id.trim())
    .filter(Boolean)
    .map(buildImpliesForecastLink);
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
