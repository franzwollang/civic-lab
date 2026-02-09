import type { PlateElementProps } from "platejs/react";
import {
  PlateElement,
  useSelected,
} from "platejs/react";
import { createSlatePlugin } from "platejs";
import { Editor, Transforms } from "slate";
import type { MouseEvent } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { renderTexToSvgHtml, validateTexWithMathJax } from "@/editor/mathjax";
import { useCollapseContext } from "@/editor/collapse";
import { useMathJaxTick } from "@/editor/useMathJaxTick";
import { applyTabToText, TAB_SPACES } from "@/editor/tabSpaces";

type MathInlineElement = {
  type: "math_inline";
  id?: string;
  latex?: string;
  children: Array<{ text: string }>;
};

type MathBlockElement = {
  type: "math_block";
  id?: string;
  latex?: string;
  children: Array<{ text: string }>;
};

function MathInlineComponent(props: PlateElementProps) {
  const el = props.element as unknown as MathInlineElement;
  const selected = useSelected();
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Subscribe so we re-render when MathJax finishes async validation/rendering.
  const mathjaxTick = useMathJaxTick();
  const latex = typeof el.latex === "string" ? el.latex : "";
  const active = selected;

  const hasLatex = latex.trim().length > 0;
  const validation = hasLatex
    ? validateTexWithMathJax(latex, false)
    : ({ ok: false as const, message: "Empty inline math." } as const);
  const svgHtml = !active && hasLatex ? renderTexToSvgHtml(latex, false) : null;
  const inputChWidth = Math.max(2, latex.length + 1);

  const handleRemove = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    Transforms.removeNodes(props.editor, { at: props.path });
  };

  const handleEnter = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      // Select the element so we can render the input UI.
      Transforms.select(
        props.editor,
        Editor.range(props.editor as any, props.path as any) as any,
      );
    } catch {
      // Ignore selection errors; editor will remain usable.
    }

    document.querySelector<HTMLElement>("[data-slate-editor=\"true\"]")?.focus();
  };

  useEffect(() => {
    if (!active) return;
    inputRef.current?.focus();
  }, [active]);

  return (
    <PlateElement
      as="span"
      {...props}
      className="group relative inline-flex items-baseline whitespace-nowrap rounded bg-neutral-50 px-1"
    >
      {!active ? (
        <span
          contentEditable={false}
          className="inline-flex items-baseline"
          onMouseDown={handleEnter}
        >
          {svgHtml ? (
            <span
              aria-hidden
              style={{ pointerEvents: "none" }}
              dangerouslySetInnerHTML={{ __html: svgHtml }}
            />
          ) : (
            <span
              className={
                !validation.ok
                  ? validation.message === "Validating LaTeX..."
                    ? "rounded bg-neutral-100 px-1 text-xs text-neutral-500"
                    : "rounded bg-red-50 px-1 text-xs text-red-700"
                  : "text-xs text-neutral-600"
              }
            >
              {`$${latex}$`}
            </span>
          )}
        </span>
      ) : null}

      <span
        className={
          active
            ? "inline-flex items-baseline"
            : "absolute inset-0 opacity-0 pointer-events-none"
        }
      >
        {active ? (
          // Slate listens to key/beforeinput events in capture phase; putting the editor UI
          // under a non-editable subtree prevents Slate from deleting the selected void node
          // when the user presses Backspace inside the input.
          <span contentEditable={false} className="inline-flex items-baseline">
            <span className="text-xs text-neutral-400">$</span>
            <input
              ref={inputRef}
              value={latex}
              size={inputChWidth}
              onChange={(e) => {
                const next = e.target.value;
                Transforms.setNodes(
                  props.editor,
                  { latex: next },
                  { at: props.path as any },
                );
              }}
              onBeforeInput={(e) => {
                // Keep IME/beforeinput from being handled by Slate while we edit inside the input.
                e.stopPropagation();
              }}
              onCopy={(e) => e.stopPropagation()}
              onCut={(e) => e.stopPropagation()}
              onPaste={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                // Prevent Slate key handlers from acting on the (still-selected) void element.
                e.stopPropagation();

                const key = e.key;
                if (
                  key !== "ArrowLeft" &&
                  key !== "ArrowRight" &&
                  key !== "ArrowUp" &&
                  key !== "ArrowDown"
                ) {
                  return;
                }

                const start = (e.currentTarget.selectionStart ?? 0);
                const end = (e.currentTarget.selectionEnd ?? 0);
                if (start !== end) return;

                const atStart = start === 0;
                const atEnd = start === latex.length;
                if ((key === "ArrowLeft" || key === "ArrowUp") && !atStart) return;
                if ((key === "ArrowRight" || key === "ArrowDown") && !atEnd) return;

                const point =
                  key === "ArrowLeft" || key === "ArrowUp"
                    ? Editor.before(props.editor, props.path)
                    : Editor.after(props.editor, props.path);
                if (!point) return;

                e.preventDefault();
                Transforms.select(props.editor, point);
                requestAnimationFrame(() => {
                  document
                    .querySelector<HTMLElement>("[data-slate-editor=\"true\"]")
                    ?.focus();
                });
              }}
              onMouseDown={(e) => {
                // Don't let Slate steal selection while editing.
                e.stopPropagation();
              }}
              style={{ width: `${inputChWidth}ch` }}
              className={
                "mx-0.5 w-auto bg-transparent text-xs outline-none " +
                (!validation.ok && validation.message !== "Validating LaTeX..."
                  ? "text-red-700"
                  : "text-neutral-700")
              }
              placeholder="\\alpha + 1"
            />
            <span className="text-xs text-neutral-400">$</span>
          </span>
        ) : (
          <span className="mx-0.5">{props.children}</span>
        )}
      </span>

      {/* Keep Slate's required void child in the DOM, but visually hidden. */}
      <span className="absolute inset-0 opacity-0 pointer-events-none" aria-hidden>
        {props.children}
      </span>

      <button
        type="button"
        contentEditable={false}
        onMouseDown={handleRemove}
        aria-label="Remove math"
        className="absolute -right-3 -top-3 hidden h-5 w-5 items-center justify-center rounded border border-neutral-200 bg-white text-[11px] text-neutral-600 shadow-sm hover:bg-neutral-100 group-hover:flex"
      >
        x
      </button>

    </PlateElement>
  );
}

function MathBlockComponent(props: PlateElementProps) {
  const el = props.element as unknown as MathBlockElement;
  const id = typeof el.id === "string" ? el.id : undefined;
  const collapse = useCollapseContext();
  const hidden = id ? collapse?.isHidden(id) : false;
  if (hidden) return null;
  const selected = useSelected();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  // Subscribe so we re-render when MathJax finishes async validation/rendering.
  const mathjaxTick = useMathJaxTick();
  const latex = typeof el.latex === "string" ? el.latex : "";
  const [draftLatex, setDraftLatex] = useState(latex);
  const pendingSelection = useRef<{ start: number; end: number } | null>(null);
  const active = selected;
  const renderRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const displayLatex = active ? draftLatex : latex;

  useLayoutEffect(() => {
    if (!active) return;
    const el = textareaRef.current;
    if (!el) return;
    // Autosize to content (including wrapped lines).
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [active, displayLatex]);

  useEffect(() => {
    const el = renderRef.current;
    if (!el) return;

    const update = () => setContainerWidth(el.clientWidth);
    update();

    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const hasLatex = displayLatex.trim().length > 0;
  const validation = hasLatex
    ? validateTexWithMathJax(displayLatex, true)
    : ({ ok: false as const, message: "Empty math block." } as const);
  const svgHtml = useMemo(() => {
    if (active) return null;
    if (!hasLatex) return null;
    // Render display math with a width so MathJax inserts sensible line breaks.
    return renderTexToSvgHtml(displayLatex, true, containerWidth ?? undefined);
  }, [active, containerWidth, displayLatex, hasLatex, mathjaxTick]);

  const handleRemove = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    // Replace with an empty paragraph to keep the document valid.
    Transforms.removeNodes(props.editor, { at: props.path });
    Transforms.insertNodes(
      props.editor,
      { type: "p", ...(id ? { id } : {}), children: [{ text: "" }] } as any,
      { at: props.path },
    );
  };

  const handleEnter = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      Transforms.select(
        props.editor,
        Editor.range(props.editor as any, props.path as any) as any,
      );
    } catch {
      // ignore
    }
    document
      .querySelector<HTMLElement>("[data-slate-editor=\"true\"]")
      ?.focus();
  };

  useEffect(() => {
    if (!active) return;
    textareaRef.current?.focus();
  }, [active]);

  useEffect(() => {
    if (active) return;
    setDraftLatex(latex);
  }, [active, latex]);

  useLayoutEffect(() => {
    if (!active) return;
    const next = pendingSelection.current;
    if (!next || !textareaRef.current) return;
    pendingSelection.current = null;
    try {
      textareaRef.current.selectionStart = next.start;
      textareaRef.current.selectionEnd = next.end;
    } catch {
      // ignore
    }
  }, [active, displayLatex]);

  return (
    <PlateElement
      as="div"
      {...props}
      className="group relative my-3 rounded border border-neutral-200 bg-neutral-50 px-3 py-2"
    >
      <div
        contentEditable={false}
        className="cursor-text overflow-x-auto text-center"
        onMouseDown={handleEnter}
        ref={renderRef}
      >
        {!active ? (
          svgHtml ? (
            <div
              aria-hidden
              style={{ pointerEvents: "none" }}
              dangerouslySetInnerHTML={{ __html: svgHtml }}
            />
          ) : (
            <div
              className={
                !validation.ok
                  ? validation.message === "Validating LaTeX..."
                    ? "rounded bg-neutral-100 px-2 py-1 text-xs text-neutral-500"
                    : "rounded bg-red-50 px-2 py-1 text-xs text-red-700"
                  : "rounded bg-neutral-100 px-2 py-1 text-xs text-neutral-600"
              }
            >
              {`$$\n${latex}\n$$`}
            </div>
          )
        ) : null}
      </div>

      {active ? (
        // Keep the editing UI under a non-editable subtree so Slate doesn't interpret
        // Backspace as "delete the selected void element".
        <div className="mt-2" contentEditable={false}>
          <div className="mb-1 font-mono text-[11px] text-neutral-500">$$</div>
          <textarea
            ref={textareaRef}
            value={displayLatex}
            onChange={(e) => {
              const next = e.target.value;
              pendingSelection.current = {
                start: e.currentTarget.selectionStart ?? 0,
                end: e.currentTarget.selectionEnd ?? 0,
              };
              setDraftLatex(next);
              Transforms.setNodes(
                props.editor,
                { latex: next },
                { at: props.path as any },
              );
            }}
            onBeforeInput={(e) => {
              // Keep IME/beforeinput from being handled by Slate while we edit inside the textarea.
              e.stopPropagation();
            }}
            onCopy={(e) => e.stopPropagation()}
            onCut={(e) => e.stopPropagation()}
            onPaste={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              // Prevent Slate key handlers from acting on the (still-selected) void element.
              e.stopPropagation();

              const key = e.key;
              if (key === "Tab") {
                e.preventDefault();
                const el = e.currentTarget;
                const next = applyTabToText({
                  value: displayLatex,
                  selectionStart: el.selectionStart ?? 0,
                  selectionEnd: el.selectionEnd ?? 0,
                  tab: TAB_SPACES,
                  outdent: e.shiftKey,
                });
                setDraftLatex(next.value);
                Transforms.setNodes(
                  props.editor,
                  { latex: next.value },
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
                return;
              }
              if (
                key !== "ArrowUp" &&
                key !== "ArrowDown" &&
                key !== "ArrowLeft" &&
                key !== "ArrowRight"
              ) {
                return;
              }

              const start = (e.currentTarget.selectionStart ?? 0);
              const end = (e.currentTarget.selectionEnd ?? 0);
              if (start !== end) return;

              const atStart = start === 0;
              const atEnd = start === displayLatex.length;
              const isFirstLine = displayLatex.lastIndexOf("\n", start - 1) === -1;
              const isLastLine = displayLatex.indexOf("\n", start) === -1;

              if (key === "ArrowUp" && !isFirstLine) return;
              if (key === "ArrowDown" && !isLastLine) return;
              if (key === "ArrowLeft" && !atStart) return;
              if (key === "ArrowRight" && !atEnd) return;

              const point =
                key === "ArrowUp" || key === "ArrowLeft"
                  ? Editor.before(props.editor, props.path)
                  : Editor.after(props.editor, props.path);
              if (!point) return;

              e.preventDefault();
              Transforms.select(props.editor, point);
              requestAnimationFrame(() => {
                document
                  .querySelector<HTMLElement>("[data-slate-editor=\"true\"]")
                  ?.focus();
              });
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className={
              "w-full resize-none overflow-hidden rounded border bg-white px-2 py-1 font-mono text-xs outline-none " +
              (!validation.ok && validation.message !== "Validating LaTeX..."
                ? "border-red-200 text-red-800"
                : "border-neutral-200 text-neutral-800")
            }
            placeholder={"E = mc^2"}
          />
          <div className="mt-1 font-mono text-[11px] text-neutral-500">$$</div>
        </div>
      ) : null}

      <span className="absolute inset-0 opacity-0 pointer-events-none" aria-hidden>
        {props.children}
      </span>

      <button
        type="button"
        contentEditable={false}
        onMouseDown={handleRemove}
        aria-label="Remove math block"
        className="absolute -right-2 -top-2 hidden h-6 w-6 items-center justify-center rounded border border-neutral-200 bg-white text-xs text-neutral-600 shadow-sm hover:bg-neutral-100 group-hover:flex"
      >
        x
      </button>

    </PlateElement>
  );
}

export const MathInlinePlugin = createSlatePlugin({
  key: "mathInline",
  node: {
    type: "math_inline",
    isElement: true,
    isInline: true,
    isVoid: true,
    component: MathInlineComponent as any,
  },
});

export const MathBlockPlugin = createSlatePlugin({
  key: "mathBlock",
  node: {
    type: "math_block",
    isElement: true,
    isVoid: true,
    component: MathBlockComponent as any,
  },
});
