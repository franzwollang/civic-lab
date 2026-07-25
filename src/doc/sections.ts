/**
 * Section extraction + id helper (CONCEPT §2.3 / Appendix A).
 *
 * `stable_key` = heading block `id` (durable across title edits; not text
 * offsets). Prisma `Section` rows are synced on revision save / seed via
 * `syncSectionsForArtifact` in `server/db.ts`. ThreadTarget uses
 * `target_kind=section` + deterministic `section_id`.
 */

export type SectionLevel = 2 | 3 | 4;

export type SectionDraft = {
  /** Heading block id — durable across title edits. */
  stable_key: string;
  title: string;
  level: SectionLevel;
  order: number;
};

/** Deterministic Section primary key for seed + ThreadTarget wiring. */
export function sectionIdFor(artifactId: string, stableKey: string): string {
  return `sec_${artifactId}__${stableKey}`;
}

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
