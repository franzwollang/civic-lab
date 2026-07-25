/**
 * CONCEPT §9.2 / §5.9 — Advisory reputation for non-scorable work.
 *
 * Signals (Collection-scoped via home dossier): merged RevSets, review labor
 * (thread posts), Red Team findings, adjudications, Accepted Risk signatures.
 * Endorsements / attribution-quality hooks are reserved (weight 0 until modeled).
 *
 * Always advisory — never grants permissions. Public boards need n ≥ 20
 * signal events (same anti-gaming floor as forecast boards).
 */

import { PUBLIC_BOARD_MIN_N } from "./claimMetrics";

export const REPUTATION_BOARD_MIN_N = PUBLIC_BOARD_MIN_N;

export type ReputationSignalKind =
  | "merged_revset"
  | "review_labor"
  | "red_team_finding"
  | "adjudication"
  | "accepted_risk_sign"
  | "endorsement";

/** Advisory weights — relative provenance, not permissions. */
export const SIGNAL_WEIGHTS: Record<ReputationSignalKind, number> = {
  merged_revset: 5,
  review_labor: 1,
  red_team_finding: 3,
  adjudication: 2,
  accepted_risk_sign: 2,
  endorsement: 0,
};

export type ReputationSignalEvent = {
  user_id: string;
  kind: ReputationSignalKind;
  /** Home dossier (or claim artifact dossier) for topic rollup. */
  dossier_id?: string | null;
  created_at?: string | null;
};

export type ReputationSignalCounts = {
  merged_revsets: number;
  review_labor: number;
  red_team_findings: number;
  adjudications: number;
  accepted_risk_signs: number;
  endorsements: number;
};

export type ReputationContributor = {
  user_id: string;
  signals: ReputationSignalCounts;
  /** Raw event count (anti-gaming n). */
  signal_event_count: number;
  /** Weighted advisory score (not a permission). */
  advisory_score: number;
};

export type ReputationBoard = {
  /** Always true — CONCEPT invariant. */
  advisory: true;
  /** Always false — scores never grant permissions (§5.9). */
  grants_permissions: false;
  /** Total signal events in scope. */
  n: number;
  public_board_eligible: boolean;
  contributors: ReputationContributor[];
  note: string;
};

function emptyCounts(): ReputationSignalCounts {
  return {
    merged_revsets: 0,
    review_labor: 0,
    red_team_findings: 0,
    adjudications: 0,
    accepted_risk_signs: 0,
    endorsements: 0,
  };
}

function bump(counts: ReputationSignalCounts, kind: ReputationSignalKind): void {
  switch (kind) {
    case "merged_revset":
      counts.merged_revsets += 1;
      break;
    case "review_labor":
      counts.review_labor += 1;
      break;
    case "red_team_finding":
      counts.red_team_findings += 1;
      break;
    case "adjudication":
      counts.adjudications += 1;
      break;
    case "accepted_risk_sign":
      counts.accepted_risk_signs += 1;
      break;
    case "endorsement":
      counts.endorsements += 1;
      break;
  }
}

export function advisoryScoreFor(counts: ReputationSignalCounts): number {
  return (
    counts.merged_revsets * SIGNAL_WEIGHTS.merged_revset +
    counts.review_labor * SIGNAL_WEIGHTS.review_labor +
    counts.red_team_findings * SIGNAL_WEIGHTS.red_team_finding +
    counts.adjudications * SIGNAL_WEIGHTS.adjudication +
    counts.accepted_risk_signs * SIGNAL_WEIGHTS.accepted_risk_sign +
    counts.endorsements * SIGNAL_WEIGHTS.endorsement
  );
}

/**
 * Aggregate signal events into a Collection-scoped advisory board.
 * Contributors sorted by advisory_score desc, then signal_event_count, then user_id.
 */
export function computeReputationBoard(
  events: ReputationSignalEvent[],
): ReputationBoard {
  const byUser = new Map<string, ReputationSignalCounts>();

  for (const ev of events) {
    if (!ev.user_id) continue;
    let counts = byUser.get(ev.user_id);
    if (!counts) {
      counts = emptyCounts();
      byUser.set(ev.user_id, counts);
    }
    bump(counts, ev.kind);
  }

  const contributors: ReputationContributor[] = [...byUser.entries()].map(
    ([user_id, signals]) => {
      const signal_event_count =
        signals.merged_revsets +
        signals.review_labor +
        signals.red_team_findings +
        signals.adjudications +
        signals.accepted_risk_signs +
        signals.endorsements;
      return {
        user_id,
        signals,
        signal_event_count,
        advisory_score: advisoryScoreFor(signals),
      };
    },
  );

  contributors.sort((a, b) => {
    if (b.advisory_score !== a.advisory_score) {
      return b.advisory_score - a.advisory_score;
    }
    if (b.signal_event_count !== a.signal_event_count) {
      return b.signal_event_count - a.signal_event_count;
    }
    return a.user_id.localeCompare(b.user_id);
  });

  const n = events.filter((e) => Boolean(e.user_id)).length;
  const public_board_eligible = n >= REPUTATION_BOARD_MIN_N;

  return {
    advisory: true,
    grants_permissions: false,
    n,
    public_board_eligible,
    contributors,
    note: public_board_eligible
      ? "Advisory reputation board (n ≥ 20). Does not grant permissions."
      : `Advisory preview only — public boards need n ≥ ${REPUTATION_BOARD_MIN_N} signal events (have ${n}). Does not grant permissions.`,
  };
}
