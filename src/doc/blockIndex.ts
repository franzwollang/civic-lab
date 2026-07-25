import { stableStringify } from "../crypto/stableStringify";
import { sha256Hex } from "../crypto/hash";
import type { BlockRow } from "./types";
import { getCanonicalPreview } from "./plainTextExport";

function getNodeText(node: unknown): string {
  if (!node || typeof node !== "object") return "";

  if (typeof (node as { text?: unknown }).text === "string") {
    return (node as { text: string }).text;
  }

  const children = (node as { children?: unknown }).children;
  if (!Array.isArray(children)) return "";

  return children.map(getNodeText).join("");
}

function getMathTex(node: unknown): string {
  if (!node || typeof node !== "object") return "";

  const fromProp = (node as { latex?: unknown }).latex;
  return typeof fromProp === "string" ? fromProp : "";
}

function getTextPreview(node: unknown): string {
  if (!node || typeof node !== "object") return "";

  const elementType = (node as { type?: unknown }).type;
  const voidish =
    elementType === "math_inline" ||
    elementType === "math_block" ||
    elementType === "mermaid_block" ||
    elementType === "procedure_block" ||
    elementType === "data_block" ||
    elementType === "image_block" ||
    elementType === "evidence_block" ||
    elementType === "citation_inline" ||
    elementType === "term_inline";

  if (voidish) {
    return getCanonicalPreview(node);
  }

  return getNodeText(node);
}

function normalizeTextNode(node: Record<string, unknown>) {
  const { text, ...rest } = node;
  const marks: Record<string, unknown> = {};
  Object.keys(rest)
    .filter((key) => !key.startsWith("__tmp_"))
    .sort((a, b) => a.localeCompare(b))
    .forEach((key) => {
      marks[key] = rest[key];
    });
  return { text, ...marks };
}

function normalizeForHash(node: unknown): unknown {
  if (!node || typeof node !== "object") return node;

  if (typeof (node as { text?: unknown }).text === "string") {
    return normalizeTextNode(node as Record<string, unknown>);
  }

  const element = node as {
    type?: unknown;
    id?: unknown;
    children?: unknown;
  };

  // Canonicalize math nodes so old/new representations hash identically.
  if (element.type === "math_inline" || element.type === "math_block") {
    return {
      type: element.type,
      id: typeof element.id === "string" ? element.id : "",
      latex: getMathTex(node),
    };
  }

  if (element.type === "mermaid_block") {
    const code =
      typeof (node as { code?: unknown }).code === "string"
        ? String((node as any).code)
        : getNodeText(node);
    return {
      type: "mermaid_block",
      id: typeof element.id === "string" ? element.id : "",
      code,
    };
  }

  if (element.type === "procedure_block") {
    const code =
      typeof (node as { code?: unknown }).code === "string"
        ? String((node as any).code)
        : getNodeText(node);
    const dialect =
      typeof (node as { dialect?: unknown }).dialect === "string"
        ? String((node as any).dialect)
        : "pseudocode.js";
    return {
      type: "procedure_block",
      id: typeof element.id === "string" ? element.id : "",
      code,
      dialect,
    };
  }

  if (element.type === "data_block") {
    const code =
      typeof (node as { code?: unknown }).code === "string"
        ? String((node as any).code)
        : getNodeText(node);
    const language =
      typeof (node as { language?: unknown }).language === "string"
        ? String((node as any).language)
        : "json";
    return {
      type: "data_block",
      id: typeof element.id === "string" ? element.id : "",
      code,
      language,
    };
  }

  if (element.type === "image_block") {
    const src =
      typeof (node as { src?: unknown }).src === "string"
        ? String((node as any).src)
        : "";
    const alt =
      typeof (node as { alt?: unknown }).alt === "string"
        ? String((node as any).alt)
        : "";
    const caption =
      typeof (node as { caption?: unknown }).caption === "string"
        ? String((node as any).caption)
        : "";
    return {
      type: "image_block",
      id: typeof element.id === "string" ? element.id : "",
      src,
      alt,
      caption,
    };
  }

  if (element.type === "evidence_block") {
    const kind =
      typeof (node as { kind?: unknown }).kind === "string"
        ? String((node as any).kind)
        : "text";
    const lang =
      typeof (node as { lang?: unknown }).lang === "string"
        ? String((node as any).lang)
        : "en";
    const attribution_ref =
      typeof (node as { attribution_ref?: unknown }).attribution_ref === "string"
        ? String((node as any).attribution_ref)
        : "";
    const translation =
      typeof (node as { translation?: unknown }).translation === "string"
        ? String((node as any).translation)
        : "";
    const locator =
      typeof (node as { locator?: unknown }).locator === "object" &&
      (node as any).locator !== null &&
      !Array.isArray((node as any).locator)
        ? (node as any).locator
        : undefined;
    const children = Array.isArray(element.children)
      ? element.children.map(normalizeForHash)
      : [];

    return {
      type: "evidence_block",
      id: typeof element.id === "string" ? element.id : "",
      kind,
      lang,
      attribution_ref,
      translation,
      locator,
      children,
    };
  }

  if (element.type === "evidence_block_data") {
    const code =
      typeof (node as { code?: unknown }).code === "string"
        ? String((node as any).code)
        : "";
    const language =
      typeof (node as { language?: unknown }).language === "string"
        ? String((node as any).language)
        : "json";
    return {
      type: "evidence_block_data",
      code,
      language,
    };
  }

  if (element.type === "evidence_block_math") {
    const latex =
      typeof (node as { latex?: unknown }).latex === "string"
        ? String((node as any).latex)
        : "";
    return {
      type: "evidence_block_math",
      latex,
    };
  }

  if (element.type === "citation_inline") {
    const attribution_ref =
      typeof (node as { attribution_ref?: unknown }).attribution_ref === "string"
        ? String((node as any).attribution_ref)
        : "";
    const locator =
      typeof (node as { locator?: unknown }).locator === "object" &&
      (node as any).locator !== null &&
      !Array.isArray((node as any).locator)
        ? (node as any).locator
        : undefined;
    const note =
      typeof (node as { note?: unknown }).note === "string"
        ? String((node as any).note)
        : "";
    return {
      type: "citation_inline",
      id: typeof element.id === "string" ? element.id : "",
      attribution_ref,
      locator,
      note,
    };
  }

  if (element.type === "term_inline") {
    const term_ref =
      typeof (node as { term_ref?: unknown }).term_ref === "string"
        ? String((node as any).term_ref)
        : "";
    const children = Array.isArray(element.children)
      ? element.children.map(normalizeForHash)
      : [];
    return {
      type: "term_inline",
      id: typeof element.id === "string" ? element.id : "",
      term_ref,
      children,
    };
  }

  const children = Array.isArray(element.children)
    ? element.children.map(normalizeForHash)
    : [];

  return {
    type: typeof element.type === "string" ? element.type : "unknown",
    id: typeof element.id === "string" ? element.id : "",
    children,
  };
}

export function extractBlockIndex(content: unknown): BlockRow[] {
  if (!Array.isArray(content)) return [];

  return content.map((block, order) => {
    const normalized = normalizeForHash(block);
    const hash = sha256Hex(stableStringify(normalized));
    const textPreview = getTextPreview(block).trim();

    return {
      block_id:
        block && typeof block === "object" && typeof (block as { id?: unknown }).id === "string"
          ? String((block as { id: string }).id)
          : "",
      type:
        block && typeof block === "object" && typeof (block as { type?: unknown }).type === "string"
          ? String((block as { type: string }).type)
          : "unknown",
      order,
      hash,
      text_preview: textPreview.length > 160 ? `${textPreview.slice(0, 157)}...` : textPreview,
    };
  });
}
