/**
 * Section plan (M3): extract stable Section drafts from artifact content_json.
 *
 * CONCEPT §2.3 / Appendix A: Section { id, artifact_id, stable_key, title }
 * synced from document structure (headings). Persistence (Prisma Section rows
 * + sync-on-save) waits until ThreadTarget needs them (M5). Until then,
 * `stable_key` = heading block `id` is the contract.
 */

export type SectionLevel = 2 | 3 | 4;

export type SectionDraft = {
  /** Heading block id — durable across title edits. */
  stable_key: string;
  title: string;
  level: SectionLevel;
  order: number;
};

function getNodeText(node: unknown): string {
  if (!node || typeof node !== "object") return "";

  if (typeof (node as { text?: unknown }).text === "string") {
    return (node as { text: string }).text;
  }

  const children = (node as { children?: unknown }).children;
  if (!Array.isArray(children)) return "";

  return children.map(getNodeText).join("");
}

function headingLevel(type: unknown): SectionLevel | null {
  if (type === "h2") return 2;
  if (type === "h3") return 3;
  if (type === "h4") return 4;
  return null;
}

/**
 * Walk top-level blocks; emit a SectionDraft for each heading with a string id.
 * Non-heading blocks and headings missing `id` are skipped.
 */
export function extractSectionsFromContent(content: unknown): SectionDraft[] {
  if (!Array.isArray(content)) return [];

  const sections: SectionDraft[] = [];
  let order = 0;

  for (const node of content) {
    if (!node || typeof node !== "object") continue;

    const el = node as { type?: unknown; id?: unknown };
    const level = headingLevel(el.type);
    if (level === null) continue;
    if (typeof el.id !== "string" || el.id.length === 0) continue;

    const title = getNodeText(node).replace(/\s+/g, " ").trim();
    sections.push({
      stable_key: el.id,
      title: title || `(untitled h${level})`,
      level,
      order,
    });
    order += 1;
  }

  return sections;
}
