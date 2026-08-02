import type { Hono } from "hono";
import { z } from "zod";
import {
  attestUserIdentity,
  changeUserRoles,
  getStewardEligibilityForUser,
  getUserIdentity,
  hideUserFromBoards,
  liftBoardHide,
  listAuditLogs,
  listBoardHides,
  listEffectiveUsers,
  listUserIdentities,
  reloadRoleOverrides,
  requestIdentityVerification,
} from "../db";
import { actorMayViewAuditLog } from "../../src/lib/moderation";

/** CONCEPT §5.9 — Owner board-hide for abuse. */
const boardHideBodySchema = z.object({
  actor_id: z.string().min(1),
  subject_user_id: z.string().min(1),
  reason: z.string().min(1),
});

const boardHideLiftBodySchema = z.object({
  actor_id: z.string().min(1),
  subject_user_id: z.string().min(1),
  note: z.string().nullable().optional(),
});

/** CONCEPT §9.1 — Owner role appointment (full replacement set). */
const roleChangeBodySchema = z.object({
  actor_id: z.string().min(1),
  roles: z.array(z.string()).min(1),
  rationale: z.string().nullable().optional(),
});

/** CONCEPT §8.6 — Owner identity attestation. */
const identityAttestBodySchema = z.object({
  actor_id: z.string().min(1),
  verification_status: z.enum([
    "unverified",
    "pending",
    "verified",
    "rejected",
  ]),
  country_codes: z.array(z.string()).optional(),
  long_term_ties_note: z.string().nullable().optional(),
  provider_stub: z.string().nullable().optional(),
});

const identityRequestBodySchema = z.object({
  actor_id: z.string().min(1),
});

export function registerModerationRoutes(app: Hono): void {
  // M9 anti-gaming — Owner board-hide + append-only audit (CONCEPT §5.9 / §9.4)
  app.get("/api/board-hides", async (c) => {
    const includeLifted = c.req.query("include_lifted") === "1";
    return c.json(await listBoardHides({ include_lifted: includeLifted }));
  });

  app.post("/api/board-hides", async (c) => {
    const parsed = boardHideBodySchema.safeParse(
      (await c.req.json().catch(() => ({}))) ?? {},
    );
    if (!parsed.success) {
      return c.json({ error: "Invalid board-hide payload" }, 400);
    }
    const result = await hideUserFromBoards(parsed.data);
    if (!result.ok) {
      const status =
        result.error.code === "not_owner" ||
        result.error.code === "cannot_hide_self"
          ? 403
          : result.error.code === "already_hidden"
            ? 409
            : result.error.code === "unknown_user"
              ? 404
              : 400;
      return c.json({ error: result.error }, status);
    }
    return c.json({ hide: result.hide, audit: result.audit }, 201);
  });

  app.post("/api/board-hides/lift", async (c) => {
    const parsed = boardHideLiftBodySchema.safeParse(
      (await c.req.json().catch(() => ({}))) ?? {},
    );
    if (!parsed.success) {
      return c.json({ error: "Invalid board-hide lift payload" }, 400);
    }
    const result = await liftBoardHide(parsed.data);
    if (!result.ok) {
      const status =
        result.error.code === "not_owner"
          ? 403
          : result.error.code === "not_hidden" ||
              result.error.code === "unknown_user"
            ? 404
            : 400;
      return c.json({ error: result.error }, status);
    }
    return c.json({ hide: result.hide, audit: result.audit });
  });

  // CONCEPT §9.1 / §9.4 — Owner role appointment + audit
  app.get("/api/users", async (c) => {
    await reloadRoleOverrides();
    return c.json(await listEffectiveUsers());
  });

  app.post("/api/users/:userId/roles", async (c) => {
    const parsed = roleChangeBodySchema.safeParse(
      (await c.req.json().catch(() => ({}))) ?? {},
    );
    if (!parsed.success) {
      return c.json({ error: "Invalid role-change payload" }, 400);
    }
    const result = await changeUserRoles({
      actor_id: parsed.data.actor_id,
      subject_user_id: c.req.param("userId"),
      roles: parsed.data.roles,
      rationale: parsed.data.rationale,
    });
    if (!result.ok) {
      const status =
        result.error.code === "not_owner"
          ? 403
          : result.error.code === "unknown_user" ||
              result.error.code === "unknown_actor"
            ? 404
            : result.error.code === "no_change"
              ? 409
              : 400;
      return c.json({ error: result.error }, status);
    }
    return c.json({ user: result.user, audit: result.audit });
  });

  app.get("/api/audit-logs", async (c) => {
    const actorId = c.req.query("actor_id")?.trim();
    if (!actorId || !actorMayViewAuditLog(actorId)) {
      return c.json(
        {
          error: {
            code: "forbidden",
            message: "Audit log requires steward or Owner (actor_id query)",
          },
        },
        403,
      );
    }
    const action = c.req.query("action") ?? undefined;
    const limitRaw = c.req.query("limit");
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return c.json(
      await listAuditLogs({
        action,
        limit: Number.isFinite(limit) ? limit : undefined,
      }),
    );
  });

  /** CONCEPT §8.6 — real-identity policy hooks (impersonation session + attestation). */
  app.get("/api/identities", async (c) => c.json(await listUserIdentities()));

  app.get("/api/identities/:userId", async (c) => {
    const identity = await getUserIdentity(c.req.param("userId"));
    if (!identity) {
      return c.json({ error: "Identity record not found" }, 404);
    }
    return c.json(identity);
  });

  app.get("/api/identities/:userId/steward-eligibility", async (c) => {
    const country = c.req.query("country") ?? null;
    return c.json(
      await getStewardEligibilityForUser({
        user_id: c.req.param("userId"),
        country_code: country,
      }),
    );
  });

  app.post("/api/identities/:userId/request", async (c) => {
    const parsed = identityRequestBodySchema.safeParse(
      (await c.req.json().catch(() => ({}))) ?? {},
    );
    if (!parsed.success) {
      return c.json({ error: "Invalid identity request payload" }, 400);
    }
    const result = await requestIdentityVerification({
      actor_id: parsed.data.actor_id,
      subject_user_id: c.req.param("userId"),
    });
    if (!result.ok) {
      const status =
        result.error.code === "not_owner"
          ? 403
          : result.error.code === "unknown_user"
            ? 404
            : 400;
      return c.json({ error: result.error }, status);
    }
    return c.json({ identity: result.identity, audit: result.audit });
  });

  app.post("/api/identities/:userId/attest", async (c) => {
    const parsed = identityAttestBodySchema.safeParse(
      (await c.req.json().catch(() => ({}))) ?? {},
    );
    if (!parsed.success) {
      return c.json({ error: "Invalid identity attest payload" }, 400);
    }
    const result = await attestUserIdentity({
      actor_id: parsed.data.actor_id,
      subject_user_id: c.req.param("userId"),
      verification_status: parsed.data.verification_status,
      country_codes: parsed.data.country_codes,
      long_term_ties_note: parsed.data.long_term_ties_note,
      provider_stub: parsed.data.provider_stub,
    });
    if (!result.ok) {
      const status =
        result.error.code === "not_owner"
          ? 403
          : result.error.code === "unknown_user"
            ? 404
            : 400;
      return c.json({ error: result.error }, status);
    }
    return c.json({ identity: result.identity, audit: result.audit });
  });
}
