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

type CodeBlockElement = {
  type: "code_block";
  id?: string;
  code?: string;
  language?: string;
  caption?: string;
  children: Array<{ text: string }>;
};

function RemoveButton({
  onMouseDown,
  className,
  label,
}: {
  onMouseDown: (e: MouseEvent) => void;
  className?: string;
  label: string;
}) {
  return (
    <button
      type="button"
      contentEditable={false}
      onMouseDown={onMouseDown}
      aria-label={label}
      className={
        className ??
        "absolute right-2 top-2 hidden h-6 w-6 items-center justify-center rounded border border-neutral-200 bg-white text-xs text-neutral-600 shadow-sm hover:bg-neutral-100 group-hover:flex"
      }
    >
      x
    </button>
  );
}

function useSelectSelf(props: PlateElementProps) {
  return (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      Transforms.select(props.editor, Editor.range(props.editor as any, props.path as any) as any);
    } catch {
      // ignore
    }
    document.querySelector<HTMLElement>("[data-slate-editor=\"true\"]")?.focus();
  };
}

const handleBlockTextareaArrowExit = (
  editor: any,
  path: any,
  value: string,
  event: KeyboardEvent<HTMLTextAreaElement>,
) => {
  const key = event.key;
  if (
    key !== "ArrowUp" &&
    key !== "ArrowDown" &&
    key !== "ArrowLeft" &&
    key !== "ArrowRight"
  ) {
    return false;
  }

  const start = event.currentTarget.selectionStart ?? 0;
  const end = event.currentTarget.selectionEnd ?? 0;
  if (start !== end) return false;

  const atStart = start === 0;
  const atEnd = start === value.length;
  const isFirstLine = value.lastIndexOf("\n", start - 1) === -1;
  const isLastLine = value.indexOf("\n", start) === -1;

  if (key === "ArrowUp" && !isFirstLine) return false;
  if (key === "ArrowDown" && !isLastLine) return false;
  if (key === "ArrowLeft" && !atStart) return false;
  if (key === "ArrowRight" && !atEnd) return false;

  const point =
    key === "ArrowUp" || key === "ArrowLeft"
      ? Editor.before(editor, path)
      : Editor.after(editor, path);
  if (!point) return false;

  event.preventDefault();
  event.stopPropagation();
  Transforms.select(editor, point);
  requestAnimationFrame(() => {
    document.querySelector<HTMLElement>("[data-slate-editor=\"true\"]")?.focus();
  });
  return true;
};

function MermaidBlockComponent(props: PlateElementProps) {
  const el = props.element as unknown as MermaidBlockElement;
  const id = typeof el.id === "string" ? el.id : undefined;
  const collapse = useCollapseContext();
  const hidden = id ? collapse?.isHidden(id) : false;
  if (hidden) return null;

  const selected = useSelected();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const highlightRef = useRef<HTMLPreElement | null>(null);
  const pendingSelection = useRef<{ start: number; end: number } | null>(null);
  const code = typeof el.code === "string" ? el.code : "";
  const [draftCode, setDraftCode] = useState(code);
  const selectSelf = useSelectSelf(props);
  const displayCode = selected ? draftCode : code;
  const highlighted = usePrismHighlight({ language: "mermaid", code: displayCode });
  useMermaidTick();

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

  const handleRemove = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    Transforms.removeNodes(props.editor, { at: props.path });
    Transforms.insertNodes(
      props.editor,
      { type: "p", ...(id ? { id } : {}), children: [{ text: "" }] } as any,
      { at: props.path },
    );
  };

  return (
    <PlateElement
      as="div"
      {...props}
      className="group relative my-3 rounded border border-neutral-200 bg-neutral-50 px-3 py-2"
    >
      <div
        contentEditable={false}
        className="flex items-center justify-between text-xs text-neutral-600"
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
          <span className="rounded bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-600">
            Mermaid
          </span>
        )}
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
                if (handleBlockTextareaArrowExit(props.editor, props.path, displayCode, e)) {
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
        <div
          contentEditable={false}
          className="mt-2 rounded border border-neutral-200 bg-white p-2 text-[11px] text-neutral-600"
          onMouseDown={selectSelf}
        >
          {svgHtml ? (
            <div
              aria-hidden
              style={{ pointerEvents: "none" }}
              dangerouslySetInnerHTML={{ __html: svgHtml }}
            />
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
        </div>
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
  if (hidden) return null;

  const selected = useSelected();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const code = typeof el.code === "string" ? el.code : "";
  const [draftCode, setDraftCode] = useState(code);
  const pendingSelection = useRef<{ start: number; end: number } | null>(null);
  const dialect = typeof el.dialect === "string" ? el.dialect : "pseudocode.js";
  const selectSelf = useSelectSelf(props);
  const displayCode = selected ? draftCode : code;

  useEffect(() => {
    if (!selected) return;
    textareaRef.current?.focus();
  }, [selected]);

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

  const handleRemove = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    Transforms.removeNodes(props.editor, { at: props.path });
    Transforms.insertNodes(
      props.editor,
      { type: "p", ...(id ? { id } : {}), children: [{ text: "" }] } as any,
      { at: props.path },
    );
  };

  return (
    <PlateElement
      as="div"
      {...props}
      className="group relative my-3 rounded border border-neutral-200 bg-neutral-50 px-3 py-2"
    >
      <div
        contentEditable={false}
        className="flex items-center justify-between text-xs text-neutral-600"
        onMouseDown={selectSelf}
      >
        {selected ? (
          <span contentEditable={false}>
            <select
              value={dialect}
              onChange={() => {}}
              onMouseDown={(e) => e.stopPropagation()}
              onKeyDownCapture={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              className="h-6 rounded border border-neutral-200 bg-white px-1 text-[11px] text-neutral-700"
            >
              <option value="pseudocode.js">pseudocode.js</option>
            </select>
          </span>
        ) : (
          <span className="rounded bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-600">
            {dialect}
          </span>
        )}
      </div>

      {selected ? (
        <div contentEditable={false}>
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
              if (handleBlockTextareaArrowExit(props.editor, props.path, displayCode, e)) {
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
                } catch {
                  // ignore
                }
              });
            }}
            onMouseDown={(e) => e.stopPropagation()}
            rows={Math.min(14, Math.max(4, code.split("\n").length + 1))}
            className="mt-2 w-full resize-y rounded border border-neutral-200 bg-white px-2 py-1 font-mono text-xs text-neutral-800 outline-none"
            placeholder={
              "procedure Example(x)\n  if x < 0\n    return 0\n  return x"
            }
          />
        </div>
      ) : (
        <div
          contentEditable={false}
          className="mt-2 rounded border border-neutral-200 bg-white p-2 text-[11px] text-neutral-600"
          onMouseDown={selectSelf}
        >
          <div className="mb-1 text-[10px] uppercase tracking-wide text-neutral-400">
            Procedure preview not implemented yet
          </div>
          <pre className="whitespace-pre-wrap break-words font-mono">{code}</pre>
        </div>
      )}

      <span className="absolute inset-0 opacity-0 pointer-events-none" aria-hidden>
        {props.children}
      </span>

      <RemoveButton onMouseDown={handleRemove} label="Remove procedure block" />
    </PlateElement>
  );
}

function CodeBlockComponent(props: PlateElementProps) {
  const el = props.element as unknown as CodeBlockElement;
  const id = typeof el.id === "string" ? el.id : undefined;
  const collapse = useCollapseContext();
  const hidden = id ? collapse?.isHidden(id) : false;
  if (hidden) return null;

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

  useEffect(() => {
    if (!selected) return;
    textareaRef.current?.focus();
  }, [selected]);

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

  const handleRemove = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    Transforms.removeNodes(props.editor, { at: props.path });
    Transforms.insertNodes(
      props.editor,
      { type: "p", ...(id ? { id } : {}), children: [{ text: "" }] } as any,
      { at: props.path },
    );
  };

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

  return (
    <PlateElement
      as="div"
      {...props}
      className="group relative my-3 rounded border border-neutral-200 bg-neutral-50 px-3 py-2"
    >
      <div
        contentEditable={false}
        className="flex items-center justify-between text-xs text-neutral-600"
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
          <span className="rounded bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-600">
            {langLabel}
          </span>
        )}
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
                if (handleBlockTextareaArrowExit(props.editor, props.path, draftCode, e)) {
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
        <div
          contentEditable={false}
          className="mt-2 rounded border border-neutral-200 bg-white p-2"
          onMouseDown={selectSelf}
        >
          <pre className={`code-prism language-${language} whitespace-pre-wrap break-words font-mono text-[11px] text-neutral-800`}>
            <code
              className={`language-${language}`}
              dangerouslySetInnerHTML={{ __html: highlighted.html }}
            />
          </pre>
        </div>
      )}

      <span className="absolute inset-0 opacity-0 pointer-events-none" aria-hidden>
        {props.children}
      </span>

      <RemoveButton onMouseDown={handleRemove} label="Remove code block" />
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

export const CodeBlockPlugin = createSlatePlugin({
  key: "codeBlock",
  node: {
    type: "code_block",
    isElement: true,
    isVoid: true,
    component: CodeBlockComponent as any,
  },
});
