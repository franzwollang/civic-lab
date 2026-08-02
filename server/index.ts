import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import path from "path";
import { fileURLToPath } from "url";
import { bootstrapDatabase } from "./bootstrap";
import { setPrisma } from "./db";
import { registerArtifactRoutes } from "./routes/artifacts";
import { registerAuthRoutes } from "./routes/auth";
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

// Credentials required for session cookie (Vite :5173 ↔ API :8787, or same-origin /api).
app.use(
  "*",
  cors({
    origin: (origin) => origin || "http://localhost:5173",
    credentials: true,
  }),
);
app.use(
  "*",
  bodyLimit({
    maxSize: BODY_LIMIT,
    onError: (c) => c.text("Payload too large", 413),
  }),
);

registerAuthRoutes(app);
registerArtifactRoutes(app);
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
