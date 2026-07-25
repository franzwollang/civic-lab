import { v4 as uuidv4 } from "uuid";

export const ELEMENT_TYPES = {
  PARAGRAPH: "p",
  H2: "h2",
  H3: "h3",
  H4: "h4",

  DATA_BLOCK: "data_block",
  MATH_BLOCK: "math_block",
  MERMAID_BLOCK: "mermaid_block",
  PROCEDURE_BLOCK: "procedure_block",
  IMAGE_BLOCK: "image_block",
  EXTERNAL_ARTIFACT: "external_artifact",

  MATH_INLINE: "math_inline",
  EVIDENCE_BLOCK: "evidence_block",
  EVIDENCE_BLOCK_TEXT: "evidence_block_text",
  EVIDENCE_BLOCK_TRANSLATION: "evidence_block_translation",
  EVIDENCE_BLOCK_DATA: "evidence_block_data",
  EVIDENCE_BLOCK_MATH: "evidence_block_math",
  CITATION_INLINE: "citation_inline",
  TERM_INLINE: "term_inline",
  LINK: "a",
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

export type DataBlockLanguage = "json" | "yaml" | "toml" | "csv";

export type DataBlockElement = {
  type: typeof ELEMENT_TYPES.DATA_BLOCK;
  id: string;
  code: string;
  language: DataBlockLanguage;
  caption?: string;
  children: [SlateText];
};

export type ImageBlockElement = {
  type: typeof ELEMENT_TYPES.IMAGE_BLOCK;
  id: string;
  src: string;
  alt?: string;
  caption?: string;
  children: [SlateText];
};

export type ExternalArtifactElement = {
  type: typeof ELEMENT_TYPES.EXTERNAL_ARTIFACT;
  id: string;
  provider: string;
  general_id: string;
  specific_id: string;
  display_title: string;
  summary?: string;
  license?: string;
  children: [SlateText];
};

export type EvidenceBlockKind = "text" | "data" | "math";

export type EvidenceBlockElement = {
  type: typeof ELEMENT_TYPES.EVIDENCE_BLOCK;
  id: string;
  kind: EvidenceBlockKind;
  lang: string;
  attribution_ref: string;
  locator?: { kind: string; value: string };
  children: Array<SlateElement | SlateText>;
};

export type EvidenceBlockTextElement = {
  type: typeof ELEMENT_TYPES.EVIDENCE_BLOCK_TEXT;
  children: Array<SlateElement | SlateText>;
};

export type EvidenceBlockTranslationElement = {
  type: typeof ELEMENT_TYPES.EVIDENCE_BLOCK_TRANSLATION;
  children: Array<SlateElement | SlateText>;
};

export type EvidenceBlockDataElement = {
  type: typeof ELEMENT_TYPES.EVIDENCE_BLOCK_DATA;
  code: string;
  language: DataBlockLanguage;
  children: [SlateText];
};

export type EvidenceBlockMathElement = {
  type: typeof ELEMENT_TYPES.EVIDENCE_BLOCK_MATH;
  latex: string;
  children: [SlateText];
};

export type CitationInlineElement = {
  type: typeof ELEMENT_TYPES.CITATION_INLINE;
  id: string;
  attribution_ref: string;
  locator?: { kind: string; value: string };
  note?: string;
  children: [SlateText];
};

export type TermInlineElement = {
  type: typeof ELEMENT_TYPES.TERM_INLINE;
  id: string;
  term_ref: string;
  children: Array<SlateElement | SlateText>;
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

const ensureInlineChildren = (node: Record<string, unknown>) => {
  const prev = node.children;
  if (Array.isArray(prev) && prev.length > 0) return false;
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

const ensureLocatorProp = (node: Record<string, unknown>, key = "locator") => {
  const locator = node[key];
  if (!locator) return false;
  if (typeof locator !== "object" || Array.isArray(locator)) {
    delete node[key];
    return true;
  }

  const next = locator as { kind?: unknown; value?: unknown };
  const kind =
    typeof next.kind === "string"
      ? next.kind
      : "page";
  const value = typeof next.value === "string" ? next.value : "";

  const normalized = { kind, value };
  if (
    typeof locator === "object" &&
    (locator as any).kind === kind &&
    (locator as any).value === value
  ) {
    return false;
  }
  node[key] = normalized;
  return true;
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

    if (type === ELEMENT_TYPES.IMAGE_BLOCK) {
      const next = { ...node };
      if (isTopLevel) localChanged = ensureId(next, seenTopLevel) || localChanged;
      localChanged = ensureStringProp(next, "src", "") || localChanged;
      localChanged = ensureStringProp(next, "alt", "") || localChanged;
      localChanged = ensureStringProp(next, "caption", "") || localChanged;
      localChanged = ensureVoidChildren(next) || localChanged;
      return { node: next, changed: localChanged };
    }

    if (type === ELEMENT_TYPES.EXTERNAL_ARTIFACT) {
      const next = { ...node };
      if (isTopLevel) localChanged = ensureId(next, seenTopLevel) || localChanged;
      localChanged = ensureStringProp(next, "provider", "") || localChanged;
      localChanged = ensureStringProp(next, "general_id", "") || localChanged;
      localChanged = ensureStringProp(next, "specific_id", "") || localChanged;
      localChanged = ensureStringProp(next, "display_title", "") || localChanged;
      localChanged = ensureStringProp(next, "summary", "") || localChanged;
      localChanged = ensureStringProp(next, "license", "") || localChanged;
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

    if (type === ELEMENT_TYPES.DATA_BLOCK) {
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

    if (type === ELEMENT_TYPES.EVIDENCE_BLOCK) {
      const next = { ...node };
      if (isTopLevel) localChanged = ensureId(next, seenTopLevel) || localChanged;
      localChanged =
        ensureEnumProp(
        next,
        "kind",
        ["text", "data", "math"] as const,
        "text",
      ) || localChanged;
      localChanged = ensureStringProp(next, "lang", "en") || localChanged;
      localChanged =
        ensureStringProp(next, "attribution_ref", "") || localChanged;
      localChanged = ensureLocatorProp(next) || localChanged;

      const prevChildren = Array.isArray(next.children) ? next.children : [];
      const isTextChild = (child: unknown) =>
        Boolean(child) &&
        typeof child === "object" &&
        (child as { type?: unknown }).type === ELEMENT_TYPES.EVIDENCE_BLOCK_TEXT;
      const isTranslationChild = (child: unknown) =>
        Boolean(child) &&
        typeof child === "object" &&
        (child as { type?: unknown }).type === ELEMENT_TYPES.EVIDENCE_BLOCK_TRANSLATION;
      const isDataChild = (child: unknown) =>
        Boolean(child) &&
        typeof child === "object" &&
        (child as { type?: unknown }).type === ELEMENT_TYPES.EVIDENCE_BLOCK_DATA;
      const isMathChild = (child: unknown) =>
        Boolean(child) &&
        typeof child === "object" &&
        (child as { type?: unknown }).type === ELEMENT_TYPES.EVIDENCE_BLOCK_MATH;

      const kind =
        typeof (next as any).kind === "string" ? String((next as any).kind) : "text";
      const existingText = prevChildren.find(isTextChild) as any;
      const existingTranslation = prevChildren.find(isTranslationChild) as any;
      const existingData = prevChildren.find(isDataChild) as any;
      const existingMath = prevChildren.find(isMathChild) as any;
      const extraChildren = prevChildren.filter(
        (child) =>
          !isTextChild(child) &&
          !isTranslationChild(child) &&
          !isDataChild(child) &&
          !isMathChild(child),
      );

      let textChild: Record<string, unknown>;
      if (existingText) {
        const textChildren = Array.isArray(existingText.children)
          ? existingText.children
          : [];
        const mergedChildren =
          extraChildren.length > 0
            ? [...textChildren, ...extraChildren]
            : textChildren;
        textChild = { ...existingText, children: mergedChildren };
        if (mergedChildren !== textChildren) localChanged = true;
      } else {
        textChild = {
          type: ELEMENT_TYPES.EVIDENCE_BLOCK_TEXT,
          children: extraChildren.length > 0 ? extraChildren : [{ text: "" }],
        };
        localChanged = true;
      }

      let translationChild: Record<string, unknown>;
      if (existingTranslation) {
        translationChild = { ...existingTranslation };
      } else {
        translationChild = {
          type: ELEMENT_TYPES.EVIDENCE_BLOCK_TRANSLATION,
          children: [{ text: "" }],
        };
        localChanged = true;
      }

      if (kind === "data") {
        const dataChild: Record<string, unknown> = existingData
          ? { ...existingData }
          : {
              type: ELEMENT_TYPES.EVIDENCE_BLOCK_DATA,
              code: "",
              language: "json",
              children: [{ text: "" }],
            };
        const mapped = visit(dataChild, false);
        if (mapped.changed) localChanged = true;
        next.children = [mapped.node] as any;
        return { node: next, changed: localChanged };
      }

      if (kind === "math") {
        const mathChild: Record<string, unknown> = existingMath
          ? { ...existingMath }
          : {
              type: ELEMENT_TYPES.EVIDENCE_BLOCK_MATH,
              latex: "",
              children: [{ text: "" }],
            };
        const mapped = visit(mathChild, false);
        if (mapped.changed) localChanged = true;
        next.children = [mapped.node] as any;
        return { node: next, changed: localChanged };
      }

      const mappedChildren = [textChild, translationChild].map((c) => visit(c, false));
      const nextChildren = mappedChildren.map((m) => m.node);
      const anyChildChanged = mappedChildren.some((m) => m.changed);
      if (anyChildChanged) {
        localChanged = true;
      }
      next.children = nextChildren as any;

      return { node: next, changed: localChanged };
    }

    if (
      type === ELEMENT_TYPES.EVIDENCE_BLOCK_TEXT ||
      type === ELEMENT_TYPES.EVIDENCE_BLOCK_TRANSLATION
    ) {
      const next = { ...node };
      if (!Array.isArray(next.children) || next.children.length === 0) {
        next.children = [{ text: "" }];
        localChanged = true;
      } else {
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
    }

    if (type === ELEMENT_TYPES.EVIDENCE_BLOCK_DATA) {
      const next = { ...node };
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

    if (type === ELEMENT_TYPES.EVIDENCE_BLOCK_MATH) {
      const next = { ...node };
      localChanged = ensureStringProp(next, "latex", "") || localChanged;
      localChanged = ensureVoidChildren(next) || localChanged;
      return { node: next, changed: localChanged };
    }

    if (type === ELEMENT_TYPES.CITATION_INLINE) {
      const next = { ...node };
      localChanged = ensureId(next) || localChanged;
      localChanged =
        ensureStringProp(next, "attribution_ref", "") || localChanged;
      localChanged = ensureStringProp(next, "note", "") || localChanged;
      localChanged = ensureLocatorProp(next) || localChanged;
      localChanged = ensureVoidChildren(next) || localChanged;
      return { node: next, changed: localChanged };
    }

    if (type === ELEMENT_TYPES.TERM_INLINE) {
      const next = { ...node };
      localChanged = ensureId(next) || localChanged;
      localChanged = ensureStringProp(next, "term_ref", "") || localChanged;
      localChanged = ensureInlineChildren(next) || localChanged;
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
