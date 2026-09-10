/**
 * CONCEPT §9.4 / §8.3 — Moderation queue helpers (soft-deleted posts +
 * open findings + adjudication). Steward/Owner see audit-gated surfaces;
 * adjudicators see the claim adjudication tab.
 */
import type { PrototypeUser } from "../app/lib/prototype-users";
import {
  userHasCapability,
  type RoleCapability,
} from "../app/lib/role-affordances";
import type { AuditLogRow } from "../doc/types";

export type SoftDeleteAuditPayload = {
  thread_id: string | null;
  author_id: string | null;
  collection_id: string | null;
  area_kind: "canon" | "manuals" | string | null;
  country_code: string | null;
  reason: string | null;
};

export type ModQueueTab = "deleted-posts" | "open-findings" | "adjudication";

/** Who may open the /mod surface at all. */
export function canAccessModQueue(user: PrototypeUser | undefined): boolean {
  return (
    userHasCapability(user, "view_audit") ||
    userHasCapability(user, "adjudicate_claims")
  );
}

export function modQueueTabsForUser(
  user: PrototypeUser | undefined,
): ModQueueTab[] {
  const tabs: ModQueueTab[] = [];
  if (userHasCapability(user, "view_audit")) {
    tabs.push("deleted-posts", "open-findings");
  }
  // Adjudicators always get adjudication; steward/Owner may view read-only.
  if (
    userHasCapability(user, "adjudicate_claims") ||
    userHasCapability(user, "view_audit")
  ) {
    tabs.push("adjudication");
  }
  return tabs;
}

export function defaultModQueueTab(
  user: PrototypeUser | undefined,
): ModQueueTab {
  const tabs = modQueueTabsForUser(user);
  return tabs[0] ?? "open-findings";
}

/** Capability required to load soft-delete audit rows via API. */
export const MOD_QUEUE_DELETED_CAPABILITY: RoleCapability = "view_audit";

export function parseSoftDeletePayload(payload: unknown): SoftDeleteAuditPayload {
  const p =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};
  const area =
    typeof p.area_kind === "string" ? p.area_kind : null;
  return {
    thread_id: typeof p.thread_id === "string" ? p.thread_id : null,
    author_id: typeof p.author_id === "string" ? p.author_id : null,
    collection_id:
      typeof p.collection_id === "string" ? p.collection_id : null,
    area_kind: area,
    country_code:
      typeof p.country_code === "string" ? p.country_code : null,
    reason: typeof p.reason === "string" ? p.reason : null,
  };
}

/**
 * Stewards only moderate Manual Collections (CONCEPT §9.4) — hide Canon
 * soft-deletes from their queue. Owner sees everything.
 */
export function filterSoftDeleteAuditsForActor(
  rows: AuditLogRow[],
  user: PrototypeUser | undefined,
): AuditLogRow[] {
  if (!user) return [];
  const isOwner = user.roles.includes("owner");
  return rows.filter((row) => {
    if (row.action !== "post_soft_delete") return false;
    if (isOwner) return true;
    const payload = parseSoftDeletePayload(row.payload);
    return payload.area_kind !== "canon";
  });
}

export function softDeleteThreadHref(payload: SoftDeleteAuditPayload): string | null {
  if (!payload.thread_id) return null;
  return `/thread/${payload.thread_id}`;
}

export function findingThreadHref(finding: {
  finding_id: string;
  thread_id: string;
}): string {
  return `/thread/${finding.thread_id}#finding-${finding.finding_id}`;
}
