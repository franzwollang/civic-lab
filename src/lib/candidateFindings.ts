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

/** Ordinary discussion + Red Team typed posts on the thread timeline. */
export const TIMELINE_POST_TYPES = [
  "comment",
  "finding",
  "mitigation",
] as const;
export type TimelinePostType = (typeof TIMELINE_POST_TYPES)[number];

/** Typed posts reserved for Red Team (CONCEPT §7 / §8.2). */
export const RED_TEAM_POST_TYPES = ["finding", "mitigation"] as const;
export type RedTeamPostType = (typeof RED_TEAM_POST_TYPES)[number];

export function isCandidateStatus(value: string): value is CandidateStatus {
  return (CANDIDATE_STATUSES as readonly string[]).includes(value);
}

export function isTimelineFilter(value: string): value is TimelineFilter {
  return (TIMELINE_FILTERS as readonly string[]).includes(value);
}

export function isTimelinePostType(value: string): value is TimelinePostType {
  return (TIMELINE_POST_TYPES as readonly string[]).includes(value);
}

export function isRedTeamPostType(value: string): value is RedTeamPostType {
  return (RED_TEAM_POST_TYPES as readonly string[]).includes(value);
}

/** CONCEPT §8.2 — only Red Team may post typed finding/mitigation replies. */
export function actorMayPostTypedFindingOrMitigation(
  authorId: string,
  users: readonly PrototypeUser[] = [],
): boolean {
  return actorMayCreateFinding(authorId, users);
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

/**
 * Whether a post type belongs under a timeline filter.
 * - findings: typed finding posts (formal Finding rows are separate)
 * - findings_responses: finding + mitigation replies
 * - all: every post
 */
export function postMatchesTimelineFilter(
  postType: string,
  filter: TimelineFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "findings") return postType === "finding";
  // findings_responses: typed finding notes + mitigation replies.
  return postType === "finding" || postType === "mitigation";
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
