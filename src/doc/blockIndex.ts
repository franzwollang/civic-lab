import { stableStringify } from "../crypto/stableStringify";
import { sha256Hex } from "../crypto/hash";
import type { BlockRow } from "./types";

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
  if (elementType === "math_inline" || elementType === "math_block") {
    const tex = getMathTex(node);
    return elementType === "math_block" ? `$$${tex}$$` : `$${tex}$`;
  }

  if (elementType === "mermaid_block") {
    const code = (node as { code?: unknown }).code;
    const text =
      typeof code === "string" ? code : getNodeText(node);
    const first = text.trim().split("\n")[0] ?? "";
    return `mermaid: ${first}`;
  }

  if (elementType === "procedure_block") {
    const code = (node as { code?: unknown }).code;
    const text =
      typeof code === "string" ? code : getNodeText(node);
    const first = text.trim().split("\n")[0] ?? "";
    return `procedure: ${first}`;
  }

  if (elementType === "code_block") {
    const language =
      typeof (node as { language?: unknown }).language === "string"
        ? String((node as any).language)
        : "code";
    const code = (node as { code?: unknown }).code;
    const text =
      typeof code === "string" ? code : getNodeText(node);
    const first = text.trim().split("\n")[0] ?? "";
    return `${language}: ${first}`;
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

  if (element.type === "code_block") {
    const code =
      typeof (node as { code?: unknown }).code === "string"
        ? String((node as any).code)
        : getNodeText(node);
    const language =
      typeof (node as { language?: unknown }).language === "string"
        ? String((node as any).language)
        : "json";
    return {
      type: "code_block",
      id: typeof element.id === "string" ? element.id : "",
      code,
      language,
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
