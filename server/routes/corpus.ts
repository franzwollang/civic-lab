import type { Hono } from "hono";
import {
  getAreaByKind,
  getCollection,
  getCollectionDashboard,
  getDossier,
  listAreas,
  listArtifactsByDossier,
  listCollections,
  listDossiers,
  searchCorpus,
} from "../db";

export function registerCorpusRoutes(app: Hono): void {
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
}
