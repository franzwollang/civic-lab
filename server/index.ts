import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import path from "path";
import { fileURLToPath } from "url";
import { bootstrapDatabase } from "./bootstrap";
import {
  createArtifact,
  createArtifactRevision,
  createAcceptedRisk,
  createClaim,
  createFinding,
  createRevSet,
  createThreadPost,
  decideThread,
  flagCandidateFinding,
  getAcceptedRiskForThread,
  getArtifact,
  getAttributions,
  getAreaByKind,
  getCandidateFinding,
  getClaim,
  getCollection,
  getCollectionDashboard,
  getDossier,
  getFinding,
  getSection,
  getTerms,
  getThread,
  listAdjudicationQueue,
  listAreas,
  listArtifactRevisions,
  listArtifacts,
  listArtifactsByDossier,
  listAuditLogs,
  listBoardHides,
  listCandidateFindings,
  listClaims,
  listCollections,
  listDossiers,
  listFindings,
  listRevSets,
  listSections,
  listThreads,
  listUserIdentities,
  hideUserFromBoards,
  liftBoardHide,
  promoteCandidateFinding,
  promoteThreadToRfc,
  putAttributions,
  putTerms,
  requestClaimAdjudication,
  requestIdentityVerification,
  adjudicateClaim,
  attestUserIdentity,
  getStewardEligibilityForUser,
  getUserIdentity,
  searchCorpus,
  setPrisma,
  softDeleteThreadPost,
  updateArtifact,
} from "./db";
import { validateRevisionPayload } from "./validateRevision";
import { validateImmutableRef } from "../src/lib/immutableRef";
import { actorMayViewAuditLog } from "../src/lib/moderation";
import { readUploadedImage, saveUploadedImage } from "./uploads";

const PORT = Number(process.env.PORT) || 8787;
const BODY_LIMIT = 2 * 1024 * 1024;

/** Exported for HTTP smokes via `app.request` (avoids only testing server/db). */
export const app = new Hono();

app.use("*", cors());
app.use(
  "*",
  bodyLimit({
    maxSize: BODY_LIMIT,
    onError: (c) => c.text("Payload too large", 413),
  }),
);

async function handleListArtifacts() {
  const artifacts = await listArtifacts();
  return artifacts;
}

async function handleGetArtifact(c: { req: { param: (k: string) => string } }) {
  const id = c.req.param("artifactId") ?? c.req.param("pageId");
  const artifact = await getArtifact(id);
  if (!artifact) {
    return { status: 404 as const, body: { error: "Artifact not found" } };
  }
  return { status: 200 as const, body: artifact };
}

async function handleListRevisions(c: { req: { param: (k: string) => string } }) {
  const id = c.req.param("artifactId") ?? c.req.param("pageId");
  const filtered = await listArtifactRevisions(id);
  return { status: 200 as const, body: filtered };
}

async function handleCreateRevision(
  c: { req: { param: (k: string) => string; json: () => Promise<unknown> } },
) {
  const id = c.req.param("artifactId") ?? c.req.param("pageId");
  const body = await c.req.json();
  const validated = await validateRevisionPayload(id, body);
  if (!validated.ok) {
    return {
      status: 400 as const,
      body: { error: validated.error, issues: validated.issues },
    };
  }

  const artifact = await getArtifact(id);
  if (!artifact) {
    return { status: 404 as const, body: { error: "Artifact not found" } };
  }

  const created = await createArtifactRevision(validated.revision);
  return { status: 201 as const, body: created };
}

async function handlePatchArtifact(
  c: { req: { param: (k: string) => string; json: () => Promise<unknown> } },
) {
  const id = c.req.param("artifactId") ?? c.req.param("pageId");
  const body = ((await c.req.json().catch(() => ({}))) ?? {}) as Record<
    string,
    unknown
  >;
  const lanePresentInPatch = Object.prototype.hasOwnProperty.call(body, "lane");
  const patch = body as Partial<{
    title: string;
    slug: string;
    current_revision_id: string | null;
    dossier_id: string | null;
    lane: string | null;
  }>;
  const result = await updateArtifact(id, patch, { lanePresentInPatch });

  if (!result.ok) {
    const status =
      result.error.code === "not_found"
        ? 404
        : result.error.code === "lane_immutable"
          ? 409
          : 400;
    return { status, body: { error: result.error } };
  }

  return { status: 200 as const, body: result.artifact };
}

const artifactCreateBodySchema = z.object({
  artifact_id: z.string().min(1).optional(),
  title: z.string().min(1),
  slug: z.string().min(1),
  dossier_id: z.string().min(1),
  lane: z
    .enum(["descriptive", "prescriptive", "alignment"])
    .nullable()
    .optional(),
  owner_merge_only: z.boolean().optional(),
  current_revision_id: z.string().nullable().optional(),
  created_at: z.string().optional(),
});

async function handleCreateArtifact(
  c: { req: { json: () => Promise<unknown> } },
) {
  const raw = await c.req.json().catch(() => ({}));
  const parsed = artifactCreateBodySchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return { status: 400 as const, body: { error: "Invalid artifact payload" } };
  }
  const result = await createArtifact(parsed.data);
  if (!result.ok) {
    const status =
      result.error.code === "dossier_not_found"
        ? 404
        : result.error.code === "duplicate_id"
          ? 409
          : 422;
    return { status, body: { error: result.error } };
  }
  return { status: 201 as const, body: result.artifact };
}

const attributionEntitySchema = z.object({
  id: z.string().min(1),
  type: z.enum(["url", "book", "paper", "report", "other"]).default("url"),
  title: z.string().min(1),
  authors: z.array(z.string()).default([]),
  publisher: z.string().optional(),
  date_published: z.string().optional(),
  url: z.string().optional(),
  accessed_at: z.string().optional(),
  immutable_ref: z.string().nullable().optional(),
  notes: z.string().optional(),
});

const attributionsRegistrySchema = z.object({
  version: z.number().int().nonnegative(),
  items: z.array(attributionEntitySchema),
});

const termAliasSchema = z.object({
  lang: z.string().min(1),
  text: z.string().min(1),
  transliteration: z.string().nullable().optional(),
});

const termScopeSchema = z.union([
  z.object({ kind: z.literal("global"), ref: z.string().optional() }),
  z.object({ kind: z.literal("dossier"), ref: z.string().min(1) }),
  z.object({ kind: z.literal("country"), ref: z.string().min(1) }),
]);

const termEntitySchema = z.object({
  id: z.string().min(1),
  scope: termScopeSchema,
  type: z.enum(["local_alias", "platform_construct", "disambiguation"]),
  status: z.enum(["tentative", "accepted"]).default("tentative"),
  canonical_label_en: z.string().min(1),
  aliases: z.array(termAliasSchema),
  definition_en: z.string().min(1),
  disambiguation_en: z.string().optional(),
  see_also_term_ids: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

const termsRegistrySchema = z.object({
  version: z.number().int().nonnegative(),
  items: z.array(termEntitySchema),
});

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

const flagCandidateBodySchema = z.object({
  candidate_id: z.string().min(1).optional(),
  post_id: z.string().min(1),
  flagger_id: z.string().min(1),
  note: z.string().nullable().optional(),
  created_at: z.string().optional(),
});

const promoteCandidateBodySchema = z.object({
  author_id: z.string().min(1),
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
  author_id: z.string().min(1),
  note: z.string().nullable().optional(),
});

const adjudicateSchema = z.object({
  author_id: z.string().min(1),
  status: z.string().min(1),
  rationale: z.string().min(1),
  require_queued: z.boolean().optional(),
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
  author_id: z.string().min(1),
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
  signer_id: z.string().min(1),
  signed_at: z.string().optional(),
});

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

// CONCEPT `/api/artifacts` primary; legacy `/api/pages` kept (page_id ≡ artifact id).
app.get("/api/artifacts", async (c) => c.json(await handleListArtifacts()));
app.get("/api/pages", async (c) => c.json(await handleListArtifacts()));

app.post("/api/artifacts", async (c) => {
  const result = await handleCreateArtifact(c);
  return c.json(result.body, result.status);
});
app.post("/api/pages", async (c) => {
  const result = await handleCreateArtifact(c);
  return c.json(result.body, result.status);
});

app.get("/api/artifacts/:artifactId", async (c) => {
  const result = await handleGetArtifact(c);
  return c.json(result.body, result.status);
});
app.get("/api/pages/:pageId", async (c) => {
  const result = await handleGetArtifact(c);
  return c.json(result.body, result.status);
});

app.get("/api/artifacts/:artifactId/revisions", async (c) => {
  const result = await handleListRevisions(c);
  return c.json(result.body, result.status);
});
app.get("/api/pages/:pageId/revisions", async (c) => {
  const result = await handleListRevisions(c);
  return c.json(result.body, result.status);
});

app.get("/api/artifacts/:artifactId/sections", async (c) => {
  const id = c.req.param("artifactId");
  const artifact = await getArtifact(id);
  if (!artifact) {
    return c.json({ error: "Artifact not found" }, 404);
  }
  return c.json(await listSections(id));
});

app.get("/api/sections/:sectionId", async (c) => {
  const section = await getSection(c.req.param("sectionId"));
  if (!section) {
    return c.json({ error: "Section not found" }, 404);
  }
  return c.json(section);
});

app.get("/api/attributions", async (c) => {
  return c.json(await getAttributions());
});

app.put("/api/attributions", async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parsed = attributionsRegistrySchema.safeParse(raw);
  if (!parsed.success) {
    return c.text("Invalid attributions payload", 400);
  }

  const { validateImmutableRef } = await import("../src/lib/immutableRef");
  const normalizedItems = [];
  for (const item of parsed.data.items) {
    const check = validateImmutableRef(item.immutable_ref);
    if (!check.ok) {
      return c.json(
        {
          error: "invalid_immutable_ref",
          message: check.message,
          attribution_id: item.id,
        },
        400,
      );
    }
    normalizedItems.push({
      ...item,
      immutable_ref: check.parsed?.normalized ?? null,
    });
  }

  const current = await getAttributions();
  const currentVersion =
    typeof current.version === "number" ? current.version : 1;

  if (parsed.data.version !== currentVersion) {
    return c.text("Attributions version conflict", 409);
  }

  const next = {
    version: currentVersion + 1,
    items: normalizedItems,
  };
  const saved = await putAttributions(next);
  return c.json(saved);
});

app.get("/api/terms", async (c) => {
  const raw = await getTerms();
  const parsed = termsRegistrySchema.safeParse(raw);
  if (!parsed.success) {
    return c.text("Invalid terms registry in database", 500);
  }
  return c.json(parsed.data);
});

app.put("/api/terms", async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parsed = termsRegistrySchema.safeParse(raw);
  if (!parsed.success) {
    return c.text("Invalid terms payload", 400);
  }

  const current = await getTerms();
  const currentVersion =
    typeof current.version === "number" ? current.version : 1;

  if (parsed.data.version !== currentVersion) {
    return c.text("Terms version conflict", 409);
  }

  const next = {
    version: currentVersion + 1,
    items: parsed.data.items,
  };
  const saved = await putTerms(next);
  return c.json(saved);
});

app.post("/api/artifacts/:artifactId/revisions", async (c) => {
  const result = await handleCreateRevision(c);
  return c.json(result.body, result.status);
});
app.post("/api/pages/:pageId/revisions", async (c) => {
  const result = await handleCreateRevision(c);
  return c.json(result.body, result.status);
});

app.patch("/api/artifacts/:artifactId", async (c) => {
  const result = await handlePatchArtifact(c);
  return c.json(result.body, result.status);
});
app.patch("/api/pages/:pageId", async (c) => {
  const result = await handlePatchArtifact(c);
  return c.json(result.body, result.status);
});

// M4 corpus IA — Area → Collection → Dossier
app.get("/api/areas", async (c) => c.json(await listAreas()));

app.get("/api/areas/:areaId/collections", async (c) => {
  const areaId = c.req.param("areaId");
  const area = await listAreas().then((rows) =>
    rows.find((a) => a.area_id === areaId),
  );
  if (!area) {
    return c.json({ error: "Area not found" }, 404);
  }
  return c.json(await listCollections(areaId));
});

app.get("/api/collections", async (c) => {
  const areaId = c.req.query("area_id");
  const kind = c.req.query("kind");
  if (kind) {
    const area = await getAreaByKind(kind);
    if (!area) {
      return c.json([]);
    }
    return c.json(await listCollections(area.area_id));
  }
  return c.json(await listCollections(areaId));
});

app.get("/api/collections/:collectionId", async (c) => {
  const collection = await getCollection(c.req.param("collectionId"));
  if (!collection) {
    return c.json({ error: "Collection not found" }, 404);
  }
  return c.json(collection);
});

/** CONCEPT §11 shared Collection dashboard (dossier health + deferred stubs). */
app.get("/api/collections/:collectionId/dashboard", async (c) => {
  const dashboard = await getCollectionDashboard(c.req.param("collectionId"));
  if (!dashboard) {
    return c.json({ error: "Collection not found" }, 404);
  }
  return c.json(dashboard);
});

app.get("/api/collections/:collectionId/dossiers", async (c) => {
  const collectionId = c.req.param("collectionId");
  const collection = await getCollection(collectionId);
  if (!collection) {
    return c.json({ error: "Collection not found" }, 404);
  }
  return c.json(await listDossiers(collectionId));
});

app.get("/api/dossiers", async (c) => {
  const collectionId = c.req.query("collection_id");
  return c.json(await listDossiers(collectionId));
});

/** M8 first-cut discovery search over dossiers / artifacts / threads / claims. */
app.get("/api/search", async (c) => {
  const q = c.req.query("q") ?? "";
  const limitRaw = c.req.query("limit");
  const limit =
    limitRaw != null && limitRaw !== "" ? Number(limitRaw) : undefined;
  return c.json(await searchCorpus(q, limit));
});

app.get("/api/dossiers/:dossierId", async (c) => {
  const dossier = await getDossier(c.req.param("dossierId"));
  if (!dossier) {
    return c.json({ error: "Dossier not found" }, 404);
  }
  return c.json(dossier);
});

app.get("/api/dossiers/:dossierId/artifacts", async (c) => {
  const dossierId = c.req.param("dossierId");
  const dossier = await getDossier(dossierId);
  if (!dossier) {
    return c.json({ error: "Dossier not found" }, 404);
  }
  return c.json(await listArtifactsByDossier(dossierId));
});

// M5 Threads + posts + targets (CONCEPT §3)
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
  const parsed = threadPostBodySchema.safeParse(await c.req.json().catch(() => null));
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
      return c.json({ error: created.error.message, code: created.error.code }, 403);
    }
    return c.json({ error: created.error.message, code: created.error.code }, 400);
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
  const parsed = revSetBodySchema.safeParse(await c.req.json().catch(() => null));
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

// M6 Claims (CONCEPT §5) — profile legality by Area/lane
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
  const parsed = claimBodySchema.safeParse(
    (await c.req.json().catch(() => ({}))) ?? {},
  );
  if (!parsed.success) {
    return c.json({ error: "Invalid claim payload" }, 400);
  }
  const result = await createClaim(parsed.data);
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

// M7 Findings (CONCEPT §7.3) — thread-required; Red Team create
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
  const parsed = findingBodySchema.safeParse(
    (await c.req.json().catch(() => ({}))) ?? {},
  );
  if (!parsed.success) {
    return c.json({ error: "Invalid finding payload" }, 400);
  }
  const result = await createFinding(parsed.data);
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

// M7 Candidate Findings (CONCEPT §7.4) — flag post → RT promote
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
  const parsed = flagCandidateBodySchema.safeParse(
    (await c.req.json().catch(() => ({}))) ?? {},
  );
  if (!parsed.success) {
    return c.json({ error: "Invalid candidate flag payload" }, 400);
  }
  const result = await flagCandidateFinding({
    thread_id: c.req.param("threadId"),
    ...parsed.data,
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
  const parsed = promoteCandidateBodySchema.safeParse(
    (await c.req.json().catch(() => ({}))) ?? {},
  );
  if (!parsed.success) {
    return c.json({ error: "Invalid promote payload" }, 400);
  }
  const result = await promoteCandidateFinding({
    candidate_id: c.req.param("candidateId"),
    ...parsed.data,
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

// M7 Accepted Risk (CONCEPT §7.6) — leaf RFC Critical merge gate
app.get("/api/threads/:threadId/accepted-risk", async (c) => {
  const thread = await getThread(c.req.param("threadId"));
  if (!thread) {
    return c.json({ error: "Thread not found" }, 404);
  }
  const ar = await getAcceptedRiskForThread(c.req.param("threadId"));
  return c.json(ar);
});

app.post("/api/threads/:threadId/accepted-risk", async (c) => {
  const parsed = acceptedRiskBodySchema.safeParse(
    (await c.req.json().catch(() => ({}))) ?? {},
  );
  if (!parsed.success) {
    return c.json({ error: "Invalid Accepted Risk payload" }, 400);
  }
  const result = await createAcceptedRisk({
    thread_id: c.req.param("threadId"),
    ...parsed.data,
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

// M6 adjudication scaffolding (CONCEPT §8.3) — global queue + resolve
app.get("/api/adjudication-queue", async (c) => {
  return c.json(await listAdjudicationQueue());
});

app.post("/api/claims/:claimId/request-adjudication", async (c) => {
  const parsed = requestAdjudicationSchema.safeParse(
    (await c.req.json().catch(() => ({}))) ?? {},
  );
  if (!parsed.success) {
    return c.json({ error: "Invalid adjudication request payload" }, 400);
  }
  const result = await requestClaimAdjudication({
    claim_id: c.req.param("claimId"),
    author_id: parsed.data.author_id,
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
  const parsed = adjudicateSchema.safeParse(
    (await c.req.json().catch(() => ({}))) ?? {},
  );
  if (!parsed.success) {
    return c.json({ error: "Invalid adjudicate payload" }, 400);
  }
  const result = await adjudicateClaim({
    claim_id: c.req.param("claimId"),
    author_id: parsed.data.author_id,
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

app.get("/api/health", (c) =>
  c.json({ ok: true, service: "civic-lab-api", port: PORT }),
);

/** Prototype image upload — stores under uploads/images/; returns relative /uploads/… URL. */
app.post("/api/uploads/images", async (c) => {
  const contentType = c.req.header("content-type") || "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return c.json(
      { error: "Expected multipart/form-data with a `file` field." },
      400,
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await c.req.parseBody({ all: true })) as Record<string, unknown>;
  } catch {
    return c.json({ error: "Could not parse multipart body." }, 400);
  }

  const file = body.file;
  if (!file || typeof file === "string") {
    return c.json({ error: "Missing `file` upload field." }, 400);
  }

  const blob = file as File;
  const mime = blob.type || "application/octet-stream";
  const data = await blob.arrayBuffer();
  const saved = await saveUploadedImage({
    data,
    mime,
    originalName: typeof blob.name === "string" ? blob.name : undefined,
  });
  if (!saved.ok) {
    return c.json({ error: saved.error }, saved.status as 400 | 413 | 415);
  }
  return c.json({
    url: saved.url,
    filename: saved.filename,
    mime: saved.mime,
    bytes: saved.bytes,
  });
});

app.get("/uploads/images/:filename", async (c) => {
  const filename = c.req.param("filename");
  const file = await readUploadedImage(filename);
  if (!file) return c.text("Not found", 404);
  return new Response(file.data, {
    status: 200,
    headers: {
      "Content-Type": file.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});

async function main() {
  const client = await bootstrapDatabase();
  setPrisma(client);
  serve(
    {
      fetch: app.fetch,
      port: PORT,
    },
    () => {
      console.log(`Hono API listening on http://localhost:${PORT}`);
    },
  );
}

// Only listen when this file is the process entrypoint (not when imported by smokes).
const entry = process.argv[1] ? path.resolve(process.argv[1]) : "";
const thisFile = path.resolve(fileURLToPath(import.meta.url));
if (entry === thisFile) {
  main().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
}
