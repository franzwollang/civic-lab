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
  getArtifact,
  getAttributions,
  getSection,
  getTerms,
  listArtifactRevisions,
  listArtifacts,
  listSections,
  putAttributions,
  putTerms,
  revertCanonArtifact,
  setPrisma,
  updateArtifact,
} from "./db";
import { validateRevisionPayload } from "./validateRevision";
import { registerClaimRoutes } from "./routes/claims";
import { registerCorpusRoutes } from "./routes/corpus";
import { registerFindingRoutes } from "./routes/findings";
import { registerHealthRoutes } from "./routes/health";
import { registerModerationRoutes } from "./routes/moderation";
import { registerThreadRoutes } from "./routes/threads";
import { registerUploadRoutes } from "./routes/uploads";

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

/** CONCEPT §9.3 / §9.4 — Owner reverts Canon artifact to a prior revision. */
app.post("/api/artifacts/:artifactId/revert", async (c) => {
  const artifactId = c.req.param("artifactId");
  const body = await c.req.json().catch(() => ({}));
  const actorId =
    typeof (body as { actor_id?: unknown }).actor_id === "string"
      ? (body as { actor_id: string }).actor_id.trim()
      : "";
  if (!actorId) {
    return c.json({ error: "actor_id is required" }, 400);
  }
  const targetRaw = (body as { target_revision_id?: unknown })
    .target_revision_id;
  const target_revision_id =
    typeof targetRaw === "string" && targetRaw.trim()
      ? targetRaw.trim()
      : undefined;

  const result = await revertCanonArtifact({
    artifact_id: artifactId,
    actor_id: actorId,
    target_revision_id,
  });
  if (!result.ok) {
    const status =
      result.error.code === "not_found" ||
      result.error.code === "target_missing"
        ? 404
        : result.error.code === "not_owner" ||
            result.error.code === "not_canon" ||
            result.error.code === "unknown_actor"
          ? 403
          : 400;
    return c.json({ error: result.error }, status);
  }
  return c.json({
    artifact: result.artifact,
    from_revision_id: result.from_revision_id,
    to_revision_id: result.to_revision_id,
    audit: result.audit,
  });
});

registerCorpusRoutes(app);
registerThreadRoutes(app);
registerClaimRoutes(app);
registerFindingRoutes(app);

registerModerationRoutes(app);

registerHealthRoutes(app, PORT);
registerUploadRoutes(app);

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
