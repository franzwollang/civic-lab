import { v4 as uuidv4 } from "uuid";

export const ELEMENT_TYPES = {
  PARAGRAPH: "p",
  H2: "h2",
  H3: "h3",
  H4: "h4",

  CODE_BLOCK: "code_block",
  MATH_BLOCK: "math_block",
  MERMAID_BLOCK: "mermaid_block",
  PROCEDURE_BLOCK: "procedure_block",

  MATH_INLINE: "math_inline",
} as const;

export type ElementType = (typeof ELEMENT_TYPES)[keyof typeof ELEMENT_TYPES];

export type SlateText = { text: string; [k: string]: unknown };
export type SlateElement = {
  type: string;
  id?: string;
  children: Array<SlateElement | SlateText>;
  [k: string]: unknown;
};

export type MathInlineElement = {
  type: typeof ELEMENT_TYPES.MATH_INLINE;
  id: string;
  latex: string;
  children: [SlateText];
};

export type MathBlockElement = {
  type: typeof ELEMENT_TYPES.MATH_BLOCK;
  id: string;
  latex: string;
  children: [SlateText];
};

export type MermaidBlockElement = {
  type: typeof ELEMENT_TYPES.MERMAID_BLOCK;
  id: string;
  code: string;
  children: [SlateText];
};

export type ProcedureDialect = "pseudocode.js";

export type ProcedureBlockElement = {
  type: typeof ELEMENT_TYPES.PROCEDURE_BLOCK;
  id: string;
  code: string;
  dialect: ProcedureDialect;
  version?: number;
  children: [SlateText];
};

export type CodeBlockLanguage = "json" | "yaml" | "toml" | "csv";

export type CodeBlockElement = {
  type: typeof ELEMENT_TYPES.CODE_BLOCK;
  id: string;
  code: string;
  language: CodeBlockLanguage;
  caption?: string;
  children: [SlateText];
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === "object" && !Array.isArray(v);

const ensureVoidChildren = (node: Record<string, unknown>) => {
  const prev = node.children;
  if (
    Array.isArray(prev) &&
    prev.length === 1 &&
    prev[0] &&
    typeof prev[0] === "object" &&
    !Array.isArray(prev[0]) &&
    (prev[0] as any).text === ""
  ) {
    return false;
  }

  node.children = [{ text: "" }];
  return true;
};

const ensureId = (node: Record<string, unknown>, seen?: Set<string>) => {
  const current = typeof node.id === "string" ? node.id : "";
  let id = current;
  if (!id || (seen && seen.has(id))) id = uuidv4();
  if (seen) seen.add(id);
  node.id = id;
  return id !== current;
};

const ensureStringProp = (
  node: Record<string, unknown>,
  key: string,
  fallback: string,
) => {
  if (typeof node[key] === "string") return false;
  node[key] = fallback;
  return true;
};

const ensureEnumProp = <T extends string>(
  node: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  fallback: T,
) => {
  const v = node[key];
  if (typeof v !== "string" || !allowed.includes(v as T)) {
    node[key] = fallback;
    return true;
  }
  return false;
};

export function normalizeDocumentValue(value: unknown): {
  value: Array<Record<string, unknown>>;
  changed: boolean;
} {
  if (!Array.isArray(value)) return { value: [], changed: true };

  let changed = false;
  const seenTopLevel = new Set<string>();

  const visit = (
    node: unknown,
    isTopLevel: boolean,
  ): { node: unknown; changed: boolean } => {
    if (!isRecord(node)) return { node, changed: false };

    let localChanged = false;
    const type = node.type;
    if (typeof type !== "string") return { node, changed: false };

    // First-class void elements: store payload in stable props, not children.
    if (type === ELEMENT_TYPES.MATH_INLINE) {
      const next = { ...node };
      localChanged = ensureId(next) || localChanged;
      localChanged = ensureStringProp(next, "latex", "") || localChanged;
      localChanged = ensureVoidChildren(next) || localChanged;
      return { node: next, changed: localChanged };
    }

    if (type === ELEMENT_TYPES.MATH_BLOCK) {
      const next = { ...node };
      if (isTopLevel) localChanged = ensureId(next, seenTopLevel) || localChanged;
      localChanged = ensureStringProp(next, "latex", "") || localChanged;
      localChanged = ensureVoidChildren(next) || localChanged;
      return { node: next, changed: localChanged };
    }

    if (type === ELEMENT_TYPES.MERMAID_BLOCK) {
      const next = { ...node };
      if (isTopLevel) localChanged = ensureId(next, seenTopLevel) || localChanged;
      localChanged = ensureStringProp(next, "code", "") || localChanged;
      localChanged = ensureVoidChildren(next) || localChanged;
      return { node: next, changed: localChanged };
    }

    if (type === ELEMENT_TYPES.PROCEDURE_BLOCK) {
      const next = { ...node };
      if (isTopLevel) localChanged = ensureId(next, seenTopLevel) || localChanged;
      localChanged = ensureStringProp(next, "code", "") || localChanged;
      localChanged =
        ensureEnumProp(
        next,
        "dialect",
        ["pseudocode.js"] as const,
        "pseudocode.js",
      ) || localChanged;
      localChanged = ensureVoidChildren(next) || localChanged;
      return { node: next, changed: localChanged };
    }

    if (type === ELEMENT_TYPES.CODE_BLOCK) {
      const next = { ...node };
      if (isTopLevel) localChanged = ensureId(next, seenTopLevel) || localChanged;
      localChanged = ensureStringProp(next, "code", "") || localChanged;
      localChanged =
        ensureEnumProp(
        next,
        "language",
        ["json", "yaml", "toml", "csv"] as const,
        "json",
      ) || localChanged;
      localChanged = ensureVoidChildren(next) || localChanged;
      return { node: next, changed: localChanged };
    }

    // Default blocks (paragraph/headings/etc): ensure top-level ids, recurse.
    const next = { ...node };
    if (isTopLevel) localChanged = ensureId(next, seenTopLevel) || localChanged;

    if (Array.isArray(next.children)) {
      const prevChildren = next.children;
      const mapped = prevChildren.map((c: unknown) => visit(c, false));
      const nextChildren = mapped.map((m) => m.node);
      const anyChildChanged = mapped.some((m) => m.changed);
      if (anyChildChanged) {
        next.children = nextChildren as any;
        localChanged = true;
      }
    }

    return { node: next, changed: localChanged };
  };

  const mapped = value.map((n) => visit(n, true));
  const anyChanged = mapped.some((m) => m.changed);
  if (!anyChanged) return { value: value as any, changed: false };

  changed = true;
  return {
    value: mapped.map((m) => m.node) as Array<Record<string, unknown>>,
    changed,
  };
}
