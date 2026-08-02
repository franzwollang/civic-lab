/**
 * Local image upload storage for the prototype (filesystem under uploads/images).
 */
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { IMAGE_UPLOAD_PATH_PREFIX } from "../src/lib/imageSrc";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
export const UPLOADS_IMAGES_DIR = path.join(ROOT, "uploads", "images");

const MIME_TO_EXT: Record<string, string> = {
  "image/webp": "webp",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
};

const EXT_TO_MIME: Record<string, string> = {
  webp: "image/webp",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
};

const SAFE_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,120}\.(webp|png|jpe?g|gif)$/i;

export type UploadImageResult =
  | { ok: true; url: string; filename: string; mime: string; bytes: number }
  | { ok: false; status: number; error: string };

export function extForMime(mime: string): string | null {
  return MIME_TO_EXT[mime.toLowerCase()] ?? null;
}

export function mimeForFilename(name: string): string | null {
  const ext = path.extname(name).slice(1).toLowerCase();
  return EXT_TO_MIME[ext] ?? null;
}

export async function ensureUploadsDir(): Promise<void> {
  await fs.mkdir(UPLOADS_IMAGES_DIR, { recursive: true });
}

export async function saveUploadedImage(input: {
  data: ArrayBuffer | Uint8Array;
  mime: string;
  originalName?: string;
}): Promise<UploadImageResult> {
  const mime = (input.mime || "").toLowerCase().split(";")[0]!.trim();
  const ext = extForMime(mime);
  if (!ext) {
    return {
      ok: false,
      status: 415,
      error: "Unsupported image type. Allowed: webp, png, jpeg, gif.",
    };
  }

  const bytes =
    input.data instanceof Uint8Array
      ? input.data
      : new Uint8Array(input.data);
  if (bytes.byteLength === 0) {
    return { ok: false, status: 400, error: "Empty file." };
  }
  if (bytes.byteLength > 2 * 1024 * 1024) {
    return { ok: false, status: 413, error: "Image exceeds 2MB limit." };
  }

  await ensureUploadsDir();
  const filename = `img-${randomUUID()}.${ext}`;
  const dest = path.join(UPLOADS_IMAGES_DIR, filename);
  await fs.writeFile(dest, bytes);

  return {
    ok: true,
    url: `${IMAGE_UPLOAD_PATH_PREFIX}${filename}`,
    filename,
    mime,
    bytes: bytes.byteLength,
  };
}

export async function readUploadedImage(
  filename: string,
): Promise<{ data: Buffer; mime: string } | null> {
  if (!SAFE_NAME_RE.test(filename)) return null;
  const mime = mimeForFilename(filename);
  if (!mime) return null;
  const full = path.join(UPLOADS_IMAGES_DIR, filename);
  const resolved = path.resolve(full);
  if (!resolved.startsWith(path.resolve(UPLOADS_IMAGES_DIR) + path.sep)) {
    return null;
  }
  try {
    const data = await fs.readFile(resolved);
    return { data, mime };
  } catch {
    return null;
  }
}
