import express from "express";
import cors from "cors";
import { z } from "zod";
import { bootstrapDatabase } from "./bootstrap";
import {
  createArtifact,
  createArtifactRevision,
  createClaim,
  createRevSet,
  createThreadPost,
  decideThread,
  getArtifact,
  getAttributions,
  getAreaByKind,
  getClaim,
  getCollection,
  getCollectionDashboard,
  getDossier,
  getSection,
  getTerms,
  getThread,
  listAdjudicationQueue,
  listAreas,
  listArtifactRevisions,
  listArtifacts,
  listArtifactsByDossier,
  listClaims,
  listCollections,
  listDossiers,
  listRevSets,
  listSections,
  listThreads,
  promoteThreadToRfc,
  putAttributions,
  putTerms,
  requestClaimAdjudication,
  adjudicateClaim,
  setPrisma,
  updateArtifact,
} from "./db";
import { validateRevisionPayload } from "./validateRevision";

const app = express();
const PORT = Number(process.env.PORT) || 8787;

app.use(cors());
app.use(express.json({ limit: "2mb" }));

async function handleListArtifacts(
  _req: express.Request,
  res: express.Response,
) {
  const artifacts = await listArtifacts();
  res.json(artifacts);
}

async function handleGetArtifact(req: express.Request, res: express.Response) {
  const id = req.params.artifactId ?? req.params.pageId;
  const artifact = await getArtifact(id);
  if (!artifact) {
    res.status(404).json({ error: "Artifact not found" });
    return;
  }
  res.json(artifact);
}

async function handleListRevisions(
  req: express.Request,
  res: express.Response,
) {
  const id = req.params.artifactId ?? req.params.pageId;
  const filtered = await listArtifactRevisions(id);
  res.json(filtered);
}

async function handleCreateRevision(
  req: express.Request,
  res: express.Response,
) {
  const id = req.params.artifactId ?? req.params.pageId;
  const validated = await validateRevisionPayload(id, req.body);
  if (!validated.ok) {
    res.status(400).json({
      error: validated.error,
      issues: validated.issues,
    });
    return;
  }

  const artifact = await getArtifact(id);
  if (!artifact) {
    res.status(404).json({ error: "Artifact not found" });
    return;
  }

  const created = await createArtifactRevision(validated.revision);
  res.status(201).json(created);
}

async function handlePatchArtifact(
  req: express.Request,
  res: express.Response,
) {
  const id = req.params.artifactId ?? req.params.pageId;
  const body = (req.body ?? {}) as Record<string, unknown>;
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
    res.status(status).json({ error: result.error });
    return;
  }

  res.json(result.artifact);
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
  req: express.Request,
  res: express.Response,
) {
  const parsed = artifactCreateBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid artifact payload" });
    return;
  }
  const result = await createArtifact(parsed.data);
  if (!result.ok) {
    const status =
      result.error.code === "dossier_not_found"
        ? 404
        : result.error.code === "duplicate_id"
          ? 409
          : 422;
    res.status(status).json({ error: result.error });
    return;
  }
  res.status(201).json(result.artifact);
}

// CONCEPT `/api/artifacts` primary; legacy `/api/pages` kept (page_id ≡ artifact id).
app.get("/api/artifacts", handleListArtifacts);
app.get("/api/pages", handleListArtifacts);

app.post("/api/artifacts", handleCreateArtifact);
app.post("/api/pages", handleCreateArtifact);

app.get("/api/artifacts/:artifactId", handleGetArtifact);
app.get("/api/pages/:pageId", handleGetArtifact);

app.get("/api/artifacts/:artifactId/revisions", handleListRevisions);
app.get("/api/pages/:pageId/revisions", handleListRevisions);

app.get("/api/artifacts/:artifactId/sections", async (req, res) => {
  const id = req.params.artifactId;
  const artifact = await getArtifact(id);
  if (!artifact) {
    res.status(404).json({ error: "Artifact not found" });
    return;
  }
  res.json(await listSections(id));
});

app.get("/api/sections/:sectionId", async (req, res) => {
  const section = await getSection(req.params.sectionId);
  if (!section) {
    res.status(404).json({ error: "Section not found" });
    return;
  }
  res.json(section);
});

app.get("/api/attributions", async (_req, res) => {
  const attributions = await getAttributions();
  res.json(attributions);
});

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

app.put("/api/attributions", async (req, res) => {
  const parsed = attributionsRegistrySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).send("Invalid attributions payload");
    return;
  }

  const current = await getAttributions();
  const currentVersion =
    typeof current.version === "number" ? current.version : 1;

  if (parsed.data.version !== currentVersion) {
    res.status(409).send("Attributions version conflict");
    return;
  }

  const next = {
    version: currentVersion + 1,
    items: parsed.data.items,
  };
  const saved = await putAttributions(next);
  res.json(saved);
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

app.get("/api/terms", async (_req, res) => {
  const raw = await getTerms();
  const parsed = termsRegistrySchema.safeParse(raw);
  if (!parsed.success) {
    res.status(500).send("Invalid terms registry in database");
    return;
  }
  res.json(parsed.data);
});

app.put("/api/terms", async (req, res) => {
  const parsed = termsRegistrySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).send("Invalid terms payload");
    return;
  }

  const current = await getTerms();
  const currentVersion =
    typeof current.version === "number" ? current.version : 1;

  if (parsed.data.version !== currentVersion) {
    res.status(409).send("Terms version conflict");
    return;
  }

  const next = {
    version: currentVersion + 1,
    items: parsed.data.items,
  };
  const saved = await putTerms(next);
  res.json(saved);
});

app.post("/api/artifacts/:artifactId/revisions", handleCreateRevision);
app.post("/api/pages/:pageId/revisions", handleCreateRevision);

app.patch("/api/artifacts/:artifactId", handlePatchArtifact);
app.patch("/api/pages/:pageId", handlePatchArtifact);

// M4 corpus IA — Area → Collection → Dossier
app.get("/api/areas", async (_req, res) => {
  res.json(await listAreas());
});

app.get("/api/areas/:areaId/collections", async (req, res) => {
  const area = await listAreas().then((rows) =>
    rows.find((a) => a.area_id === req.params.areaId),
  );
  if (!area) {
    res.status(404).json({ error: "Area not found" });
    return;
  }
  res.json(await listCollections(req.params.areaId));
});

app.get("/api/collections", async (req, res) => {
  const areaId =
    typeof req.query.area_id === "string" ? req.query.area_id : undefined;
  const kind =
    typeof req.query.kind === "string" ? req.query.kind : undefined;
  if (kind) {
    const area = await getAreaByKind(kind);
    if (!area) {
      res.json([]);
      return;
    }
    res.json(await listCollections(area.area_id));
    return;
  }
  res.json(await listCollections(areaId));
});

app.get("/api/collections/:collectionId", async (req, res) => {
  const collection = await getCollection(req.params.collectionId);
  if (!collection) {
    res.status(404).json({ error: "Collection not found" });
    return;
  }
  res.json(collection);
});

/** CONCEPT §11 shared Collection dashboard (dossier health + deferred stubs). */
app.get("/api/collections/:collectionId/dashboard", async (req, res) => {
  const dashboard = await getCollectionDashboard(req.params.collectionId);
  if (!dashboard) {
    res.status(404).json({ error: "Collection not found" });
    return;
  }
  res.json(dashboard);
});

app.get("/api/collections/:collectionId/dossiers", async (req, res) => {
  const collection = await getCollection(req.params.collectionId);
  if (!collection) {
    res.status(404).json({ error: "Collection not found" });
    return;
  }
  res.json(await listDossiers(req.params.collectionId));
});

app.get("/api/dossiers", async (req, res) => {
  const collectionId =
    typeof req.query.collection_id === "string"
      ? req.query.collection_id
      : undefined;
  res.json(await listDossiers(collectionId));
});

app.get("/api/dossiers/:dossierId", async (req, res) => {
  const dossier = await getDossier(req.params.dossierId);
  if (!dossier) {
    res.status(404).json({ error: "Dossier not found" });
    return;
  }
  res.json(dossier);
});

app.get("/api/dossiers/:dossierId/artifacts", async (req, res) => {
  const dossier = await getDossier(req.params.dossierId);
  if (!dossier) {
    res.status(404).json({ error: "Dossier not found" });
    return;
  }
  res.json(await listArtifactsByDossier(req.params.dossierId));
});

// M5 Threads + posts + targets (CONCEPT §3)
app.get("/api/threads", async (req, res) => {
  const homeDossierId =
    typeof req.query.home_dossier_id === "string"
      ? req.query.home_dossier_id
      : undefined;
  const state =
    typeof req.query.state === "string" ? req.query.state : undefined;
  res.json(await listThreads({ homeDossierId, state }));
});

app.get("/api/threads/:threadId", async (req, res) => {
  const thread = await getThread(req.params.threadId);
  if (!thread) {
    res.status(404).json({ error: "Thread not found" });
    return;
  }
  res.json(thread);
});

app.get("/api/dossiers/:dossierId/threads", async (req, res) => {
  const dossier = await getDossier(req.params.dossierId);
  if (!dossier) {
    res.status(404).json({ error: "Dossier not found" });
    return;
  }
  const state =
    typeof req.query.state === "string" ? req.query.state : undefined;
  res.json(
    await listThreads({ homeDossierId: req.params.dossierId, state }),
  );
});

const threadPostBodySchema = z.object({
  post_id: z.string().min(1).optional(),
  author_id: z.string().min(1),
  type: z.string().min(1).optional(),
  body: z.string().min(1),
  created_at: z.string().optional(),
});

app.post("/api/threads/:threadId/posts", async (req, res) => {
  const parsed = threadPostBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid post payload" });
    return;
  }
  const created = await createThreadPost({
    ...parsed.data,
    thread_id: req.params.threadId,
  });
  if (!created) {
    res.status(404).json({ error: "Thread not found" });
    return;
  }
  res.status(201).json(created);
});

const promoteBodySchema = z.object({
  merge_artifact_id: z.string().min(1).optional(),
  author_id: z.string().min(1).optional(),
});

app.post("/api/threads/:threadId/promote", async (req, res) => {
  const parsed = promoteBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid promote payload" });
    return;
  }
  const result = await promoteThreadToRfc({
    thread_id: req.params.threadId,
    ...parsed.data,
  });
  if (!result.ok) {
    const status =
      result.error.code === "not_found"
        ? 404
        : result.error.code === "cross_collection"
          ? 409
          : 400;
    res.status(status).json({ error: result.error });
    return;
  }
  res.json(result.thread);
});

app.get("/api/threads/:threadId/revsets", async (req, res) => {
  const revsets = await listRevSets(req.params.threadId);
  if (!revsets) {
    res.status(404).json({ error: "Thread not found" });
    return;
  }
  res.json(revsets);
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

app.post("/api/threads/:threadId/revsets", async (req, res) => {
  const parsed = revSetBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid RevSet payload" });
    return;
  }
  const result = await createRevSet({
    thread_id: req.params.threadId,
    ...parsed.data,
  });
  if (!result.ok) {
    const status = result.error.code === "not_found" ? 404 : 400;
    res.status(status).json({ error: result.error });
    return;
  }
  res.status(201).json(result.revset);
});

const decideBodySchema = z.object({
  outcome: z.enum(["merged", "rejected", "parked"]),
  author_id: z.string().min(1).optional(),
  revset_version: z.number().int().positive().optional(),
});

app.post("/api/threads/:threadId/decide", async (req, res) => {
  const parsed = decideBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid decide payload" });
    return;
  }
  const result = await decideThread({
    thread_id: req.params.threadId,
    ...parsed.data,
  });
  if (!result.ok) {
    const status =
      result.error.code === "not_found"
        ? 404
        : result.error.code === "already_decided"
          ? 409
          : result.error.code === "forbidden"
            ? 403
            : 400;
    res.status(status).json({ error: result.error });
    return;
  }
  res.json({
    thread: result.thread,
    parent_cascaded: result.parent_cascaded,
  });
});

// M6 Claims (CONCEPT §5) — profile legality by Area/lane
app.get("/api/claims", async (req, res) => {
  const artifactId =
    typeof req.query.artifact_id === "string"
      ? req.query.artifact_id
      : undefined;
  const profile =
    typeof req.query.profile === "string" ? req.query.profile : undefined;
  res.json(await listClaims({ artifactId, profile }));
});

app.get("/api/claims/:claimId", async (req, res) => {
  const claim = await getClaim(req.params.claimId);
  if (!claim) {
    res.status(404).json({ error: "Claim not found" });
    return;
  }
  res.json(claim);
});

app.get("/api/artifacts/:artifactId/claims", async (req, res) => {
  const artifact = await getArtifact(req.params.artifactId);
  if (!artifact) {
    res.status(404).json({ error: "Artifact not found" });
    return;
  }
  res.json(await listClaims({ artifactId: req.params.artifactId }));
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

app.post("/api/claims", async (req, res) => {
  const parsed = claimBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid claim payload" });
    return;
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
    res.status(status).json({ error: result.error });
    return;
  }
  res.status(201).json(result.claim);
});

// M6 adjudication scaffolding (CONCEPT §8.3) — global queue + resolve
app.get("/api/adjudication-queue", async (_req, res) => {
  res.json(await listAdjudicationQueue());
});

const requestAdjudicationSchema = z.object({
  author_id: z.string().min(1),
  note: z.string().nullable().optional(),
});

app.post("/api/claims/:claimId/request-adjudication", async (req, res) => {
  const parsed = requestAdjudicationSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid adjudication request payload" });
    return;
  }
  const result = await requestClaimAdjudication({
    claim_id: req.params.claimId,
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
    res.status(status).json({ error: result.error });
    return;
  }
  res.json(result.claim);
});

const adjudicateSchema = z.object({
  author_id: z.string().min(1),
  status: z.string().min(1),
  rationale: z.string().min(1),
  require_queued: z.boolean().optional(),
});

app.post("/api/claims/:claimId/adjudicate", async (req, res) => {
  const parsed = adjudicateSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid adjudicate payload" });
    return;
  }
  const result = await adjudicateClaim({
    claim_id: req.params.claimId,
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
    res.status(status).json({ error: result.error });
    return;
  }
  res.json(result.claim);
});

async function main() {
  const client = await bootstrapDatabase();
  setPrisma(client);
  app.listen(PORT, () => {
    console.log(`Prisma DB server listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
