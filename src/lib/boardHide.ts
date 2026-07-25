/**
 * CONCEPT §5.9 / §9.4 — Owner board-hide for abuse (anti-gaming).
 *
 * Owner may hide accounts from public/advisory boards; every hide/lift is
 * audit-logged. Hides never grant or revoke permissions — they only affect
 * board visibility. Tighter policy may come later.
 */

import {
  getPrototypeUser,
  type PrototypeUser,
} from "../app/lib/prototype-users";

/** Audit action kinds recorded for board-hide (CONCEPT §9.4). */
export type BoardHideAuditAction = "board_hide" | "board_hide_lift";

/** Broader append-only audit kinds (CONCEPT §9.4 defaults). */
export type AuditAction =
  | BoardHideAuditAction
  | "merge"
  | "revert"
  | "claim_status_change"
  | "adjudication"
  | "accepted_risk"
  | "role_change"
  | "identity_request"
  | "identity_attest"
  | "post_soft_delete";

export type BoardHideErrorCode =
  | "not_owner"
  | "unknown_user"
  | "cannot_hide_self"
  | "already_hidden"
  | "not_hidden";

export type BoardHideValidation =
  | { ok: true }
  | { ok: false; code: BoardHideErrorCode; message: string };

export function actorIsOwner(
  actorId: string,
  users: readonly PrototypeUser[] = [],
): boolean {
  const catalog = users.length > 0 ? users : null;
  const user = catalog
    ? catalog.find((u) => u.id === actorId)
    : getPrototypeUser(actorId);
  return Boolean(user?.roles.includes("owner"));
}

export function validateBoardHide(
  input: {
    actor_id: string;
    subject_user_id: string;
  },
  users: readonly PrototypeUser[] = [],
): BoardHideValidation {
  if (!actorIsOwner(input.actor_id, users)) {
    return {
      ok: false,
      code: "not_owner",
      message:
        "Only the global Owner may hide accounts from boards (CONCEPT §5.9)",
    };
  }
  const subject =
    users.length > 0
      ? users.find((u) => u.id === input.subject_user_id)
      : getPrototypeUser(input.subject_user_id);
  if (!subject) {
    return {
      ok: false,
      code: "unknown_user",
      message: `Unknown subject user: ${input.subject_user_id}`,
    };
  }
  if (input.actor_id === input.subject_user_id) {
    return {
      ok: false,
      code: "cannot_hide_self",
      message: "Owner cannot hide their own account from boards",
    };
  }
  return { ok: true };
}

export function validateBoardHideLift(
  input: {
    actor_id: string;
    subject_user_id: string;
  },
  users: readonly PrototypeUser[] = [],
): BoardHideValidation {
  if (!actorIsOwner(input.actor_id, users)) {
    return {
      ok: false,
      code: "not_owner",
      message:
        "Only the global Owner may lift board hides (CONCEPT §5.9)",
    };
  }
  const subject =
    users.length > 0
      ? users.find((u) => u.id === input.subject_user_id)
      : getPrototypeUser(input.subject_user_id);
  if (!subject) {
    return {
      ok: false,
      code: "unknown_user",
      message: `Unknown subject user: ${input.subject_user_id}`,
    };
  }
  return { ok: true };
}

/** Drop events belonging to hidden users before board aggregation. */
export function filterEventsExcludingHidden<T extends { user_id: string }>(
  events: T[],
  hiddenUserIds: ReadonlySet<string> | readonly string[],
): T[] {
  const hidden =
    hiddenUserIds instanceof Set
      ? hiddenUserIds
      : new Set(hiddenUserIds);
  if (hidden.size === 0) return events;
  return events.filter((e) => !hidden.has(e.user_id));
}
