import type { ChangeEvent, KeyboardEvent, MouseEvent } from "react";
import { useEffect, useRef } from "react";
import type { PlateElementProps } from "platejs/react";
import { PlateElement, useSelected } from "platejs/react";
import { createSlatePlugin } from "platejs";
import { Editor, Element, Transforms } from "slate";

import { useCollapseContext } from "@/editor/collapse";
import { useEvidenceRegistry } from "@/editor/evidenceRegistry";
import { useEvidenceModals } from "@/editor/evidenceModals";
import { DataBlockComponent } from "@/editor/void-blocks";
import { MathBlockComponent } from "@/editor/math-nodes";
import type { Locator } from "@/doc/evidence";
import {
  REMOVE_BUTTON_BASE,
  removeButtonKeyDown,
  truncateForAria,
  voidPreviewKeyDown,
} from "@/editor/voidA11y";

const LOCATOR_KINDS = [
  "page",
  "timestamp",
  "section",
  "url_fragment",
  "other",
] as const;

const LANG_SUGGESTIONS = [
  "en",
  "es",
  "fr",
  "de-DE",
  "pt-BR",
  "zh",
  "ja",
  "ru",
  "ar",
];

type EvidenceBlockElement = {
  type: "evidence_block";
  id?: string;
  kind?: "text" | "data" | "math";
  lang?: string;
  attribution_ref?: string;
  locator?: Locator;
  children: Array<Record<string, unknown>>;
};

type EvidenceBlockTextElement = {
  type: "evidence_block_text";
  children: Array<Record<string, unknown>>;
};

type EvidenceBlockTranslationElement = {
  type: "evidence_block_translation";
  children: Array<Record<string, unknown>>;
};

type CitationInlineElement = {
  type: "citation_inline";
  id?: string;
  attribution_ref?: string;
  locator?: Locator;
  note?: string;
  children: Array<{ text: string }>;
};

type TermInlineElement = {
  type: "term_inline";
  id?: string;
  term_ref?: string;
  children: Array<{ text: string }>;
};

const getAttributionLabel = (item: { title?: string; url?: string; id: string }) => {
  if (item.title && item.title.trim()) return item.title;
  if (item.url && item.url.trim()) return item.url;
  return item.id;
};

const getTermLabel = (item: { canonical_label_en?: string; id: string }) => {
  if (item.canonical_label_en && item.canonical_label_en.trim()) return item.canonical_label_en;
  return item.id;
};

function EvidenceBlockComponent(props: PlateElementProps) {
  const el = props.element as EvidenceBlockElement;
  const id = typeof el.id === "string" ? el.id : undefined;
  const collapse = useCollapseContext();
  const hidden = id ? collapse?.isHidden(id) : false;
  if (hidden) return null;

  const { attributions } = useEvidenceRegistry();
  const modals = useEvidenceModals();
  const selected = useSelected();
  const kind = el.kind === "data" || el.kind === "math" ? el.kind : "text";
  const lang = typeof el.lang === "string" && el.lang.trim() ? el.lang : "en";
  const attributionRef = typeof el.attribution_ref === "string" ? el.attribution_ref : "";
  const locator = el.locator && typeof el.locator === "object" ? el.locator : undefined;
  const locatorKind = locator?.kind ?? "page";
  const locatorValue = locator?.value ?? "";

  const missingAttribution = !attributionRef;
  const attributionLabel = attributionRef
    ? getAttributionLabel(
        attributions.items.find((item) => item.id === attributionRef) ?? {
          id: attributionRef,
        },
      )
    : "";
  const locatorInputRef = useRef<HTMLInputElement | null>(null);
  const locatorKindRef = useRef<HTMLSelectElement | null>(null);

  useEffect(() => {
    let node: unknown;
    try {
      node = Editor.node(props.editor, props.path)?.[0];
    } catch {
      node = undefined;
    }
    if (!node || !Element.isElement(node)) return;
    const children = Array.isArray(node.children) ? node.children : [];
    const childTypes = new Set(
      children.map((child) =>
        child && typeof child === "object" ? (child as any).type : null,
      ),
    );

    const hasText = childTypes.has("evidence_block_text");
    const hasTranslation = childTypes.has("evidence_block_translation");
    const hasData = childTypes.has("evidence_block_data");
    const hasMath = childTypes.has("evidence_block_math");

    const removeChildTypes = (types: string[]) => {
      Transforms.removeNodes(props.editor, {
        at: props.path,
        match: (child) =>
          Element.isElement(child) && types.includes((child as any).type),
      });
    };

    const ensureChild = (type: string, build: () => Record<string, unknown>) => {
      if (childTypes.has(type)) return;
      let currentNode: unknown;
      try {
        currentNode = Editor.node(props.editor, props.path)?.[0];
      } catch {
        currentNode = undefined;
      }
      if (!currentNode || !Element.isElement(currentNode)) return;
      const currentChildren = Array.isArray(currentNode.children)
        ? currentNode.children
        : [];
      const at = props.path.concat(currentChildren.length);
      Transforms.insertNodes(props.editor, build() as any, { at });
    };

    if (kind === "text") {
      const needsUpdate =
        !hasText || !hasTranslation || hasData || hasMath;
      if (!needsUpdate) return;
      Editor.withoutNormalizing(props.editor, () => {
        if (hasData || hasMath) {
          removeChildTypes(["evidence_block_data", "evidence_block_math"]);
        }
        if (!hasText) {
          ensureChild("evidence_block_text", () => ({
            type: "evidence_block_text",
            children: [{ text: "" }],
          }));
        }
        if (!hasTranslation) {
          ensureChild("evidence_block_translation", () => ({
            type: "evidence_block_translation",
            children: [{ text: "" }],
          }));
        }
      });
      return;
    }

    if (kind === "data") {
      const needsUpdate =
        !hasData || hasText || hasTranslation || hasMath;
      if (!needsUpdate) return;
      Editor.withoutNormalizing(props.editor, () => {
        if (hasText || hasTranslation || hasMath) {
          removeChildTypes([
            "evidence_block_text",
            "evidence_block_translation",
            "evidence_block_math",
          ]);
        }
        if (!hasData) {
          ensureChild("evidence_block_data", () => ({
            type: "evidence_block_data",
            language: "json",
            code: "",
            children: [{ text: "" }],
          }));
        }
      });
      return;
    }

    if (kind === "math") {
      const needsUpdate =
        !hasMath || hasText || hasTranslation || hasData;
      if (!needsUpdate) return;
      Editor.withoutNormalizing(props.editor, () => {
        if (hasText || hasTranslation || hasData) {
          removeChildTypes([
            "evidence_block_text",
            "evidence_block_translation",
            "evidence_block_data",
          ]);
        }
        if (!hasMath) {
          ensureChild("evidence_block_math", () => ({
            type: "evidence_block_math",
            latex: "",
            children: [{ text: "" }],
          }));
        }
      });
    }
  }, [kind, props.editor, props.path]);

  const updateNode = (patch: Partial<EvidenceBlockElement>) => {
    Transforms.setNodes(props.editor, patch, { at: props.path as any });
  };

  const handleRemove = (event?: MouseEvent | KeyboardEvent) => {
    event?.preventDefault();
    event?.stopPropagation();
    Transforms.removeNodes(props.editor, { at: props.path });
    Transforms.insertNodes(
      props.editor,
      { type: "p", ...(id ? { id } : {}), children: [{ text: "" }] } as any,
      { at: props.path },
    );
  };

  const handleLangChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextLang = event.target.value.trim() || "en";
    updateNode({ lang: nextLang });
  };

  const handleOpenAttributionSearch = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!modals) return;
    modals.openAttributionSearch({
      seed: "",
      onSelect: (id) => updateNode({ attribution_ref: id }),
    });
  };

  const handleLocatorKindChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const kind = event.target.value as Locator["kind"];
    updateNode({ locator: { kind, value: locatorValue } });
    requestAnimationFrame(() => {
      locatorKindRef.current?.focus();
    });
  };

  const handleLocatorValueChange = (event: ChangeEvent<HTMLInputElement>) => {
    updateNode({ locator: { kind: locatorKind, value: event.target.value } });
    requestAnimationFrame(() => {
      locatorInputRef.current?.focus();
    });
  };

  const handleMetaMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (selected) {
      // When editing, let all meta controls manage focus without Slate interference.
      event.stopPropagation();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    try {
      const start = Editor.start(props.editor, props.path as any);
      Transforms.select(props.editor, start);
    } catch {
      // ignore
    }
    document
      .querySelector<HTMLElement>("[data-slate-editor=\"true\"]")
      ?.focus();
  };

  return (
    <PlateElement
      as="section"
      {...props}
      aria-label="Evidence block"
      className="group relative my-4 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3"
    >
      <div className="flex justify-end">
        <div
          contentEditable={false}
          onMouseDown={handleMetaMouseDown}
          className="inline-flex flex-wrap items-center gap-2 rounded-md bg-neutral-100 px-2 py-1.5 text-[11px] text-neutral-700"
        >
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {selected ? (
            <>
              <label className="flex items-center gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                  Kind
                </span>
                <select
                  value={kind}
                  onChange={(event) =>
                    updateNode({
                      kind:
                        event.target.value === "data"
                          ? "data"
                          : event.target.value === "math"
                            ? "math"
                            : "text",
                    })
                  }
                  className="h-7 rounded-md border border-neutral-200 bg-white px-2 text-[11px] text-neutral-700"
                >
                  <option value="text">text</option>
                  <option value="data">data</option>
                  <option value="math">math</option>
                </select>
              </label>
              {kind === "text" ? (
                <label className="flex items-center gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                    Lang
                  </span>
                  <input
                    list="evidence-lang-options"
                    value={lang}
                    onChange={handleLangChange}
                    className="h-7 w-[90px] rounded-md border border-neutral-200 bg-white px-2 text-[11px] text-neutral-700"
                  />
                </label>
              ) : null}
              <div
                className={
                  "max-w-[260px] truncate text-[11px] font-medium " +
                  (missingAttribution ? "text-red-700" : "text-neutral-700")
                }
                title={missingAttribution ? "Missing source" : attributionLabel}
              >
                {missingAttribution ? "No source selected" : attributionLabel}
              </div>
              <button
                type="button"
                onMouseDown={handleOpenAttributionSearch}
                disabled={!modals}
                className="h-7 rounded-md border border-neutral-200 bg-white px-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-500 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {missingAttribution ? "Select Source" : "Change Source"}
              </button>
              <select
                ref={locatorKindRef}
                value={locatorKind}
                onChange={handleLocatorKindChange}
                className="h-7 rounded-md border border-neutral-200 bg-white px-2 text-[11px] text-neutral-700"
              >
                {LOCATOR_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </select>
              <input
                ref={locatorInputRef}
                value={locatorValue}
                onChange={handleLocatorValueChange}
                placeholder="locator"
                className="h-7 w-[160px] rounded-md border border-neutral-200 bg-white px-2 text-[11px] text-neutral-700"
              />
            </>
          ) : (
            <>
              {kind === "text" ? (
                <>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                    Lang
                  </span>
                  <span className="text-[11px] font-semibold text-neutral-900">{lang}</span>
                </>
              ) : null}
              <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                Source
              </span>
              <span
                className={
                  "max-w-[220px] truncate text-[11px] font-semibold " +
                  (missingAttribution ? "text-red-700" : "text-neutral-700")
                }
                title={missingAttribution ? "Missing source" : attributionLabel}
              >
                {missingAttribution ? "None" : attributionLabel}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                Locator
              </span>
              <span className="text-[11px] font-semibold text-neutral-900">
                {locatorValue ? `${locatorKind} ${locatorValue}` : "—"}
              </span>
            </>
          )}
        </div>
        </div>
      </div>

      <div className="mt-3 space-y-3">{props.children}</div>

      <datalist id="evidence-lang-options">
        {LANG_SUGGESTIONS.map((suggestion) => (
          <option key={suggestion} value={suggestion} />
        ))}
      </datalist>

      <button
        type="button"
        contentEditable={false}
        onMouseDown={handleRemove}
        onKeyDown={(e) => removeButtonKeyDown(e, handleRemove)}
        aria-label="Remove evidence block"
        className={`${REMOVE_BUTTON_BASE} -right-2 -top-2`}
      >
        x
      </button>
    </PlateElement>
  );
}

function EvidenceBlockTextComponent(props: PlateElementProps) {
  let parent: EvidenceBlockElement | undefined;
  try {
    const parentEntry = Editor.parent(props.editor, props.path);
    parent = parentEntry?.[0] as EvidenceBlockElement | undefined;
  } catch {
    parent = undefined;
  }
  const kind = parent?.kind === "data" || parent?.kind === "math" ? parent.kind : "text";
  if (kind !== "text") return null;

  return (
    <PlateElement
      as="blockquote"
      {...props}
      className="border-l-2 border-neutral-300 pl-3 text-sm text-neutral-800"
    >
      {props.children}
    </PlateElement>
  );
}

function EvidenceBlockTranslationComponent(props: PlateElementProps) {
  let parent: EvidenceBlockElement | undefined;
  try {
    const parentEntry = Editor.parent(props.editor, props.path);
    parent = parentEntry?.[0] as EvidenceBlockElement | undefined;
  } catch {
    parent = undefined;
  }
  const kind =
    parent?.kind === "data" || parent?.kind === "math" ? parent.kind : "text";
  const lang = typeof parent?.lang === "string" ? parent.lang : "en";
  const needsTranslation = kind === "text" && lang.trim() !== "en";
  if (!needsTranslation) return null;

  const text = Editor.string(props.editor, props.path).trim();
  const isEmpty = text.length === 0;

  return (
    <PlateElement
      as="div"
      {...props}
      className={
        "rounded border px-3 py-2 text-sm " +
        (isEmpty ? "border-red-200 bg-red-50/40" : "border-neutral-200 bg-white")
      }
    >
      <div
        contentEditable={false}
        className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500"
      >
        English Translation
      </div>
      <div className="min-h-[1.5rem] text-sm text-neutral-800">
        {props.children}
      </div>
      {isEmpty && (
        <div
          contentEditable={false}
          className="mt-1 text-[10px] font-medium text-red-600"
        >
          Translation required for non-English evidence blocks.
        </div>
      )}
    </PlateElement>
  );
}

function EvidenceBlockDataComponent(props: PlateElementProps) {
  let parent: EvidenceBlockElement | undefined;
  try {
    const parentEntry = Editor.parent(props.editor, props.path);
    parent = parentEntry?.[0] as EvidenceBlockElement | undefined;
  } catch {
    parent = undefined;
  }
  const kind = parent?.kind === "data" ? "data" : "text";
  if (kind !== "data") return null;
  return <DataBlockComponent {...(props as any)} embedded />;
}

function EvidenceBlockMathComponent(props: PlateElementProps) {
  let parent: EvidenceBlockElement | undefined;
  try {
    const parentEntry = Editor.parent(props.editor, props.path);
    parent = parentEntry?.[0] as EvidenceBlockElement | undefined;
  } catch {
    parent = undefined;
  }
  const kind = parent?.kind === "math" ? "math" : "text";
  if (kind !== "math") return null;
  return <MathBlockComponent {...(props as any)} embedded />;
}

function CitationInlineComponent(props: PlateElementProps) {
  const el = props.element as CitationInlineElement;
  const selected = useSelected();
  const { attributions } = useEvidenceRegistry();

  const attributionRef = typeof el.attribution_ref === "string" ? el.attribution_ref : "";
  const locator = el.locator && typeof el.locator === "object" ? el.locator : undefined;
  const locatorKind = locator?.kind ?? "page";
  const locatorValue = locator?.value ?? "";
  const note = typeof el.note === "string" ? el.note : "";
  const attributionLabel = attributionRef
    ? getAttributionLabel(
        attributions.items.find((item) => item.id === attributionRef) ?? {
          id: attributionRef,
        },
      )
    : "";

  const updateNode = (patch: Partial<CitationInlineElement>) => {
    Transforms.setNodes(props.editor, patch, { at: props.path as any });
  };

  const handleSelectSelf = (event?: MouseEvent | KeyboardEvent) => {
    event?.preventDefault();
    event?.stopPropagation();
    try {
      Transforms.select(
        props.editor,
        Editor.range(props.editor as any, props.path as any) as any,
      );
    } catch {
      // ignore
    }
    document.querySelector<HTMLElement>("[data-slate-editor=\"true\"]")?.focus();
  };

  const handleRemove = (event?: MouseEvent | KeyboardEvent) => {
    event?.preventDefault();
    event?.stopPropagation();
    Transforms.removeNodes(props.editor, { at: props.path });
  };

  const citationLabel = attributionRef
    ? `Citation: ${truncateForAria(attributionLabel)}`
    : "Citation: missing source";

  return (
    <PlateElement
      as="span"
      {...props}
      className="group relative inline-flex items-center"
    >
      <span
        role="button"
        tabIndex={0}
        aria-label={citationLabel}
        contentEditable={false}
        onMouseDown={handleSelectSelf}
        onKeyDown={(event) => {
          voidPreviewKeyDown({
            event,
            onSelect: () => handleSelectSelf(event),
            onRemove: () => handleRemove(),
          });
        }}
        className={
          "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 " +
          (attributionRef ? "border-neutral-200 bg-neutral-100 text-neutral-700" : "border-red-200 bg-red-50 text-red-700")
        }
        title={
          attributionRef
            ? getAttributionLabel(
                attributions.items.find((item) => item.id === attributionRef) ??
                  { id: attributionRef },
              )
            : "Missing source"
        }
      >
        [S]
      </span>

      {selected && (
        <span
          contentEditable={false}
          className="absolute left-0 top-full z-10 mt-2 w-[320px] rounded border border-neutral-200 bg-white p-2 text-[11px] text-neutral-600 shadow-md"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
            Citation
          </div>
          <div
            className={
              "mb-2 rounded border px-2 py-1 text-[11px] " +
              (attributionRef ? "border-neutral-200 text-neutral-700" : "border-red-300 text-red-700")
            }
          >
            <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
              Source
            </div>
            {attributionRef ? (
              <div className="mt-0.5 line-clamp-2">{attributionLabel}</div>
            ) : (
              <div className="mt-0.5">Missing source.</div>
            )}
            <div className="mt-1 text-[10px] text-neutral-500">
              Use the Cite toolbar to change.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={locatorKind}
              onChange={(event) =>
                updateNode({
                  locator: {
                    kind: event.target.value as Locator["kind"],
                    value: locatorValue,
                  },
                })
              }
              className="h-6 rounded border border-neutral-200 bg-white px-2 text-[11px] text-neutral-700"
            >
              {LOCATOR_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
            </select>
            <input
              value={locatorValue}
              onChange={(event) =>
                updateNode({
                  locator: { kind: locatorKind, value: event.target.value },
                })
              }
              placeholder="locator"
              className="h-6 flex-1 rounded border border-neutral-200 bg-white px-2 text-[11px] text-neutral-700"
            />
          </div>
          <input
            value={note}
            onChange={(event) => updateNode({ note: event.target.value })}
            placeholder="optional note"
            className="mt-2 h-6 w-full rounded border border-neutral-200 bg-white px-2 text-[11px] text-neutral-700"
          />
          <button
            type="button"
            onMouseDown={handleRemove}
            onKeyDown={(e) => removeButtonKeyDown(e, handleRemove)}
            aria-label="Remove citation"
            className="mt-2 text-[11px] font-medium text-neutral-500 hover:text-neutral-800"
          >
            Remove citation
          </button>
        </span>
      )}

      <span className="absolute inset-0 opacity-0 pointer-events-none" aria-hidden>
        {props.children}
      </span>
    </PlateElement>
  );
}

function TermInlineComponent(props: PlateElementProps) {
  const el = props.element as TermInlineElement;
  const selected = useSelected();
  const { terms } = useEvidenceRegistry();

  const termRef = typeof el.term_ref === "string" ? el.term_ref : "";
  const term = termRef
    ? terms.items.find((item) => item.id === termRef)
    : undefined;
  const termLabel = term ? getTermLabel(term) : "";

  return (
    <PlateElement
      as="span"
      {...props}
      className="relative inline-flex items-baseline"
      title={
        termRef
          ? getTermLabel(
              terms.items.find((item) => item.id === termRef) ?? { id: termRef },
            )
          : "Missing term"
      }
    >
      <span
        className={
          "rounded px-1 py-0.5 text-[0.95em] underline decoration-dotted " +
          (termRef ? "decoration-neutral-400" : "decoration-red-500 text-red-700")
        }
      >
        {props.children}
      </span>

      {selected && (
        <span
          contentEditable={false}
          className="absolute left-0 top-full z-10 mt-2 w-[280px] rounded border border-neutral-200 bg-white p-2 text-[11px] text-neutral-600 shadow-md"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
            Term
          </div>
          {termRef ? (
            <div className="text-[12px] font-medium text-neutral-800">
              {termLabel}
            </div>
          ) : (
            <div className="text-[12px] font-medium text-red-700">
              Missing term reference.
            </div>
          )}
          {term ? (
            <div className="mt-2 space-y-2 text-[11px] text-neutral-700">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                  Definition
                </div>
                <div className="mt-0.5">
                  {term.definition_en || "No definition yet."}
                </div>
              </div>
              {term.aliases?.length ? (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                    Aliases
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {term.aliases.map((alias, idx) => (
                      <span
                        key={`${alias.lang}-${alias.text}-${idx}`}
                        className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[10px] text-neutral-700"
                      >
                        {alias.text}
                        {alias.lang ? ` (${alias.lang})` : ""}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {term.notes ? (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                    Notes
                  </div>
                  <div className="mt-0.5">{term.notes}</div>
                </div>
              ) : null}
              <div className="text-[10px] text-neutral-500">
                Use the Term toolbar to change.
              </div>
            </div>
          ) : null}
        </span>
      )}
    </PlateElement>
  );
}

export const EvidenceBlockPlugin = createSlatePlugin({
  key: "evidenceBlock",
  node: {
    type: "evidence_block",
    isElement: true,
    component: EvidenceBlockComponent as any,
  },
});

export const EvidenceBlockTextPlugin = createSlatePlugin({
  key: "evidenceBlockText",
  node: {
    type: "evidence_block_text",
    isElement: true,
    component: EvidenceBlockTextComponent as any,
  },
});

export const EvidenceBlockTranslationPlugin = createSlatePlugin({
  key: "evidenceBlockTranslation",
  node: {
    type: "evidence_block_translation",
    isElement: true,
    component: EvidenceBlockTranslationComponent as any,
  },
});

export const EvidenceBlockDataPlugin = createSlatePlugin({
  key: "evidenceBlockData",
  node: {
    type: "evidence_block_data",
    isElement: true,
    isVoid: true,
    component: EvidenceBlockDataComponent as any,
  },
});

export const EvidenceBlockMathPlugin = createSlatePlugin({
  key: "evidenceBlockMath",
  node: {
    type: "evidence_block_math",
    isElement: true,
    isVoid: true,
    component: EvidenceBlockMathComponent as any,
  },
});

export const CitationInlinePlugin = createSlatePlugin({
  key: "citationInline",
  node: {
    type: "citation_inline",
    isElement: true,
    isInline: true,
    isVoid: true,
    component: CitationInlineComponent as any,
  },
});

export const TermInlinePlugin = createSlatePlugin({
  key: "termInline",
  node: {
    type: "term_inline",
    isElement: true,
    isInline: true,
    component: TermInlineComponent as any,
  },
});
