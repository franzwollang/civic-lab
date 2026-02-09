import express from "express";
import cors from "cors";
import { appendRow, readJson, updateRow } from "./db";

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
