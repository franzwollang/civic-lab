import type { PlateElementProps } from "platejs/react";
import { PlateElement, useSelected } from "platejs/react";
import { createSlatePlugin } from "platejs";
import { Editor, Transforms } from "slate";
import type { ChangeEvent, KeyboardEvent, MouseEvent } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { useCollapseContext } from "@/editor/collapse";
import { applyTabToText, TAB_SPACES } from "@/editor/tabSpaces";
import { usePrismHighlight } from "@/editor/usePrism";
import { renderMermaidToSvgHtml, validateMermaidDiagram } from "@/editor/mermaid";
import { useMermaidTick } from "@/editor/useMermaidTick";
import {
  REMOVE_BUTTON_CLASS,
  VoidPreviewRegion,
  removeButtonKeyDown,
} from "@/editor/voidA11y";
import {
  consumeVoidEntryIntent,
  getVoidEntrySelection,
  handleVoidBlockEdgeArrowExit,
  handleVoidBlockTextareaArrowExit,
} from "@/editor/voidNavigation";
import { resolveImageSrc } from "@/lib/imageSrc";
import { uploadImage } from "@/api/client";

type MermaidBlockElement = {
  type: "mermaid_block";
  id?: string;
  code?: string;
  children: Array<{ text: string }>;
};

type ProcedureBlockElement = {
  type: "procedure_block";
  id?: string;
  code?: string;
  dialect?: string;
  children: Array<{ text: string }>;
};

type DataBlockElement = {
  type: "data_block";
  id?: string;
  code?: string;
  language?: string;
  caption?: string;
  children: Array<{ text: string }>;
};

type ImageBlockElement = {
  type: "image_block";
  id?: string;
  src?: string;
  alt?: string;
  caption?: string;
  children: Array<{ text: string }>;
};

function RemoveButton({
  onMouseDown,
  className,
  label,
}: {
  onMouseDown: (e: MouseEvent | KeyboardEvent) => void;
  className?: string;
  label: string;
}) {
  return (
    <button
      type="button"
      contentEditable={false}
      onMouseDown={onMouseDown}
      onKeyDown={(e) => removeButtonKeyDown(e, onMouseDown)}
      aria-label={label}
      className={className ?? REMOVE_BUTTON_CLASS}
    >
      x
    </button>
  );
}

function useSelectSelf(props: PlateElementProps) {
  return (event?: MouseEvent | KeyboardEvent) => {
    event?.preventDefault();
    event?.stopPropagation();
    try {
      Transforms.select(props.editor, Editor.range(props.editor as any, props.path as any) as any);
    } catch {
      // ignore
    }
    document.querySelector<HTMLElement>("[data-slate-editor=\"true\"]")?.focus();
  };
}

function useRemoveSelf(
  props: PlateElementProps,
  opts?: { replaceWithParagraph?: boolean; id?: string },
) {
  return (event?: MouseEvent | KeyboardEvent) => {
    event?.preventDefault();
    event?.stopPropagation();
    Transforms.removeNodes(props.editor, { at: props.path });
    if (opts?.replaceWithParagraph) {
      Transforms.insertNodes(
        props.editor,
        {
          type: "p",
          ...(opts.id ? { id: opts.id } : {}),
          children: [{ text: "" }],
        } as any,
        { at: props.path },
      );
    }
  };
}


function MermaidBlockComponent(props: PlateElementProps) {
  const el = props.element as unknown as MermaidBlockElement;
  const id = typeof el.id === "string" ? el.id : undefined;
  const collapse = useCollapseContext();
  const hidden = id ? collapse?.isHidden(id) : false;

  const selected = useSelected();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const highlightRef = useRef<HTMLPreElement | null>(null);
  const pendingSelection = useRef<{ start: number; end: number } | null>(null);
  const code = typeof el.code === "string" ? el.code : "";
  const [draftCode, setDraftCode] = useState(code);
  const selectSelf = useSelectSelf(props);
  const handleRemove = useRemoveSelf(props, {
    replaceWithParagraph: true,
    id,
  });
  const displayCode = selected ? draftCode : code;
  const highlighted = usePrismHighlight({ language: "mermaid", code: displayCode });
  useMermaidTick();
  const isHiddenNode = (node: unknown) => {
    const id = (node as any)?.id as string | undefined;
    return id ? collapse?.isHidden(id) : false;
  };

  const validation = displayCode.trim()
    ? validateMermaidDiagram(displayCode)
    : ({ ok: false as const, message: "Mermaid diagram is empty." } as const);
  const svgHtml =
    !selected && validation.ok ? renderMermaidToSvgHtml(displayCode) : null;

  const syncHighlightScroll = (el: HTMLTextAreaElement) => {
    if (!highlightRef.current) return;
    highlightRef.current.style.transform = `translate(${-el.scrollLeft}px, ${-el.scrollTop}px)`;
  };

  useEffect(() => {
    if (!selected) return;
    textareaRef.current?.focus();
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    const intent = consumeVoidEntryIntent(el, props.path);
    if (!intent) return;
    const next = getVoidEntrySelection(displayCode, intent);
    pendingSelection.current = next;
    requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      try {
        textareaRef.current.selectionStart = next.start;
        textareaRef.current.selectionEnd = next.end;
      } catch {
        // ignore
      }
    });
  }, [displayCode, el, props.path, selected]);

  useEffect(() => {
    if (selected) return;
    setDraftCode(code);
  }, [code, selected]);

  useLayoutEffect(() => {
    if (!selected) return;
    const next = pendingSelection.current;
    if (!next || !textareaRef.current) return;
    pendingSelection.current = null;
    try {
      textareaRef.current.selectionStart = next.start;
      textareaRef.current.selectionEnd = next.end;
    } catch {
      // ignore
    }
  }, [displayCode, selected]);

  if (hidden) return null;

  return (
    <PlateElement
      as="div"
      {...props}
      className="group relative my-3 rounded border border-neutral-200 bg-neutral-50 px-3 py-2"
    >
      <div
        contentEditable={false}
        className="flex items-center justify-between pr-7 text-xs text-neutral-600"
        onMouseDown={selectSelf}
      >
        {selected ? (
          <span contentEditable={false}>
            <select
              value="mermaid"
              onChange={() => {}}
              onMouseDown={(e) => e.stopPropagation()}
              onKeyDownCapture={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              className="h-6 rounded border border-neutral-200 bg-white px-1 text-[11px] text-neutral-700"
            >
              <option value="mermaid">mermaid</option>
            </select>
          </span>
        ) : (
          <span />
        )}
        <span className="inline-flex items-center gap-1 rounded bg-neutral-100 px-2 py-0.5">
          <span className="text-[11px] font-semibold text-neutral-700">Diagram</span>
          <span className="text-[10px] font-medium text-neutral-500">Mermaid</span>
        </span>
      </div>

      {selected ? (
        <div contentEditable={false}>
          <div className="relative mt-2 rounded border border-neutral-200 bg-white">
            <pre
              ref={highlightRef}
              aria-hidden
              className="code-prism pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words px-2 py-1 font-mono text-[11px] leading-5 text-neutral-800"
              style={{ transform: "translate(0px, 0px)" }}
            >
              <code
                className="language-mermaid"
                dangerouslySetInnerHTML={{ __html: highlighted.html }}
              />
            </pre>
            <textarea
              ref={textareaRef}
              value={displayCode}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
                const nextValue = e.target.value;
                pendingSelection.current = {
                  start: e.currentTarget.selectionStart ?? 0,
                  end: e.currentTarget.selectionEnd ?? 0,
                };
                setDraftCode(nextValue);
                Transforms.setNodes(
                  props.editor,
                  { code: nextValue },
                  { at: props.path as any },
                );
              }}
              onBeforeInput={(e) => e.stopPropagation()}
              onCopy={(e) => e.stopPropagation()}
              onCut={(e) => e.stopPropagation()}
              onPaste={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
              if (handleVoidBlockTextareaArrowExit(
                props.editor,
                props.path,
                displayCode,
                e,
                isHiddenNode,
              )) {
                return;
              }
                if (e.key !== "Tab") return;
                e.preventDefault();
                const el = e.currentTarget;
                const next = applyTabToText({
                  value: displayCode,
                  selectionStart: el.selectionStart ?? 0,
                  selectionEnd: el.selectionEnd ?? 0,
                  tab: TAB_SPACES,
                  outdent: e.shiftKey,
                });
                setDraftCode(next.value);
                Transforms.setNodes(
                  props.editor,
                  { code: next.value },
                  { at: props.path as any },
                );
                requestAnimationFrame(() => {
                  try {
                    el.selectionStart = next.selectionStart;
                    el.selectionEnd = next.selectionEnd;
                    syncHighlightScroll(el);
                  } catch {
                    // ignore
                  }
                });
              }}
              onScroll={(e) => syncHighlightScroll(e.currentTarget)}
              onMouseDown={(e) => e.stopPropagation()}
              rows={Math.min(14, Math.max(4, code.split("\n").length + 1))}
              className="relative z-10 w-full resize-y bg-transparent px-2 py-1 font-mono text-[11px] leading-5 text-transparent caret-neutral-800 outline-none placeholder:text-neutral-400"
              style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
              placeholder={"flowchart TD\n  A-->B\n  B-->C"}
              spellCheck={false}
            />
          </div>
        </div>
      ) : (
        <VoidPreviewRegion
          label="Mermaid diagram"
          description={
            !validation.ok
              ? validation.message
              : displayCode.trim() || "Empty diagram"
          }
          onSelect={selectSelf}
          onRemove={() => handleRemove()}
          className="mt-2 rounded border border-neutral-200 bg-white p-2 text-[11px] text-neutral-600 outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
        >
          {svgHtml ? (
            <div style={{ pointerEvents: "none" }} dangerouslySetInnerHTML={{ __html: svgHtml }} />
          ) : (
            <div
              className={
                !validation.ok
                  ? validation.message === "Validating diagram..."
                    ? "rounded bg-neutral-100 px-2 py-1 text-xs text-neutral-500"
                    : "rounded bg-red-50 px-2 py-1 text-xs text-red-700"
                  : "rounded bg-neutral-100 px-2 py-1 text-xs text-neutral-600"
              }
            >
              {displayCode.trim().length === 0
                ? "Mermaid diagram is empty."
                : "Diagram preview"}
            </div>
          )}
          {!svgHtml ? (
            <pre className="code-prism mt-2 whitespace-pre-wrap break-words font-mono text-[11px] text-neutral-700">
              <code
                className="language-mermaid"
                dangerouslySetInnerHTML={{ __html: highlighted.html }}
              />
            </pre>
          ) : null}
        </VoidPreviewRegion>
      )}

      <span className="absolute inset-0 opacity-0 pointer-events-none" aria-hidden>
        {props.children}
      </span>

      <RemoveButton onMouseDown={handleRemove} label="Remove mermaid block" />
    </PlateElement>
  );
}

function ProcedureBlockComponent(props: PlateElementProps) {
  const el = props.element as unknown as ProcedureBlockElement;
  const id = typeof el.id === "string" ? el.id : undefined;
  const collapse = useCollapseContext();
  const hidden = id ? collapse?.isHidden(id) : false;

  const selected = useSelected();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const highlightRef = useRef<HTMLPreElement | null>(null);
  const code = typeof el.code === "string" ? el.code : "";
  const [draftCode, setDraftCode] = useState(code);
  const pendingSelection = useRef<{ start: number; end: number } | null>(null);
  const dialect = typeof el.dialect === "string" ? el.dialect : "pseudocode.js";
  const selectSelf = useSelectSelf(props);
  const displayCode = selected ? draftCode : code;
  const highlightLanguage = dialect === "pseudocode.js" ? "pseudocode" : "pseudocode";
  const highlighted = usePrismHighlight({ language: highlightLanguage, code: displayCode });
  const isHiddenNode = (node: unknown) => {
    const id = (node as any)?.id as string | undefined;
    return id ? collapse?.isHidden(id) : false;
  };
  const hasCode = displayCode.trim().length > 0;
  const firstContentLine = useMemo(() => {
    return displayCode
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0 && !line.startsWith("#") && !line.startsWith("//"));
  }, [displayCode]);
  const hasHeader = firstContentLine ? /^(procedure|function)\b/i.test(firstContentLine) : false;
  const headerIssue = hasCode && !hasHeader;

  const syncHighlightScroll = (el: HTMLTextAreaElement) => {
    if (!highlightRef.current) return;
    highlightRef.current.style.transform = `translate(${-el.scrollLeft}px, ${-el.scrollTop}px)`;
  };

  const setDialect = (next: string) => {
    Transforms.setNodes(
      props.editor,
      { dialect: next },
      { at: props.path as any },
    );
  };

  useEffect(() => {
    if (!selected) return;
    textareaRef.current?.focus();
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    const intent = consumeVoidEntryIntent(el, props.path);
    if (!intent) return;
    const next = getVoidEntrySelection(displayCode, intent);
    pendingSelection.current = next;
    requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      try {
        textareaRef.current.selectionStart = next.start;
        textareaRef.current.selectionEnd = next.end;
      } catch {
        // ignore
      }
    });
  }, [displayCode, el, props.path, selected]);

  useEffect(() => {
    if (selected) return;
    setDraftCode(code);
  }, [code, selected]);

  useLayoutEffect(() => {
    if (!selected) return;
    const next = pendingSelection.current;
    if (!next || !textareaRef.current) return;
    pendingSelection.current = null;
    try {
      textareaRef.current.selectionStart = next.start;
      textareaRef.current.selectionEnd = next.end;
    } catch {
      // ignore
    }
  }, [displayCode, selected]);

  const handleRemove = useRemoveSelf(props, {
    replaceWithParagraph: true,
    id,
  });

  if (hidden) return null;

  return (
    <PlateElement
      as="div"
      {...props}
      className="group relative my-3 rounded border border-neutral-200 bg-neutral-50 px-3 py-2"
    >
      <div
        contentEditable={false}
        className="flex items-center justify-between pr-7 text-xs text-neutral-600"
        onMouseDown={selectSelf}
      >
        {selected ? (
          <span contentEditable={false}>
            <select
              value={dialect}
              onChange={(e) => setDialect(e.target.value)}
              onMouseDown={(e) => e.stopPropagation()}
              onKeyDownCapture={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              className="h-6 rounded border border-neutral-200 bg-white px-1 text-[11px] text-neutral-700"
            >
              <option value="pseudocode.js">pseudocode.js</option>
            </select>
          </span>
        ) : (
          <span />
        )}
        <span className="inline-flex items-center gap-1 rounded bg-neutral-100 px-2 py-0.5">
          <span className="text-[11px] font-semibold text-neutral-700">Procedure</span>
          <span className="text-[10px] font-medium text-neutral-500">{dialect}</span>
        </span>
      </div>

      {selected ? (
        <div contentEditable={false}>
          <div className="relative mt-2 rounded border border-neutral-200 bg-white">
            <pre
              ref={highlightRef}
              aria-hidden
              className="code-prism pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words px-2 py-1 font-mono text-[11px] leading-5 text-neutral-800"
              style={{ transform: "translate(0px, 0px)" }}
            >
              <code
                className={`language-${highlightLanguage}`}
                dangerouslySetInnerHTML={{ __html: highlighted.html }}
              />
            </pre>
            <textarea
              ref={textareaRef}
              value={displayCode}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
                const nextValue = e.target.value;
                pendingSelection.current = {
                  start: e.currentTarget.selectionStart ?? 0,
                  end: e.currentTarget.selectionEnd ?? 0,
                };
                setDraftCode(nextValue);
                Transforms.setNodes(
                  props.editor,
                  { code: nextValue, dialect: "pseudocode.js" },
                  { at: props.path as any },
                );
              }}
              onBeforeInput={(e) => e.stopPropagation()}
              onCopy={(e) => e.stopPropagation()}
              onCut={(e) => e.stopPropagation()}
              onPaste={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (handleVoidBlockTextareaArrowExit(
                  props.editor,
                  props.path,
                  displayCode,
                  e,
                  isHiddenNode,
                )) {
                  return;
                }
                if (e.key !== "Tab") return;
                e.preventDefault();
                const el = e.currentTarget;
                const next = applyTabToText({
                  value: displayCode,
                  selectionStart: el.selectionStart ?? 0,
                  selectionEnd: el.selectionEnd ?? 0,
                  tab: TAB_SPACES,
                  outdent: e.shiftKey,
                });
                setDraftCode(next.value);
                Transforms.setNodes(
                  props.editor,
                  { code: next.value, dialect: "pseudocode.js" },
                  { at: props.path as any },
                );
                requestAnimationFrame(() => {
                  try {
                    el.selectionStart = next.selectionStart;
                    el.selectionEnd = next.selectionEnd;
                    syncHighlightScroll(el);
                  } catch {
                    // ignore
                  }
                });
              }}
              onScroll={(e) => syncHighlightScroll(e.currentTarget)}
              onMouseDown={(e) => e.stopPropagation()}
              rows={Math.min(14, Math.max(4, code.split("\n").length + 1))}
              className="relative z-10 w-full resize-y bg-transparent px-2 py-1 font-mono text-[11px] leading-5 text-transparent caret-neutral-800 outline-none placeholder:text-neutral-400"
              style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
              placeholder={
                "procedure Example(x)\n  if x < 0\n    return 0\n  return x"
              }
              spellCheck={false}
            />
          </div>
          {!hasHeader ? (
            <div className="mt-2 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
              Start with <span className="font-semibold">procedure</span> or{" "}
              <span className="font-semibold">function</span>.
            </div>
          ) : null}
        </div>
      ) : (
        <VoidPreviewRegion
          label="Procedure block (pseudocode)"
          description={
            headerIssue
              ? "Missing procedure or function header"
              : firstContentLine || displayCode.trim() || "Empty procedure"
          }
          onSelect={selectSelf}
          onRemove={() => handleRemove()}
          className="mt-2 rounded border border-neutral-200 bg-white p-2 outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
        >
          {!hasHeader ? (
            <div className="rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
              Start with <span className="font-semibold">procedure</span> or{" "}
              <span className="font-semibold">function</span>.
            </div>
          ) : (
            <pre className={`code-prism language-${highlightLanguage} whitespace-pre-wrap break-words font-mono text-[11px] text-neutral-800`}>
              <code
                className={`language-${highlightLanguage}`}
                dangerouslySetInnerHTML={{ __html: highlighted.html }}
              />
            </pre>
          )}
        </VoidPreviewRegion>
      )}

      <span className="absolute inset-0 opacity-0 pointer-events-none" aria-hidden>
        {props.children}
      </span>

      <RemoveButton onMouseDown={handleRemove} label="Remove procedure block" />
    </PlateElement>
  );
}

export function DataBlockComponent(
  props: PlateElementProps & { embedded?: boolean },
) {
  const embedded = (props as { embedded?: boolean }).embedded === true;
  const el = props.element as unknown as DataBlockElement;
  const id = typeof el.id === "string" ? el.id : undefined;
  const collapse = useCollapseContext();
  const hidden = id ? collapse?.isHidden(id) : false;

  const selected = useSelected();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const highlightRef = useRef<HTMLPreElement | null>(null);
  const pendingSelection = useRef<{ start: number; end: number } | null>(null);
  const code = typeof el.code === "string" ? el.code : "";
  const [draftCode, setDraftCode] = useState(code);
  const language = typeof el.language === "string" ? el.language : "json";
  const selectSelf = useSelectSelf(props);
  const displayCode = selected ? draftCode : code;
  const highlighted = usePrismHighlight({ language, code: displayCode });
  const isHiddenNode = (node: unknown) => {
    const id = (node as any)?.id as string | undefined;
    return id ? collapse?.isHidden(id) : false;
  };

  useEffect(() => {
    if (!selected) return;
    textareaRef.current?.focus();
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    const intent = consumeVoidEntryIntent(el, props.path);
    if (!intent) return;
    const next = getVoidEntrySelection(displayCode, intent);
    pendingSelection.current = next;
    requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      try {
        textareaRef.current.selectionStart = next.start;
        textareaRef.current.selectionEnd = next.end;
      } catch {
        // ignore
      }
    });
  }, [displayCode, el, props.path, selected]);

  useEffect(() => {
    if (selected) return;
    setDraftCode(code);
  }, [code, selected]);

  useLayoutEffect(() => {
    if (!selected) return;
    const next = pendingSelection.current;
    if (!next || !textareaRef.current) return;
    pendingSelection.current = null;
    try {
      textareaRef.current.selectionStart = next.start;
      textareaRef.current.selectionEnd = next.end;
    } catch {
      // ignore
    }
  }, [draftCode, selected]);

  const handleRemove = useRemoveSelf(props, {
    replaceWithParagraph: true,
    id,
  });

  const setLanguage = (next: string) => {
    Transforms.setNodes(
      props.editor,
      { language: next },
      { at: props.path as any },
    );
  };

  const langLabel = useMemo(() => language.toUpperCase(), [language]);
  const syncHighlightScroll = (el: HTMLTextAreaElement) => {
    if (!highlightRef.current) return;
    highlightRef.current.style.transform = `translate(${-el.scrollLeft}px, ${-el.scrollTop}px)`;
  };

  if (hidden) return null;

  return (
    <PlateElement
      as="div"
      {...props}
      className={
        embedded
          ? "group relative rounded border border-neutral-200 bg-neutral-50 px-3 py-2"
          : "group relative my-3 rounded border border-neutral-200 bg-neutral-50 px-3 py-2"
      }
    >
      <div
        contentEditable={false}
        className="flex items-center justify-between pr-7 text-xs text-neutral-600"
        onMouseDown={selectSelf}
      >
        {selected ? (
          <span contentEditable={false}>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              onMouseDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              className="h-6 rounded border border-neutral-200 bg-white px-1 text-[11px] text-neutral-700"
            >
              <option value="json">json</option>
              <option value="yaml">yaml</option>
              <option value="toml">toml</option>
              <option value="csv">csv</option>
            </select>
          </span>
        ) : (
          <span />
        )}
        <span className="inline-flex items-center gap-1 rounded bg-neutral-100 px-2 py-0.5">
          <span className="text-[11px] font-semibold text-neutral-700">Data</span>
          <span className="text-[10px] font-medium text-neutral-500">{langLabel}</span>
        </span>
      </div>

      {selected ? (
        <div contentEditable={false}>
          <div className="relative mt-2 rounded border border-neutral-200 bg-white">
            <pre
              ref={highlightRef}
              aria-hidden
              className={`code-prism pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words px-2 py-1 font-mono text-[11px] leading-5 text-neutral-800`}
              style={{ transform: "translate(0px, 0px)" }}
            >
              <code
                className={`language-${language}`}
                dangerouslySetInnerHTML={{ __html: highlighted.html }}
              />
            </pre>
            <textarea
              ref={textareaRef}
              value={draftCode}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
                const nextValue = e.target.value;
                pendingSelection.current = {
                  start: e.currentTarget.selectionStart ?? 0,
                  end: e.currentTarget.selectionEnd ?? 0,
                };
                setDraftCode(nextValue);
                Transforms.setNodes(
                  props.editor,
                  { code: nextValue },
                  { at: props.path as any },
                );
              }}
              onBeforeInput={(e) => e.stopPropagation()}
              onCopy={(e) => e.stopPropagation()}
              onCut={(e) => e.stopPropagation()}
              onPaste={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (handleVoidBlockTextareaArrowExit(
                  props.editor,
                  props.path,
                  draftCode,
                  e,
                  isHiddenNode,
                )) {
                  return;
                }
                if (e.key !== "Tab") return;
                e.preventDefault();
                const el = e.currentTarget;
                const next = applyTabToText({
                  value: draftCode,
                  selectionStart: el.selectionStart ?? 0,
                  selectionEnd: el.selectionEnd ?? 0,
                  tab: TAB_SPACES,
                  outdent: e.shiftKey,
                });
                setDraftCode(next.value);
                Transforms.setNodes(
                  props.editor,
                  { code: next.value },
                  { at: props.path as any },
                );
                requestAnimationFrame(() => {
                  try {
                    el.selectionStart = next.selectionStart;
                    el.selectionEnd = next.selectionEnd;
                    syncHighlightScroll(el);
                  } catch {
                    // ignore
                  }
                });
              }}
              onScroll={(e) => syncHighlightScroll(e.currentTarget)}
              onMouseDown={(e) => e.stopPropagation()}
              rows={Math.min(18, Math.max(4, code.split("\n").length + 1))}
              className="relative z-10 w-full resize-y bg-transparent px-2 py-1 font-mono text-[11px] leading-5 text-transparent caret-neutral-800 outline-none placeholder:text-neutral-400"
              style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
              placeholder={
                language === "csv" ? "a,b,c\n1,2,3" : "{\n  \"hello\": \"world\"\n}"
              }
              spellCheck={false}
            />
          </div>
        </div>
      ) : (
        <VoidPreviewRegion
          label={`Data block (${language})`}
          description={displayCode.trim() || "Empty data block"}
          onSelect={selectSelf}
          onRemove={embedded ? undefined : () => handleRemove()}
          className="mt-2 rounded border border-neutral-200 bg-white p-2 outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
        >
          <pre className={`code-prism language-${language} whitespace-pre-wrap break-words font-mono text-[11px] text-neutral-800`}>
            <code
              className={`language-${language}`}
              dangerouslySetInnerHTML={{ __html: highlighted.html }}
            />
          </pre>
        </VoidPreviewRegion>
      )}

      <span className="absolute inset-0 opacity-0 pointer-events-none" aria-hidden>
        {props.children}
      </span>

      {!embedded ? (
        <RemoveButton onMouseDown={handleRemove} label="Remove data block" />
      ) : null}
    </PlateElement>
  );
}

function ImageBlockComponent(props: PlateElementProps) {
  const el = props.element as unknown as ImageBlockElement;
  const id = typeof el.id === "string" ? el.id : undefined;
  const collapse = useCollapseContext();
  const hidden = id ? collapse?.isHidden(id) : false;

  const selected = useSelected();
  const selectSelf = useSelectSelf(props);
  const src = typeof el.src === "string" ? el.src : "";
  const alt = typeof el.alt === "string" ? el.alt : "";
  const caption = typeof el.caption === "string" ? el.caption : "";
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const resolvedSrc = resolveImageSrc(src);

  const isHiddenNode = (node: unknown) => {
    const nodeId =
      node &&
      typeof node === "object" &&
      "id" in node &&
      typeof (node as { id?: unknown }).id === "string"
        ? (node as { id: string }).id
        : undefined;
    return nodeId ? Boolean(collapse?.isHidden(nodeId)) : false;
  };

  const handleRemove = useRemoveSelf(props, {
    replaceWithParagraph: true,
    id,
  });

  const updateNode = (patch: Partial<ImageBlockElement>) => {
    Transforms.setNodes(props.editor, patch, { at: props.path as any });
  };

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const result = await uploadImage(file);
      if (!alt.trim() && file.name) {
        const stem = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
        updateNode(stem ? { src: result.url, alt: stem } : { src: result.url });
      } else {
        updateNode({ src: result.url });
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  };

  if (hidden) return null;

  return (
    <PlateElement
      as="div"
      {...props}
      className="group relative my-3 rounded border border-neutral-200 bg-neutral-50 px-3 py-2"
    >
      <div
        contentEditable={false}
        className="flex items-center justify-between pr-7 text-xs text-neutral-600"
        onMouseDown={selectSelf}
      >
        <span />
        <span className="inline-flex items-center gap-1 rounded bg-neutral-100 px-2 py-0.5">
          <span className="text-[11px] font-semibold text-neutral-700">Image</span>
        </span>
      </div>

      {selected ? (
        <div contentEditable={false} className="mt-2 space-y-2">
          <div className="space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
              Upload
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/webp,image/png,image/jpeg,image/gif,.webp,.png,.jpg,.jpeg,.gif"
                className="hidden"
                onChange={handleUpload}
              />
              <button
                type="button"
                disabled={uploading}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => fileInputRef.current?.click()}
                className="h-7 rounded border border-neutral-300 bg-white px-2 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
              >
                {uploading ? "Uploading…" : "Choose image…"}
              </button>
              <span className="text-[10px] text-neutral-500">
                webp / png / jpeg / gif · max 2MB
              </span>
            </div>
            {uploadError ? (
              <div className="text-[11px] text-red-600">{uploadError}</div>
            ) : null}
          </div>
          <div className="space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
              Source URL
            </div>
            <input
              value={src}
              onChange={(e) => updateNode({ src: e.target.value })}
              onMouseDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                handleVoidBlockEdgeArrowExit(
                  props.editor as any,
                  props.path as any,
                  e,
                  { edge: "start", isHidden: isHiddenNode },
                );
              }}
              className="h-7 w-full rounded border border-neutral-200 bg-white px-2 text-[11px] text-neutral-700"
              placeholder="https://… or /uploads/images/…"
            />
            <div className="text-[10px] text-neutral-500">
              Upload above, or paste a .webp / .png / .jpg / .gif URL.
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
              Alt text
            </div>
            <input
              value={alt}
              onChange={(e) => updateNode({ alt: e.target.value })}
              onMouseDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                // Keep Slate from acting on the selected void while editing fields.
                e.stopPropagation();
              }}
              className="h-7 w-full rounded border border-neutral-200 bg-white px-2 text-[11px] text-neutral-700"
              placeholder="Short description"
            />
          </div>
          <div className="space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
              Caption
            </div>
            <input
              value={caption}
              onChange={(e) => updateNode({ caption: e.target.value })}
              onMouseDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                handleVoidBlockEdgeArrowExit(
                  props.editor as any,
                  props.path as any,
                  e,
                  { edge: "end", isHidden: isHiddenNode },
                );
              }}
              className="h-7 w-full rounded border border-neutral-200 bg-white px-2 text-[11px] text-neutral-700"
              placeholder="Optional caption"
            />
          </div>
          <div className="mt-2 rounded border border-neutral-200 bg-white p-2">
            {src ? (
              <img
                src={resolvedSrc}
                alt={alt}
                className="max-h-[320px] w-auto max-w-full rounded"
              />
            ) : (
              <div className="text-[11px] text-neutral-500">
                Upload or add an image URL to preview.
              </div>
            )}
            {caption ? (
              <div className="mt-2 text-[11px] text-neutral-600">{caption}</div>
            ) : null}
          </div>
        </div>
      ) : (
        <VoidPreviewRegion
          label={alt ? `Image: ${alt}` : "Image block"}
          description={caption || alt || src || "Missing image source"}
          onSelect={selectSelf}
          onRemove={() => handleRemove()}
          className="mt-2 rounded border border-neutral-200 bg-white p-2 outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
        >
          {src ? (
            <img
              src={resolvedSrc}
              alt={alt}
              className="max-h-[320px] w-auto max-w-full rounded"
            />
          ) : (
            <div className="text-[11px] text-neutral-500">Image URL missing.</div>
          )}
          {caption ? (
            <div className="mt-2 text-[11px] text-neutral-600">{caption}</div>
          ) : null}
        </VoidPreviewRegion>
      )}

      <span className="absolute inset-0 opacity-0 pointer-events-none" aria-hidden>
        {props.children}
      </span>

      <RemoveButton onMouseDown={handleRemove} label="Remove image block" />
    </PlateElement>
  );
}

export const MermaidBlockPlugin = createSlatePlugin({
  key: "mermaidBlock",
  node: {
    type: "mermaid_block",
    isElement: true,
    isVoid: true,
    component: MermaidBlockComponent as any,
  },
});

export const ProcedureBlockPlugin = createSlatePlugin({
  key: "procedureBlock",
  node: {
    type: "procedure_block",
    isElement: true,
    isVoid: true,
    component: ProcedureBlockComponent as any,
  },
});

export const DataBlockPlugin = createSlatePlugin({
  key: "dataBlock",
  node: {
    type: "data_block",
    isElement: true,
    isVoid: true,
    component: DataBlockComponent as any,
  },
});

export const ImageBlockPlugin = createSlatePlugin({
  key: "imageBlock",
  node: {
    type: "image_block",
    isElement: true,
    isVoid: true,
    component: ImageBlockComponent as any,
  },
});
