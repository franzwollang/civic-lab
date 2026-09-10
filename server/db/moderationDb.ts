import { randomUUID } from "crypto";
import { getPrototypeUser } from "../../src/app/lib/prototype-users";
import {
  validateBoardHide,
  validateBoardHideLift,
  type AuditAction,
} from "../../src/lib/boardHide";
import { getPrisma } from "./prisma";

/** CONCEPT §5.9 / §9.4 — active board-hide row. */
export type BoardHideRow = {
  hide_id: string;
  subject_user_id: string;
  subject_display_name: string | null;
  hidden_by: string;
  reason: string;
  created_at: string;
  lifted_at: string | null;
  lifted_by: string | null;
};

/** CONCEPT §9.4 — append-only audit entry. */
export type AuditLogRow = {
  audit_id: string;
  action: string;
  actor_id: string;
  subject_id: string | null;
  payload: unknown;
  created_at: string;
};

// —— CONCEPT §5.9 / §9.4 board-hide + append-only audit ——————————————

function mapBoardHide(row: {
  hideId: string;
  subjectUserId: string;
  hiddenBy: string;
  reason: string;
  createdAt: Date;
  liftedAt: Date | null;
  liftedBy: string | null;
}): BoardHideRow {
  return {
    hide_id: row.hideId,
    subject_user_id: row.subjectUserId,
    subject_display_name:
      getPrototypeUser(row.subjectUserId)?.display_name ?? null,
    hidden_by: row.hiddenBy,
    reason: row.reason,
    created_at: row.createdAt.toISOString(),
    lifted_at: row.liftedAt?.toISOString() ?? null,
    lifted_by: row.liftedBy,
  };
}

function mapAuditLog(row: {
  auditId: string;
  action: string;
  actorId: string;
  subjectId: string | null;
  payload: unknown;
  createdAt: Date;
}): AuditLogRow {
  return {
    audit_id: row.auditId,
    action: row.action,
    actor_id: row.actorId,
    subject_id: row.subjectId,
    payload: row.payload,
    created_at: row.createdAt.toISOString(),
  };
}

/** Append-only audit insert (never update/delete). */
export async function appendAuditLog(input: {
  action: AuditAction | string;
  actor_id: string;
  subject_id?: string | null;
  payload?: unknown;
}): Promise<AuditLogRow> {
  const row = await getPrisma().auditLog.create({
    data: {
      auditId: `audit-${randomUUID()}`,
      action: input.action,
      actorId: input.actor_id,
      subjectId: input.subject_id ?? null,
      payload: (input.payload ?? {}) as object,
      createdAt: new Date(),
    },
  });
  return mapAuditLog(row);
}

export async function listAuditLogs(opts?: {
  action?: string;
  limit?: number;
}): Promise<AuditLogRow[]> {
  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
  const rows = await getPrisma().auditLog.findMany({
    where: opts?.action ? { action: opts.action } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map(mapAuditLog);
}

export async function listActiveBoardHides(): Promise<BoardHideRow[]> {
  const rows = await getPrisma().boardHide.findMany({
    where: { liftedAt: null },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(mapBoardHide);
}

export async function listBoardHides(opts?: {
  include_lifted?: boolean;
}): Promise<BoardHideRow[]> {
  const rows = await getPrisma().boardHide.findMany({
    where: opts?.include_lifted ? undefined : { liftedAt: null },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(mapBoardHide);
}

export type BoardHideMutationError =
  | { code: "not_owner"; message: string }
  | { code: "unknown_user"; message: string }
  | { code: "cannot_hide_self"; message: string }
  | { code: "already_hidden"; message: string }
  | { code: "not_hidden"; message: string }
  | { code: "invalid_input"; message: string };

export async function hideUserFromBoards(input: {
  actor_id: string;
  subject_user_id: string;
  reason: string;
}): Promise<
  | { ok: true; hide: BoardHideRow; audit: AuditLogRow }
  | { ok: false; error: BoardHideMutationError }
> {
  const check = validateBoardHide({
    actor_id: input.actor_id,
    subject_user_id: input.subject_user_id,
  });
  if (!check.ok) {
    return { ok: false, error: { code: check.code, message: check.message } };
  }

  const reason = input.reason.trim();
  if (!reason) {
    return {
      ok: false,
      error: { code: "invalid_input", message: "Reason is required" },
    };
  }

  const existing = await getPrisma().boardHide.findFirst({
    where: { subjectUserId: input.subject_user_id, liftedAt: null },
  });
  if (existing) {
    return {
      ok: false,
      error: {
        code: "already_hidden",
        message: `User ${input.subject_user_id} is already hidden from boards`,
      },
    };
  }

  const hideId = `board-hide-${randomUUID()}`;
  const createdAt = new Date();
  const hide = await getPrisma().boardHide.create({
    data: {
      hideId,
      subjectUserId: input.subject_user_id,
      hiddenBy: input.actor_id,
      reason,
      createdAt,
    },
  });

  const audit = await appendAuditLog({
    action: "board_hide",
    actor_id: input.actor_id,
    subject_id: input.subject_user_id,
    payload: {
      hide_id: hideId,
      reason,
    },
  });

  return { ok: true, hide: mapBoardHide(hide), audit };
}

export async function liftBoardHide(input: {
  actor_id: string;
  subject_user_id: string;
  note?: string | null;
}): Promise<
  | { ok: true; hide: BoardHideRow; audit: AuditLogRow }
  | { ok: false; error: BoardHideMutationError }
> {
  const check = validateBoardHideLift({
    actor_id: input.actor_id,
    subject_user_id: input.subject_user_id,
  });
  if (!check.ok) {
    return { ok: false, error: { code: check.code, message: check.message } };
  }

  const existing = await getPrisma().boardHide.findFirst({
    where: { subjectUserId: input.subject_user_id, liftedAt: null },
  });
  if (!existing) {
    return {
      ok: false,
      error: {
        code: "not_hidden",
        message: `User ${input.subject_user_id} is not currently hidden from boards`,
      },
    };
  }

  const liftedAt = new Date();
  const hide = await getPrisma().boardHide.update({
    where: { hideId: existing.hideId },
    data: {
      liftedAt,
      liftedBy: input.actor_id,
    },
  });

  const audit = await appendAuditLog({
    action: "board_hide_lift",
    actor_id: input.actor_id,
    subject_id: input.subject_user_id,
    payload: {
      hide_id: existing.hideId,
      note: input.note ?? null,
      original_reason: existing.reason,
    },
  });

  return { ok: true, hide: mapBoardHide(hide), audit };
}
