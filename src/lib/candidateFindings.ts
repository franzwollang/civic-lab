/**
 * CONCEPT §7.4–7.5 — Candidate Finding flags + timeline filter helpers.
 *
 * Any prototype user may flag a post as a candidate. Only Red Team members
 * promote candidates into formal Findings (provenance retained on Finding).
 */

import {
  getPrototypeUser,
  type PrototypeUser,
} from "../app/lib/prototype-users";
import { actorMayCreateFinding } from "./findings";

export const CANDIDATE_STATUSES = ["open", "promoted", "dismissed"] as const;
export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number];

export const TIMELINE_FILTERS = [
  "all",
  "findings",
  "findings_responses",
] as const;
export type TimelineFilter = (typeof TIMELINE_FILTERS)[number];

export const TIMELINE_POST_TYPES = ["comment", "mitigation"] as const;
export type TimelinePostType = (typeof TIMELINE_POST_TYPES)[number];

export function isCandidateStatus(value: string): value is CandidateStatus {
  return (CANDIDATE_STATUSES as readonly string[]).includes(value);
}

export function isTimelineFilter(value: string): value is TimelineFilter {
  return (TIMELINE_FILTERS as readonly string[]).includes(value);
}

export function isTimelinePostType(value: string): value is TimelinePostType {
  return (TIMELINE_POST_TYPES as readonly string[]).includes(value);
}

/** Any known prototype user may flag a candidate (observers included later). */
export function actorMayFlagCandidate(
  authorId: string,
  users: readonly PrototypeUser[] = [],
): boolean {
  const catalog = users.length > 0 ? users : null;
  const user = catalog
    ? catalog.find((u) => u.id === authorId)
    : getPrototypeUser(authorId);
  return Boolean(user);
}

/** CONCEPT §7.4 / §8.2 — Red Team promotes candidates into Findings. */
export function actorMayPromoteCandidate(
  authorId: string,
  users: readonly PrototypeUser[] = [],
): boolean {
  return actorMayCreateFinding(authorId, users);
}

export type TimelineItemKind = "finding" | "post";

export type TimelineItemBase = {
  kind: TimelineItemKind;
  created_at: string;
  id: string;
};

/** Whether a post type belongs in the Findings+responses filter. */
export function postMatchesTimelineFilter(
  postType: string,
  filter: TimelineFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "findings") return false;
  // findings_responses: mitigation replies only (not ordinary comments).
  return postType === "mitigation";
}

export function findingMatchesTimelineFilter(
  filter: TimelineFilter,
): boolean {
  return (
    filter === "all" ||
    filter === "findings" ||
    filter === "findings_responses"
  );
}
