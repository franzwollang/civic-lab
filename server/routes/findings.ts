import type { Hono } from "hono";
import { z } from "zod";
import {
  createAcceptedRisk,
  createFinding,
  flagCandidateFinding,
  getAcceptedRiskForThread,
  getCandidateFinding,
  getFinding,
  getThread,
  listCandidateFindings,
  listFindings,
  promoteCandidateFinding,
} from "../db";
import { requireSessionActor } from "../auth/session";

const flagCandidateBodySchema = z.object({
  candidate_id: z.string().min(1).optional(),
  post_id: z.string().min(1),
  flagger_id: z.string().min(1).optional(),
  note: z.string().nullable().optional(),
  created_at: z.string().optional(),
});

const promoteCandidateBodySchema = z.object({
  author_id: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  severity: z.enum(["low", "med", "high", "critical"]),
  likelihood: z.string().nullable().optional(),
  evidence: z.string().nullable().optional(),
  attack_path: z.string().nullable().optional(),
  status: z
    .enum(["open", "mitigated", "accepted_risk", "disputed"])
    .optional(),
  finding_id: z.string().min(1).optional(),
  targets: z
    .array(
      z.object({
        target_kind: z.enum([
          "artifact",
          "claim",
          "section",
          "thread",
          "dossier",
        ]),
        target_id: z.string().min(1),
      }),
    )
    .optional(),
});

const findingBodySchema = z.object({
  finding_id: z.string().min(1).optional(),
  thread_id: z.string().min(1),
  title: z.string().min(1),
  severity: z.enum(["low", "med", "high", "critical"]),
  likelihood: z.string().nullable().optional(),
  status: z
    .enum(["open", "mitigated", "accepted_risk", "disputed"])
    .optional(),
  evidence: z.string().nullable().optional(),
  attack_path: z.string().nullable().optional(),
  author_id: z.string().min(1).optional(),
  created_at: z.string().optional(),
  targets: z
    .array(
      z.object({
        target_kind: z.enum([
          "artifact",
          "claim",
          "section",
          "thread",
          "dossier",
        ]),
        target_id: z.string().min(1),
      }),
    )
    .optional(),
});

const acceptedRiskBodySchema = z.object({
  accepted_risk_id: z.string().min(1).optional(),
  description: z.string().min(1),
  rationale: z.string().min(1),
  evidence_considered: z.string().nullable().optional(),
  reopen_triggers: z.string().nullable().optional(),
  signer_id: z.string().min(1).optional(),
  signed_at: z.string().optional(),
});

/**
 * M7 Findings + Candidate Findings + Accepted Risk (CONCEPT §7).
 * Nested under `/api/threads/...` and top-level `/api/findings` / `/api/candidates`.
 */
export function registerFindingRoutes(app: Hono): void {
  app.get("/api/findings", async (c) => {
    const threadId = c.req.query("thread_id");
    const collectionId = c.req.query("collection_id");
    const severity = c.req.query("severity");
    const status = c.req.query("status");
    return c.json(
      await listFindings({ threadId, collectionId, severity, status }),
    );
  });

  app.get("/api/findings/:findingId", async (c) => {
    const finding = await getFinding(c.req.param("findingId"));
    if (!finding) {
      return c.json({ error: "Finding not found" }, 404);
    }
    return c.json(finding);
  });

  app.get("/api/threads/:threadId/findings", async (c) => {
    const threadId = c.req.param("threadId");
    const thread = await getThread(threadId);
    if (!thread) {
      return c.json({ error: "Thread not found" }, 404);
    }
    return c.json(await listFindings({ threadId }));
  });

  app.post("/api/findings", async (c) => {
    const actor = requireSessionActor(c);
    if (actor instanceof Response) return actor;
    const parsed = findingBodySchema.safeParse(
      (await c.req.json().catch(() => ({}))) ?? {},
    );
    if (!parsed.success) {
      return c.json({ error: "Invalid finding payload" }, 400);
    }
    const result = await createFinding({
      ...parsed.data,
      author_id: actor,
    });
    if (!result.ok) {
      const status =
        result.error.code === "not_found"
          ? 404
          : result.error.code === "forbidden"
            ? 403
            : 422;
      return c.json({ error: result.error }, status);
    }
    return c.json(result.finding, 201);
  });

  app.get("/api/candidates", async (c) => {
    const threadId = c.req.query("thread_id");
    const status = c.req.query("status");
    return c.json(await listCandidateFindings({ threadId, status }));
  });

  app.get("/api/threads/:threadId/candidates", async (c) => {
    const threadId = c.req.param("threadId");
    const thread = await getThread(threadId);
    if (!thread) {
      return c.json({ error: "Thread not found" }, 404);
    }
    const status = c.req.query("status");
    return c.json(await listCandidateFindings({ threadId, status }));
  });

  app.get("/api/candidates/:candidateId", async (c) => {
    const candidate = await getCandidateFinding(c.req.param("candidateId"));
    if (!candidate) {
      return c.json({ error: "Candidate Finding not found" }, 404);
    }
    return c.json(candidate);
  });

  app.post("/api/threads/:threadId/candidates", async (c) => {
    const actor = requireSessionActor(c);
    if (actor instanceof Response) return actor;
    const parsed = flagCandidateBodySchema.safeParse(
      (await c.req.json().catch(() => ({}))) ?? {},
    );
    if (!parsed.success) {
      return c.json({ error: "Invalid candidate flag payload" }, 400);
    }
    const result = await flagCandidateFinding({
      thread_id: c.req.param("threadId"),
      ...parsed.data,
      flagger_id: actor,
    });
    if (!result.ok) {
      const status =
        result.error.code === "not_found"
          ? 404
          : result.error.code === "forbidden"
            ? 403
            : result.error.code === "already_flagged"
              ? 409
              : 422;
      return c.json({ error: result.error }, status);
    }
    return c.json(result.candidate, 201);
  });

  app.post("/api/candidates/:candidateId/promote", async (c) => {
    const actor = requireSessionActor(c);
    if (actor instanceof Response) return actor;
    const parsed = promoteCandidateBodySchema.safeParse(
      (await c.req.json().catch(() => ({}))) ?? {},
    );
    if (!parsed.success) {
      return c.json({ error: "Invalid promote payload" }, 400);
    }
    const result = await promoteCandidateFinding({
      candidate_id: c.req.param("candidateId"),
      ...parsed.data,
      author_id: actor,
    });
    if (!result.ok) {
      const status =
        result.error.code === "not_found"
          ? 404
          : result.error.code === "forbidden"
            ? 403
            : result.error.code === "not_open"
              ? 409
              : 422;
      return c.json({ error: result.error }, status);
    }
    return c.json(
      { finding: result.finding, candidate: result.candidate },
      201,
    );
  });

  app.get("/api/threads/:threadId/accepted-risk", async (c) => {
    const thread = await getThread(c.req.param("threadId"));
    if (!thread) {
      return c.json({ error: "Thread not found" }, 404);
    }
    const ar = await getAcceptedRiskForThread(c.req.param("threadId"));
    return c.json(ar);
  });

  app.post("/api/threads/:threadId/accepted-risk", async (c) => {
    const actor = requireSessionActor(c);
    if (actor instanceof Response) return actor;
    const parsed = acceptedRiskBodySchema.safeParse(
      (await c.req.json().catch(() => ({}))) ?? {},
    );
    if (!parsed.success) {
      return c.json({ error: "Invalid Accepted Risk payload" }, 400);
    }
    const result = await createAcceptedRisk({
      thread_id: c.req.param("threadId"),
      ...parsed.data,
      signer_id: actor,
    });
    if (!result.ok) {
      const status =
        result.error.code === "not_found"
          ? 404
          : result.error.code === "forbidden" ||
              result.error.code === "identity_unverified" ||
              result.error.code === "identity_pending" ||
              result.error.code === "identity_rejected" ||
              result.error.code === "steward_country_mismatch"
            ? 403
            : result.error.code === "already_exists"
              ? 409
              : 400;
      return c.json({ error: result.error }, status);
    }
    return c.json(
      {
        accepted_risk: result.accepted_risk,
        findings_updated: result.findings_updated,
      },
      201,
    );
  });
}
