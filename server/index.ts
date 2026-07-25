import express from "express";
import cors from "cors";
import { appendRow, readJson, updateRow, writeJson } from "./db";
import { z } from "zod";

const app = express();
const PORT = Number(process.env.PORT) || 8787;

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/api/pages", async (_req, res) => {
  const pages = await readJson<Array<Record<string, unknown>>>("pages.json");
  res.json(pages);
});

app.get("/api/pages/:pageId", async (req, res) => {
  const pages = await readJson<Array<Record<string, unknown>>>("pages.json");
  const page = pages.find((row) => row.page_id === req.params.pageId);
  if (!page) {
    res.status(404).json({ error: "Page not found" });
    return;
  }
  res.json(page);
});

app.get("/api/pages/:pageId/revisions", async (req, res) => {
  const revisions = await readJson<Array<Record<string, unknown>>>(
    "page_revisions.json",
  );
  const filtered = revisions
    .filter((row) => row.page_id === req.params.pageId)
    .sort((a, b) => {
      const aTime = new Date(String(a.created_at)).getTime();
      const bTime = new Date(String(b.created_at)).getTime();
      return bTime - aTime;
    });
  res.json(filtered);
});

app.get("/api/attributions", async (_req, res) => {
  const attributions = await readJson<Record<string, unknown>>(
    "attributions.json",
  );
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

  const current = await readJson<Record<string, unknown>>("attributions.json");
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
  await writeJson("attributions.json", next);
  res.json(next);
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
  const raw = await readJson<Record<string, unknown>>("terms.json");
  const parsed = termsRegistrySchema.safeParse(raw);
  if (!parsed.success) {
    res.status(500).send("Invalid terms registry on disk");
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

  const current = await readJson<Record<string, unknown>>("terms.json");
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
  await writeJson("terms.json", next);
  res.json(next);
});

app.post("/api/pages/:pageId/revisions", async (req, res) => {
  const payload = req.body;
  if (!payload || payload.page_id !== req.params.pageId) {
    res.status(400).json({ error: "Invalid revision payload" });
    return;
  }

  const created = await appendRow("page_revisions.json", payload);
  res.status(201).json(created);
});

app.patch("/api/pages/:pageId", async (req, res) => {
  const patch = req.body;
  const updated = await updateRow(
    "pages.json",
    (row) => row.page_id === req.params.pageId,
    patch,
  );

  if (!updated) {
    res.status(404).json({ error: "Page not found" });
    return;
  }

  res.json(updated);
});

app.listen(PORT, () => {
  console.log(`JSON DB server listening on http://localhost:${PORT}`);
});
