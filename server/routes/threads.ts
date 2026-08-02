import type { Hono } from "hono";
import { z } from "zod";
import {
  createRevSet,
  createThreadPost,
  decideThread,
  getDossier,
  getThread,
  listRevSets,
  listThreads,
  promoteThreadToRfc,
  softDeleteThreadPost,
} from "../db";
import { actorMayViewAuditLog } from "../../src/lib/moderation";

const threadPostBodySchema = z.object({
  post_id: z.string().min(1).optional(),
  author_id: z.string().min(1),
  type: z.enum(["comment", "finding", "mitigation"]).optional(),
  body: z.string().min(1),
  created_at: z.string().optional(),
});

const softDeletePostBodySchema = z.object({
  actor_id: z.string().min(1),
  reason: z.string().optional().nullable(),
});

const promoteBodySchema = z.object({
  merge_artifact_id: z.string().min(1).optional(),
  author_id: z.string().min(1).optional(),
});

const revSetBodySchema = z
  .object({
    author_id: z.string().min(1),
    summary: z.string().nullable().optional(),
    content_json: z.unknown().optional(),
    artifact_revision_id: z.string().min(1).optional(),
    revset_id: z.string().min(1).optional(),
  })
  .refine(
    (b) => b.artifact_revision_id != null || b.content_json !== undefined,
    { message: "content_json or artifact_revision_id required" },
  );

const decideBodySchema = z.object({
  outcome: z.enum(["merged", "rejected", "parked"]),
  author_id: z.string().min(1).optional(),
  revset_version: z.number().int().positive().optional(),
});

/** M5 Threads + posts + targets + RFC promote/RevSet/decide (CONCEPT §3). */
export function registerThreadRoutes(app: Hono): void {
  app.get("/api/threads", async (c) => {
    const homeDossierId = c.req.query("home_dossier_id");
    const state = c.req.query("state");
    return c.json(await listThreads({ homeDossierId, state }));
  });

  app.get("/api/threads/:threadId", async (c) => {
    const wantDeleted = c.req.query("include_deleted") === "1";
    let includeDeleted = false;
    if (wantDeleted) {
      const actorId = c.req.query("actor_id")?.trim();
      if (!actorId || !actorMayViewAuditLog(actorId)) {
        return c.json(
          {
            error: {
              code: "forbidden",
              message:
                "include_deleted requires steward or Owner (actor_id query)",
            },
          },
          403,
        );
      }
      includeDeleted = true;
    }
    const thread = await getThread(c.req.param("threadId"), {
      include_deleted_posts: includeDeleted,
    });
    if (!thread) {
      return c.json({ error: "Thread not found" }, 404);
    }
    return c.json(thread);
  });

  app.get("/api/dossiers/:dossierId/threads", async (c) => {
    const dossierId = c.req.param("dossierId");
    const dossier = await getDossier(dossierId);
    if (!dossier) {
      return c.json({ error: "Dossier not found" }, 404);
    }
    const state = c.req.query("state");
    return c.json(await listThreads({ homeDossierId: dossierId, state }));
  });

  app.post("/api/threads/:threadId/posts", async (c) => {
    const parsed = threadPostBodySchema.safeParse(
      await c.req.json().catch(() => null),
    );
    if (!parsed.success) {
      return c.json({ error: "Invalid post payload" }, 400);
    }
    const created = await createThreadPost({
      ...parsed.data,
      thread_id: c.req.param("threadId"),
    });
    if (!created.ok) {
      if (created.error.code === "not_found") {
        return c.json({ error: created.error.message }, 404);
      }
      if (created.error.code === "forbidden") {
        return c.json(
          { error: created.error.message, code: created.error.code },
          403,
        );
      }
      return c.json(
        { error: created.error.message, code: created.error.code },
        400,
      );
    }
    return c.json(created.post, 201);
  });

  /** CONCEPT §9.4 — soft-delete ordinary post (steward Manual / Owner global). */
  app.post("/api/threads/:threadId/posts/:postId/soft-delete", async (c) => {
    const parsed = softDeletePostBodySchema.safeParse(
      (await c.req.json().catch(() => ({}))) ?? {},
    );
    if (!parsed.success) {
      return c.json({ error: "Invalid soft-delete payload" }, 400);
    }
    const threadId = c.req.param("threadId");
    const postId = c.req.param("postId");
    const result = await softDeleteThreadPost({
      post_id: postId,
      thread_id: threadId,
      actor_id: parsed.data.actor_id,
      reason: parsed.data.reason,
    });
    if (!result.ok) {
      const status =
        result.error.code === "forbidden" ||
        result.error.code === "canon_owner_only" ||
        result.error.code === "steward_country_mismatch" ||
        result.error.code === "identity_unverified" ||
        result.error.code === "identity_pending" ||
        result.error.code === "identity_rejected"
          ? 403
          : result.error.code === "not_found"
            ? 404
            : result.error.code === "already_deleted"
              ? 409
              : 400;
      return c.json({ error: result.error }, status);
    }
    return c.json({ post: result.post, audit: result.audit });
  });

  app.post("/api/threads/:threadId/promote", async (c) => {
    const parsed = promoteBodySchema.safeParse(
      (await c.req.json().catch(() => ({}))) ?? {},
    );
    if (!parsed.success) {
      return c.json({ error: "Invalid promote payload" }, 400);
    }
    const result = await promoteThreadToRfc({
      thread_id: c.req.param("threadId"),
      ...parsed.data,
    });
    if (!result.ok) {
      const status =
        result.error.code === "not_found"
          ? 404
          : result.error.code === "cross_collection"
            ? 409
            : 400;
      return c.json({ error: result.error }, status);
    }
    return c.json(result.thread);
  });

  app.get("/api/threads/:threadId/revsets", async (c) => {
    const revsets = await listRevSets(c.req.param("threadId"));
    if (!revsets) {
      return c.json({ error: "Thread not found" }, 404);
    }
    return c.json(revsets);
  });

  app.post("/api/threads/:threadId/revsets", async (c) => {
    const parsed = revSetBodySchema.safeParse(
      await c.req.json().catch(() => null),
    );
    if (!parsed.success) {
      return c.json({ error: "Invalid RevSet payload" }, 400);
    }
    const result = await createRevSet({
      thread_id: c.req.param("threadId"),
      ...parsed.data,
    });
    if (!result.ok) {
      const status = result.error.code === "not_found" ? 404 : 400;
      return c.json({ error: result.error }, status);
    }
    return c.json(result.revset, 201);
  });

  app.post("/api/threads/:threadId/decide", async (c) => {
    const parsed = decideBodySchema.safeParse(
      (await c.req.json().catch(() => ({}))) ?? {},
    );
    if (!parsed.success) {
      return c.json({ error: "Invalid decide payload" }, 400);
    }
    const result = await decideThread({
      thread_id: c.req.param("threadId"),
      ...parsed.data,
    });
    if (!result.ok) {
      const status =
        result.error.code === "not_found"
          ? 404
          : result.error.code === "already_decided" ||
              result.error.code === "critical_unaccepted"
            ? 409
            : result.error.code === "forbidden" ||
                result.error.code === "identity_unverified" ||
                result.error.code === "identity_pending" ||
                result.error.code === "identity_rejected" ||
                result.error.code === "steward_country_mismatch"
              ? 403
              : 400;
      return c.json({ error: result.error }, status);
    }
    return c.json({
      thread: result.thread,
      parent_cascaded: result.parent_cascaded,
    });
  });
}
