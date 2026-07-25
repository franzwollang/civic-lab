import express from "express";
import cors from "cors";
import { z } from "zod";
import { bootstrapDatabase } from "./bootstrap";
import {
  createArtifactRevision,
  getArtifact,
  getAttributions,
  getTerms,
  listArtifactRevisions,
  listArtifacts,
  putAttributions,
  putTerms,
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
  const patch = req.body as Partial<{
    title: string;
    slug: string;
    current_revision_id: string | null;
  }>;
  const updated = await updateArtifact(id, patch);

  if (!updated) {
    res.status(404).json({ error: "Artifact not found" });
    return;
  }

  res.json(updated);
}

// CONCEPT `/api/artifacts` primary; legacy `/api/pages` kept (page_id ≡ artifact id).
app.get("/api/artifacts", handleListArtifacts);
app.get("/api/pages", handleListArtifacts);

app.get("/api/artifacts/:artifactId", handleGetArtifact);
app.get("/api/pages/:pageId", handleGetArtifact);

app.get("/api/artifacts/:artifactId/revisions", handleListRevisions);
app.get("/api/pages/:pageId/revisions", handleListRevisions);

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
