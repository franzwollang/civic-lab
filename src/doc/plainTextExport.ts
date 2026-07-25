/**
 * Canonical Markdown-ish plain-text export for editor documents.
 * Used for clipboard copy to plain destinations and revision preview/diff text.
 *
 * Round-trippable forms (see `src/editor/voidClipboard.ts`):
 * - math_inline  → `$latex$`
 * - math_block   → `$$\nlatex\n$$`
 * - mermaid      → ```mermaid … ```
 * - data         → ```json|yaml|toml|csv … ```
 * - procedure    → ```pseudocode.js … ```
 * - image        → `![alt](src)` (+ optional caption line)
 * - citation     → `[cite:attribution_ref]`
 * - term         → `[term:term_ref|label]`
 */

const isRecord = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === "object" && !Array.isArray(v);

function fence(lang: string, code: string): string {
  const body = code.replace(/\n$/, "");
  return `\`\`\`${lang}\n${body}\n\`\`\``;
}

function getChildText(node: Record<string, unknown>): string {
  const children = node.children;
  if (!Array.isArray(children)) return "";
  return children.map((child) => serializeNode(child)).join("");
}

function serializeEvidence(node: Record<string, unknown>): string {
  const kind =
    typeof node.kind === "string" ? node.kind : "text";
  const lang = typeof node.lang === "string" ? node.lang : "en";
  const attribution =
    typeof node.attribution_ref === "string" ? node.attribution_ref : "";
  const meta = [`evidence`, kind, `lang=${lang}`];
  if (attribution) meta.push(`attribution=${attribution}`);

  const children = Array.isArray(node.children) ? node.children : [];
  let body = "";

  if (kind === "data") {
    const dataChild = children.find(
      (c) => isRecord(c) && c.type === "evidence_block_data",
    ) as { code?: unknown; language?: unknown } | undefined;
    const language =
      typeof dataChild?.language === "string" ? dataChild.language : "json";
    const code = typeof dataChild?.code === "string" ? dataChild.code : "";
    body = fence(language, code);
  } else if (kind === "math") {
    const mathChild = children.find(
      (c) => isRecord(c) && c.type === "evidence_block_math",
    ) as { latex?: unknown } | undefined;
    const latex = typeof mathChild?.latex === "string" ? mathChild.latex : "";
    body = `$$\n${latex}\n$$`;
  } else {
    const textChild = children.find(
      (c) => isRecord(c) && c.type === "evidence_block_text",
    );
    body = textChild && isRecord(textChild) ? getChildText(textChild) : "";
  }

  return fence(meta.join(" "), body);
}

/** Serialize a single Slate node to canonical plain text. */
export function serializeNode(node: unknown): string {
  if (!isRecord(node)) return "";

  if (typeof node.text === "string") {
    return node.text;
  }

  const type = typeof node.type === "string" ? node.type : "";

  switch (type) {
    case "math_inline": {
      const latex = typeof node.latex === "string" ? node.latex : "";
      return `$${latex}$`;
    }
    case "math_block": {
      const latex = typeof node.latex === "string" ? node.latex : "";
      return `$$\n${latex}\n$$`;
    }
    case "mermaid_block": {
      const code = typeof node.code === "string" ? node.code : "";
      return fence("mermaid", code);
    }
    case "procedure_block": {
      const code = typeof node.code === "string" ? node.code : "";
      const dialect =
        typeof node.dialect === "string" ? node.dialect : "pseudocode.js";
      return fence(dialect, code);
    }
    case "data_block": {
      const code = typeof node.code === "string" ? node.code : "";
      const language =
        typeof node.language === "string" ? node.language : "json";
      return fence(language, code);
    }
    case "image_block": {
      const src = typeof node.src === "string" ? node.src : "";
      const alt = typeof node.alt === "string" ? node.alt : "";
      const caption = typeof node.caption === "string" ? node.caption.trim() : "";
      const image = `![${alt}](${src})`;
      return caption ? `${image}\n${caption}` : image;
    }
    case "citation_inline": {
      const ref =
        typeof node.attribution_ref === "string" ? node.attribution_ref : "";
      return `[cite:${ref}]`;
    }
    case "term_inline": {
      const ref = typeof node.term_ref === "string" ? node.term_ref : "";
      const label = getChildText(node) || "term";
      return `[term:${ref}|${label}]`;
    }
    case "evidence_block":
      return serializeEvidence(node);
    case "h2":
    case "h3":
    case "h4": {
      const level = type === "h2" ? 2 : type === "h3" ? 3 : 4;
      const prefix = "#".repeat(level);
      return `${prefix} ${getChildText(node)}`;
    }
    case "p":
      return getChildText(node);
    default:
      return getChildText(node);
  }
}

/** Serialize a fragment or document (top-level nodes) to plain text. */
export function serializeNodes(nodes: unknown[]): string {
  const parts: string[] = [];
  for (const node of nodes) {
    const text = serializeNode(node);
    if (text.length > 0) parts.push(text);
  }
  return parts.join("\n\n");
}

/** First-line preview derived from the canonical export (for block indexes). */
export function getCanonicalPreview(node: unknown, maxLen = 160): string {
  const full = serializeNode(node).trim();
  const first = full.split("\n")[0] ?? "";
  if (first.length <= maxLen) return first;
  return `${first.slice(0, Math.max(0, maxLen - 1))}…`;
}
