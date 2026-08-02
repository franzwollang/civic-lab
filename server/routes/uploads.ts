import type { Hono } from "hono";
import { readUploadedImage, saveUploadedImage } from "../uploads";

export function registerUploadRoutes(app: Hono): void {
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
}
