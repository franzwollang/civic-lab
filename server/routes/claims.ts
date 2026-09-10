import type { Hono } from "hono";
import { z } from "zod";
import {
  adjudicateClaim,
  createClaim,
  getArtifact,
  getClaim,
  listAdjudicationQueue,
  listClaims,
  requestClaimAdjudication,
} from "../db";
import { requireSessionActor } from "../auth/session";

const claimBodySchema = z.object({
  claim_id: z.string().min(1).optional(),
  artifact_id: z.string().min(1),
  section_id: z.string().min(1).nullable().optional(),
  profile: z.enum(["empirical", "requirement"]),
  text: z.string().min(1),
  status: z.string().min(1).optional(),
  empirical_type: z.enum(["fact", "forecast", "model"]).nullable().optional(),
  scope: z.enum(["global", "regional"]).nullable().optional(),
  region_code: z.string().nullable().optional(),
  region_label: z.string().nullable().optional(),
  probability: z.number().nullable().optional(),
  as_of: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
  resolution_criteria: z.string().nullable().optional(),
  preferred_sources: z.array(z.string()).optional(),
  adjudication_rule: z.string().nullable().optional(),
  canon_citations: z.array(z.string()).optional(),
  links: z.array(z.unknown()).optional(),
  author_id: z.string().nullable().optional(),
  created_at: z.string().optional(),
});

const requestAdjudicationSchema = z.object({
  author_id: z.string().min(1).optional(),
  note: z.string().nullable().optional(),
});

const adjudicateSchema = z.object({
  author_id: z.string().min(1).optional(),
  status: z.string().min(1),
  rationale: z.string().min(1),
  require_queued: z.boolean().optional(),
});

/** M6 Claims + §8.3 adjudication queue (CONCEPT §5 / §8.3). */
export function registerClaimRoutes(app: Hono): void {
  app.get("/api/claims", async (c) => {
    const artifactId = c.req.query("artifact_id");
    const profile = c.req.query("profile");
    return c.json(await listClaims({ artifactId, profile }));
  });

  app.get("/api/claims/:claimId", async (c) => {
    const claim = await getClaim(c.req.param("claimId"));
    if (!claim) {
      return c.json({ error: "Claim not found" }, 404);
    }
    return c.json(claim);
  });

  app.get("/api/artifacts/:artifactId/claims", async (c) => {
    const artifactId = c.req.param("artifactId");
    const artifact = await getArtifact(artifactId);
    if (!artifact) {
      return c.json({ error: "Artifact not found" }, 404);
    }
    return c.json(await listClaims({ artifactId }));
  });

  app.post("/api/claims", async (c) => {
    const actor = requireSessionActor(c);
    if (actor instanceof Response) return actor;
    const parsed = claimBodySchema.safeParse(
      (await c.req.json().catch(() => ({}))) ?? {},
    );
    if (!parsed.success) {
      return c.json({ error: "Invalid claim payload" }, 400);
    }
    const result = await createClaim({
      ...parsed.data,
      author_id: actor,
    });
    if (!result.ok) {
      const status =
        result.error.code === "not_found"
          ? 404
          : result.error.code === "section_mismatch" ||
              result.error.code === "no_owner_context"
            ? 400
            : 422;
      return c.json({ error: result.error }, status);
    }
    return c.json(result.claim, 201);
  });

  app.get("/api/adjudication-queue", async (c) => {
    return c.json(await listAdjudicationQueue());
  });

  app.post("/api/claims/:claimId/request-adjudication", async (c) => {
    const actor = requireSessionActor(c);
    if (actor instanceof Response) return actor;
    const parsed = requestAdjudicationSchema.safeParse(
      (await c.req.json().catch(() => ({}))) ?? {},
    );
    if (!parsed.success) {
      return c.json({ error: "Invalid adjudication request payload" }, 400);
    }
    const result = await requestClaimAdjudication({
      claim_id: c.req.param("claimId"),
      author_id: actor,
      note: parsed.data.note,
    });
    if (!result.ok) {
      const status =
        result.error.code === "not_found"
          ? 404
          : result.error.code === "already_queued"
            ? 409
            : 403;
      return c.json({ error: result.error }, status);
    }
    return c.json(result.claim);
  });

  app.post("/api/claims/:claimId/adjudicate", async (c) => {
    const actor = requireSessionActor(c);
    if (actor instanceof Response) return actor;
    const parsed = adjudicateSchema.safeParse(
      (await c.req.json().catch(() => ({}))) ?? {},
    );
    if (!parsed.success) {
      return c.json({ error: "Invalid adjudicate payload" }, 400);
    }
    const result = await adjudicateClaim({
      claim_id: c.req.param("claimId"),
      author_id: actor,
      status: parsed.data.status,
      rationale: parsed.data.rationale,
      require_queued: parsed.data.require_queued,
    });
    if (!result.ok) {
      const status =
        result.error.code === "not_found"
          ? 404
          : result.error.code === "not_adjudicator" ||
              result.error.code === "not_queued"
            ? 403
            : result.error.code === "illegal_status" ||
                result.error.code === "rationale_required" ||
                result.error.code === "unknown_profile"
              ? 422
              : 400;
      return c.json({ error: result.error }, status);
    }
    return c.json(result.claim);
  });
}
