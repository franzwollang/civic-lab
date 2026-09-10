/**
 * Image block source rules for the prototype upload pipeline.
 * Allowed raster formats: webp, png, jpeg, gif (URL path or data: URI).
 */

export const IMAGE_UPLOAD_PATH_PREFIX = "/uploads/images/";

const EXT_RE = /\.(webp|png|jpe?g|gif)(\?.*)?$/i;
const DATA_RE = /^data:image\/(webp|png|jpe?g|gif)/i;

export type ImageSrcCheck =
  | { ok: true }
  | { ok: false; reason: "empty" | "unsupported" };

/** True when src looks like an allowed raster image reference. */
export function isAllowedImageSrc(src: string): boolean {
  const trimmed = src.trim();
  if (!trimmed) return false;
  if (DATA_RE.test(trimmed)) return true;
  if (EXT_RE.test(trimmed)) return true;
  return false;
}

export function checkImageSrc(src: string): ImageSrcCheck {
  const trimmed = src.trim();
  if (!trimmed) return { ok: false, reason: "empty" };
  if (isAllowedImageSrc(trimmed)) return { ok: true };
  return { ok: false, reason: "unsupported" };
}

export function imageSrcErrorMessage(reason: "empty" | "unsupported"): string {
  if (reason === "empty") return "Image block is missing a source URL.";
  return "Image source must be a .webp, .png, .jpg, or .gif URL (or matching data: URI). Upload via the editor or paste a supported URL.";
}

/**
 * Resolve stored image src for <img> tags.
 * Relative `/uploads/...` paths are served by the Hono API host.
 */
export function resolveImageSrc(src: string, apiBase?: string): string {
  const trimmed = src.trim();
  if (!trimmed.startsWith("/uploads/")) return trimmed;
  let base = apiBase;
  if (!base) {
    try {
      const env =
        typeof import.meta !== "undefined"
          ? (import.meta as ImportMeta & { env?: { VITE_API_URL?: string } }).env
          : undefined;
      base =
        env && typeof env.VITE_API_URL === "string"
          ? env.VITE_API_URL
          : "http://localhost:8787/api";
    } catch {
      base = "http://localhost:8787/api";
    }
  }
  const origin = String(base).replace(/\/api\/?$/, "");
  return `${origin}${trimmed}`;
}
