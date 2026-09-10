import type { Hono } from "hono";

export function registerHealthRoutes(
  app: Hono,
  port: number = Number(process.env.PORT) || 8787,
): void {
  app.get("/api/health", (c) =>
    c.json({ ok: true, service: "civic-lab-api", port }),
  );
}
