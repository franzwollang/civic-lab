/**
 * CONCEPT §7.3–7.6 — Finding vocabulary + Red Team create gate helpers.
 *
 * Findings always attach to an originating thread. Open Critical findings
 * that target a leaf RFC’s artifact (or the RFC thread) block merge unless
 * an AcceptedRisk exists on that RFC (CONCEPT §7.6).
 */

import {
  getPrototypeUser,
  type PrototypeUser,
} from "../app/lib/prototype-users";

export const FINDING_SEVERITIES = [
  "low",
  "med",
  "high",
  "critical",
] as const;
export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];

export const FINDING_STATUSES = [
  "open",
  "mitigated",
  "accepted_risk",
  "disputed",
] as const;
export type FindingStatus = (typeof FINDING_STATUSES)[number];

export const FINDING_TARGET_KINDS = [
  "artifact",
  "claim",
  "section",
  "thread",
  "dossier",
] as const;
export type FindingTargetKind = (typeof FINDING_TARGET_KINDS)[number];

export function isFindingSeverity(value: string): value is FindingSeverity {
  return (FINDING_SEVERITIES as readonly string[]).includes(value);
}

export function isFindingStatus(value: string): value is FindingStatus {
  return (FINDING_STATUSES as readonly string[]).includes(value);
}

export function isFindingTargetKind(value: string): value is FindingTargetKind {
  return (FINDING_TARGET_KINDS as readonly string[]).includes(value);
}

/** CONCEPT §8.2 — only Red Team members create Findings. */
export function actorMayCreateFinding(
  authorId: string,
  users: readonly PrototypeUser[] = [],
): boolean {
  const catalog = users.length > 0 ? users : null;
  const user = catalog
    ? catalog.find((u) => u.id === authorId)
    : getPrototypeUser(authorId);
  return Boolean(user?.roles.includes("red_team"));
}

export function isOpenCriticalFinding(row: {
  severity: string;
  status: string;
}): boolean {
  return row.severity === "critical" && row.status === "open";
}
