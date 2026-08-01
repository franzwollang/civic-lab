/**
 * CONCEPT §5.4–5.9 — Claim quality + forecast accuracy toolkit.
 *
 * Quality (all profiles): invalidated / ambiguity rates, time-to-resolution,
 * citation density. Forecast accuracy: empirical forecasts that resolve
 * true/false with probability only (log primary, Brier, skill vs baseline).
 *
 * Scores are advisory; public boards require n ≥ 20 (CONCEPT §5.9).
 */

export const PROBABILITY_CLAMP_MIN = 0.01;
export const PROBABILITY_CLAMP_MAX = 0.99;
export const DEFAULT_FORECAST_BASELINE = 0.5;
export const PUBLIC_BOARD_MIN_N = 20;

export type BinaryOutcome = 0 | 1;

export type ClaimMetricsInput = {
  profile: string;
  status: string;
  empirical_type?: string | null;
  probability?: number | null;
  preferred_sources?: unknown;
  canon_citations?: unknown;
  created_at?: string | null;
  adjudicated_at?: string | null;
  /** Optional; used by Collection dashboard board-hide filtering. */
  author_id?: string | null;
};

export type EmpiricalQualityMetrics = {
  total: number;
  open: number;
  resolved: number;
  invalidated: number;
  ambiguous_or_conflict: number;
  invalidated_rate: number | null;
  ambiguity_rate: number | null;
  /** Mean preferred_sources length across empirical claims. */
  mean_citation_density: number | null;
  /** Mean days from created_at → adjudicated_at when both present. */
  mean_days_to_resolution: number | null;
};

export type ForecastAccuracyMetrics = {
  /** Resolved true/false forecasts with a probability. */
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

export function clampProbability(p: number): number {
  if (!Number.isFinite(p)) return DEFAULT_FORECAST_BASELINE;
  return Math.min(PROBABILITY_CLAMP_MAX, Math.max(PROBABILITY_CLAMP_MIN, p));
}

/** Brier score; lower is better. Outcome 1 = true, 0 = false. */
export function brierScore(p: number, outcome: BinaryOutcome): number {
  const c = clampProbability(p);
  const diff = c - outcome;
  return diff * diff;
}

/**
 * Natural log score of the probability assigned to the realized outcome.
 * Higher (less negative) is better. Clamped p avoids -∞.
 */
export function logScore(p: number, outcome: BinaryOutcome): number {
  const c = clampProbability(p);
  const likelihood = outcome === 1 ? c : 1 - c;
  return Math.log(likelihood);
}

/** Skill = baselineScore − score (positive ⇒ better than baseline). */
export function skillVsBaseline(score: number, baselineScore: number): number {
  return baselineScore - score;
}

export function outcomeFromEmpiricalStatus(
  status: string,
): BinaryOutcome | null {
  if (status === "resolved_true") return 1;
  if (status === "resolved_false") return 0;
  return null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function daysBetween(startIso: string, endIso: string): number | null {
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return null;
  }
  return (end - start) / (1000 * 60 * 60 * 24);
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function round4(n: number | null): number | null {
  if (n === null) return null;
  return Math.round(n * 10000) / 10000;
}

export function isScoredForecast(claim: ClaimMetricsInput): boolean {
  if (claim.profile !== "empirical") return false;
  if (claim.empirical_type !== "forecast") return false;
  if (typeof claim.probability !== "number") return false;
  return outcomeFromEmpiricalStatus(claim.status) !== null;
}

export function computeEmpiricalQuality(
  claims: ClaimMetricsInput[],
): EmpiricalQualityMetrics {
  const empirical = claims.filter((c) => c.profile === "empirical");
  const total = empirical.length;
  let open = 0;
  let resolved = 0;
  let invalidated = 0;
  let ambiguous_or_conflict = 0;
  const densities: number[] = [];
  const days: number[] = [];

  for (const c of empirical) {
    if (c.status === "open") open += 1;
    if (c.status === "resolved_true" || c.status === "resolved_false") {
      resolved += 1;
    }
    if (c.status === "invalidated") invalidated += 1;
    if (c.status === "ambiguous" || c.status === "source_conflict") {
      ambiguous_or_conflict += 1;
    }
    densities.push(asStringArray(c.preferred_sources).length);
    if (c.created_at && c.adjudicated_at) {
      const d = daysBetween(c.created_at, c.adjudicated_at);
      if (d !== null) days.push(d);
    }
  }

  return {
    total,
    open,
    resolved,
    invalidated,
    ambiguous_or_conflict,
    invalidated_rate: total === 0 ? null : round4(invalidated / total),
    ambiguity_rate: total === 0 ? null : round4(ambiguous_or_conflict / total),
    mean_citation_density: round4(mean(densities)),
    mean_days_to_resolution: round4(mean(days)),
  };
}

export function computeForecastAccuracy(
  claims: ClaimMetricsInput[],
  opts?: { baseline_p?: number; baseline_label?: string },
): ForecastAccuracyMetrics {
  const baseline_p = clampProbability(
    opts?.baseline_p ?? DEFAULT_FORECAST_BASELINE,
  );
  const baseline_label =
    opts?.baseline_label ?? "default binary baseline p = 0.5";

  const briers: number[] = [];
  const logs: number[] = [];
  const skills: number[] = [];

  for (const c of claims) {
    if (!isScoredForecast(c)) continue;
    const outcome = outcomeFromEmpiricalStatus(c.status);
    if (outcome === null || typeof c.probability !== "number") continue;
    const brier = brierScore(c.probability, outcome);
    const log = logScore(c.probability, outcome);
    const baselineBrier = brierScore(baseline_p, outcome);
    briers.push(brier);
    logs.push(log);
    skills.push(skillVsBaseline(brier, baselineBrier));
  }

  const n = briers.length;
  return {
    n,
    mean_brier: round4(mean(briers)),
    mean_log_score: round4(mean(logs)),
    mean_skill_vs_baseline: round4(mean(skills)),
    baseline_p,
    baseline_label,
    public_board_eligible: n >= PUBLIC_BOARD_MIN_N,
  };
}

export function computeRequirementSatisfactionSnapshot(
  claims: ClaimMetricsInput[],
): RequirementSatisfactionSnapshot {
  const snapshot: RequirementSatisfactionSnapshot = {
    open: 0,
    accepted: 0,
    satisfied: 0,
    failed: 0,
    superseded: 0,
    invalidated: 0,
    disputed: 0,
    other: 0,
  };

  for (const c of claims) {
    if (c.profile !== "requirement") continue;
    switch (c.status) {
      case "open":
        snapshot.open += 1;
        break;
      case "accepted":
        snapshot.accepted += 1;
        break;
      case "satisfied":
        snapshot.satisfied += 1;
        break;
      case "failed":
        snapshot.failed += 1;
        break;
      case "superseded":
        snapshot.superseded += 1;
        break;
      case "invalidated":
        snapshot.invalidated += 1;
        break;
      case "disputed":
        snapshot.disputed += 1;
        break;
      default:
        snapshot.other += 1;
    }
  }

  return snapshot;
}
