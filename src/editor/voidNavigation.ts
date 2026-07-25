import type { KeyboardEvent } from "react";
import { Editor, Element, Node, Path, Range, Transforms } from "slate";
import { ReactEditor } from "slate-react";

const VOID_BLOCK_TYPES = new Set([
  "math_block",
  "data_block",
  "mermaid_block",
  "procedure_block",
  "image_block",
  "external_artifact",
  "evidence_block_data",
  "evidence_block_math",
]);

// Spec summary (block-level voids):
// 1) ArrowDown from last line above a void enters its first line (preserve column).
// 2) ArrowUp from line below a void enters its last line (preserve column).
// 3) Exiting a void with up/down moves to the nearest valid caret position in the neighbor block.

export const isVoidBlockElement = (node: unknown) =>
  Element.isElement(node) && VOID_BLOCK_TYPES.has((node as any).type);

// --- Intent storage (what selection to apply when a void block is entered) ---
type VoidEntryIntent =
  | { type: "start" }
  | { type: "end" }
  | { type: "line"; line: "first" | "last"; column: number };

const intentById = new Map<string, VoidEntryIntent>();
const intentByPath = new Map<string, VoidEntryIntent>();

const getPathKey = (path: Path) => path.join(".");

export function setVoidEntryIntent(
  node: { id?: string },
  path: Path,
  intent: VoidEntryIntent,
) {
  if (node.id) {
    intentById.set(node.id, intent);
    return;
  }
  intentByPath.set(getPathKey(path), intent);
}

export function consumeVoidEntryIntent(
  node: { id?: string },
  path: Path,
): VoidEntryIntent | null {
  if (node.id && intentById.has(node.id)) {
    const intent = intentById.get(node.id) ?? null;
    intentById.delete(node.id);
    return intent;
  }
  const key = getPathKey(path);
  if (intentByPath.has(key)) {
    const intent = intentByPath.get(key) ?? null;
    intentByPath.delete(key);
    return intent;
  }
  return null;
}

// --- Intent -> textarea selection mapping ---
export function getVoidEntrySelection(
  value: string,
  intent: VoidEntryIntent,
): { start: number; end: number } {
  const length = value.length;
  if (intent.type === "start") return { start: 0, end: 0 };
  if (intent.type === "end") return { start: length, end: length };

  const lines = value.split(/\r?\n/);
  if (lines.length === 0) return { start: 0, end: 0 };
  const column = Math.max(0, intent.column);

  if (intent.line === "first") {
    const firstLine = lines[0] ?? "";
    const pos = Math.min(column, firstLine.length);
    return { start: pos, end: pos };
  }

  const lastLine = lines[lines.length - 1] ?? "";
  const lineStart = value.lastIndexOf("\n") + 1;
  const pos = lineStart + Math.min(column, lastLine.length);
  return { start: pos, end: pos };
}

// --- Shared helpers (column + neighbor resolution) ---
const isArrowKey = (key: string) =>
  key === "ArrowUp" ||
  key === "ArrowDown" ||
  key === "ArrowLeft" ||
  key === "ArrowRight";

const isVerticalArrowKey = (key: string) =>
  key === "ArrowUp" || key === "ArrowDown";

const focusEditorNow = () => {
  if (typeof document === "undefined") return false;
  const el = document.querySelector<HTMLElement>(
    "[data-slate-editor=\"true\"]",
  );
  if (!el) {
    logVoidNav("focus: editor element not found");
    return false;
  }
  try {
    (el as any).focus({ preventScroll: true });
  } catch {
    el.focus();
  }
  if (DEBUG_VOID_NAV_VERBOSE) {
    logVoidNav("focus: editor focused", {
      active: getActiveElementSnapshot(),
      dom: getDomSelectionSnapshot(),
    });
  }
  return true;
};

const scheduleFrame = (cb: () => void) => {
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(cb);
    return;
  }
  setTimeout(cb, 0);
};

const focusAndSelect = (
  editor: Editor,
  target: any,
  label: string,
) => {
  logVoidNav("focus-select: begin", { label, target });
  const focused = focusEditorNow();
  try {
    Transforms.select(editor, target);
  } catch (error) {
    logVoidNav("focus-select: select failed", { label, error });
  }

  scheduleFrame(() => {
    const range = Editor.range(editor, target);
    if (canResolveDomRange(editor, range)) {
      try {
        ReactEditor.focus(editor as any);
      } catch (error) {
        logVoidNav("focus-select: react focus failed", { label, error });
      }
    }
    try {
      Transforms.select(editor, target);
    } catch (error) {
      logVoidNav("focus-select: reselect failed", { label, error });
    }
    if (!focused) focusEditorNow();
    logVoidNav("focus-select: after", {
      label,
      selection: editor.selection,
      dom: getDomSelectionSnapshot(),
      active: getActiveElementSnapshot(),
    });
  });
};

const DEBUG_VOID_NAV = Boolean(
  (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV,
);
const DEBUG_VOID_NAV_VERBOSE = false;
const pathLabel = (path: Path) => path.join(".");
const nodeLabel = (node: unknown) =>
  Element.isElement(node) ? (node as any).type ?? "element" : typeof node;
const logVoidNav = (message: string, payload?: Record<string, unknown>) => {
  if (!DEBUG_VOID_NAV) return;
  if (payload) {
    console.debug(`[void-nav] ${message}`, payload);
  } else {
    console.debug(`[void-nav] ${message}`);
  }
};

const getDomSelectionSnapshot = () => {
  if (typeof document === "undefined") return null;
  const sel = document.getSelection();
  if (!sel) return null;
  const anchorNode = sel.anchorNode;
  const focusNode = sel.focusNode;
  return {
    isCollapsed: sel.isCollapsed,
    anchorNode: anchorNode ? anchorNode.nodeName : null,
    anchorOffset: sel.anchorOffset,
    focusNode: focusNode ? focusNode.nodeName : null,
    focusOffset: sel.focusOffset,
  };
};

const getActiveElementSnapshot = () => {
  if (typeof document === "undefined") return null;
  const el = document.activeElement as HTMLElement | null;
  if (!el) return null;
  return {
    tag: el.tagName,
    role: el.getAttribute("role"),
    editable: el.getAttribute("contenteditable"),
    dataset: (el as HTMLElement).dataset,
  };
};


const getNeighborBlock = (
  editor: Editor,
  path: Path,
  direction: "prev" | "next",
) => {
  return direction === "prev"
    ? Editor.previous(editor, {
        at: path,
        match: (n) => Element.isElement(n) && Editor.isBlock(editor, n),
      })
    : Editor.next(editor, {
        at: path,
        match: (n) => Element.isElement(n) && Editor.isBlock(editor, n),
      });
};

const getColumnFromOffset = (value: string, offset: number) => {
  const clipped = value.slice(0, Math.min(offset, value.length));
  const lastNewline = clipped.lastIndexOf("\n");
  return lastNewline === -1 ? clipped.length : clipped.length - lastNewline - 1;
};

const getSelectionColumn = (editor: Editor, blockPath: Path): number => {
  const sel = editor.selection;
  if (!sel) return 0;

  const anchor = sel.anchor;
  let offset = 0;
  let matched = false;

  for (const [node, path] of Node.texts(editor, { at: blockPath })) {
    if (Path.equals(path, anchor.path)) {
      offset += anchor.offset;
      matched = true;
      break;
    }
    offset += node.text.length;
  }

  if (!matched) return 0;

  const text = Editor.string(editor, blockPath);
  return getColumnFromOffset(text, offset);
};

const getPointFromOffset = (
  editor: Editor,
  blockPath: Path,
  offset: number,
) => {
  let remaining = Math.max(0, offset);
  let sawText = false;
  for (const [node, path] of Node.texts(editor, { at: blockPath })) {
    sawText = true;
    const len = node.text.length;
    if (remaining <= len) {
      return { path, offset: remaining };
    }
    remaining -= len;
  }
  return sawText ? Editor.end(editor, blockPath) : Editor.start(editor, blockPath);
};

const getNodeId = (node: unknown) =>
  Element.isElement(node) ? (node as any).id : undefined;

const canResolveDomRange = (editor: Editor, range: Range) => {
  try {
    ReactEditor.toDOMRange(editor as any, range as any);
    return true;
  } catch {
    return false;
  }
};

const getNeighborBlockFiltered = (
  editor: Editor,
  startPath: Path,
  direction: "prev" | "next",
  isHidden?: (node: unknown) => boolean,
) => {
  let entry = getNeighborBlock(editor, startPath, direction);
  while (entry) {
    const [node, path] = entry;
    if (!isHidden || !isHidden(node)) return entry;
    if (DEBUG_VOID_NAV_VERBOSE) {
      logVoidNav("neighbor skip (hidden)", {
        path: pathLabel(path),
        id: getNodeId(node),
      });
    }
    entry = getNeighborBlock(editor, path, direction);
  }
  return null;
};

const getPointAtLineColumn = (
  editor: Editor,
  blockPath: Path,
  line: "first" | "last",
  column: number,
) => {
  const text = Editor.string(editor, blockPath);
  if (!text) return Editor.start(editor, blockPath);

  if (line === "first") {
    const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
    const offset = Math.min(column, firstLine.length);
    return getPointFromOffset(editor, blockPath, offset);
  }

  const lastNewline = text.lastIndexOf("\n");
  const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;
  const lastLine = text.slice(lineStart);
  const offset = lineStart + Math.min(column, lastLine.length);
  return getPointFromOffset(editor, blockPath, offset);
};

const selectVoidBlock = (
  editor: Editor,
  node: unknown,
  path: Path,
  intent: VoidEntryIntent,
) => {
  setVoidEntryIntent(node as any, path, intent);
  Transforms.select(editor, Editor.range(editor, path));
};

// --- Shared vertical exit from a void block (textarea / image inputs / editor) ---
function exitVoidBlockVertically(
  editor: Editor,
  path: Path,
  event: KeyboardEvent,
  column: number,
  isHidden?: (node: unknown) => boolean,
  blurTarget?: HTMLElement | null,
): boolean {
  const direction = event.key === "ArrowUp" ? "prev" : "next";

  const buildTarget =
    event.key === "ArrowUp"
      ? (p: Path) => getPointAtLineColumn(editor, p, "last", column)
      : (p: Path) => getPointAtLineColumn(editor, p, "first", column);

  const neighbor = getNeighborBlockFiltered(editor, path, direction, isHidden);
  if (!neighbor) {
    logVoidNav("void exit: no neighbor", {
      key: event.key,
      path: pathLabel(path),
    });
    return false;
  }

  event.preventDefault();
  event.stopPropagation();

  logVoidNav("void exit: neighbor", {
    key: event.key,
    direction,
    neighborType: nodeLabel(neighbor[0]),
    neighborPath: pathLabel(neighbor[1]),
    column,
  });

  if (blurTarget) {
    try {
      blurTarget.blur();
    } catch {
      // ignore
    }
  }

  const [neighborNode, neighborPath] = neighbor;
  if (isVoidBlockElement(neighborNode)) {
    const intent: VoidEntryIntent =
      event.key === "ArrowUp"
        ? { type: "line", line: "last", column }
        : { type: "line", line: "first", column };

    logVoidNav("void exit: select void neighbor", {
      intent,
      neighborPath: pathLabel(neighborPath),
    });
    setVoidEntryIntent(neighborNode as any, neighborPath, intent);
    focusAndSelect(editor, Editor.range(editor, neighborPath), "exit->void");
    return true;
  }

  const target = buildTarget(neighborPath);
  logVoidNav("void exit: select text neighbor", {
    target,
    neighborPath: pathLabel(neighborPath),
  });
  focusAndSelect(editor, target, "exit->text");
  return true;
}

// --- Textarea-level navigation (exit from void UI) ---
export function handleVoidBlockTextareaArrowExit(
  editor: Editor,
  path: Path,
  value: string,
  event: KeyboardEvent<HTMLTextAreaElement>,
  isHidden?: (node: unknown) => boolean,
): boolean {
  // Step A: only act on arrow keys with a collapsed caret.
  if (!isArrowKey(event.key)) return false;
  if (!isVerticalArrowKey(event.key)) return false;

  const start = event.currentTarget.selectionStart ?? 0;
  const end = event.currentTarget.selectionEnd ?? 0;
  logVoidNav("textarea arrow", {
    key: event.key,
    path: pathLabel(path),
    start,
    end,
    length: value.length,
  });
  if (start !== end) return false;

  const isFirstLine = value.lastIndexOf("\n", Math.max(0, start - 1)) === -1;
  const isLastLine = value.indexOf("\n", start) === -1;

  // Step B: only exit if the caret is at the boundary that corresponds to the arrow.
  if (event.key === "ArrowUp" && !isFirstLine) return false;
  if (event.key === "ArrowDown" && !isLastLine) return false;

  const column = getColumnFromOffset(value, start);
  return exitVoidBlockVertically(
    editor,
    path,
    event,
    column,
    isHidden,
    event.currentTarget,
  );
}

/**
 * Vertical exit from a void block's edge control (e.g. image URL/caption inputs).
 * Call when ArrowUp on the first field or ArrowDown on the last field.
 */
export function handleVoidBlockEdgeArrowExit(
  editor: Editor,
  path: Path,
  event: KeyboardEvent,
  opts: {
    edge: "start" | "end";
    column?: number;
    isHidden?: (node: unknown) => boolean;
  },
): boolean {
  if (!isVerticalArrowKey(event.key)) return false;
  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
    return false;
  }
  if (event.key === "ArrowUp" && opts.edge !== "start") return false;
  if (event.key === "ArrowDown" && opts.edge !== "end") return false;

  const column = Math.max(0, opts.column ?? 0);
  const blurTarget =
    event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
  return exitVoidBlockVertically(
    editor,
    path,
    event,
    column,
    opts.isHidden,
    blurTarget,
  );
}

// --- Editor-level navigation (enter/exit void blocks) ---
export function handleVoidBlockArrowNavigation(
  editor: Editor,
  event: KeyboardEvent,
  isHidden?: (node: unknown) => boolean,
): boolean {
  // Step A: guard — arrows only, no modifiers, selection required.
  if (!isArrowKey(event.key)) return false;
  if (!isVerticalArrowKey(event.key)) return false;
  if (event.metaKey || event.ctrlKey || event.altKey) return false;
  if (event.shiftKey) return false;

  const sel = editor.selection;
  if (!sel) return false;
  logVoidNav("editor arrow", {
    key: event.key,
    selection: sel,
  });

  // Step B: if the selection is on a void block, exit it like a single "object".
  const selectedVoid = Editor.above(editor, { match: isVoidBlockElement });
  if (selectedVoid) {
    const [, voidPath] = selectedVoid;
    const voidRange = Editor.range(editor, voidPath);

    if (Range.equals(sel, voidRange)) {
      // Prefer column from a focused textarea inside the void when available.
      let column = 0;
      if (typeof document !== "undefined") {
        const active = document.activeElement;
        if (
          active instanceof HTMLTextAreaElement ||
          active instanceof HTMLInputElement
        ) {
          const start = active.selectionStart ?? 0;
          const value = active.value ?? "";
          column = getColumnFromOffset(value, start);
        }
      }

      return exitVoidBlockVertically(
        editor,
        voidPath,
        event,
        column,
        isHidden,
      );
    }
  }

  // Step C: only handle entry when selection is collapsed within a non-void block.
  if (!Range.isCollapsed(sel)) return false;

  const currentBlock = Editor.above(editor, {
    match: (n) => Element.isElement(n) && Editor.isBlock(editor, n),
  });
  if (!currentBlock) return false;

  const [blockNode, blockPath] = currentBlock;
  if (isVoidBlockElement(blockNode)) return false;

  const atStart = Editor.isStart(editor, sel.anchor, blockPath);
  const atEnd = Editor.isEnd(editor, sel.anchor, blockPath);

  // Step C1: only enter on the correct boundary for the arrow direction.
  if (event.key === "ArrowUp" && !atStart) return false;
  if (event.key === "ArrowDown" && !atEnd) return false;

  const direction = event.key === "ArrowUp" ? "prev" : "next";
  const neighbor = getNeighborBlockFiltered(
    editor,
    blockPath,
    direction,
    isHidden,
  );
  if (!neighbor) return false;

  const [neighborNode, neighborPath] = neighbor;
  if (!isVoidBlockElement(neighborNode)) return false;

  // Step C2: enter the void block and preserve column for vertical movement.
  const column = getSelectionColumn(editor, blockPath);
  const intent: VoidEntryIntent =
    event.key === "ArrowUp"
      ? { type: "line", line: "last", column }
      : { type: "line", line: "first", column };

  event.preventDefault();
  event.stopPropagation();

  logVoidNav("editor enter: select void neighbor", {
    key: event.key,
    blockPath: pathLabel(blockPath),
    neighborPath: pathLabel(neighborPath),
    intent,
  });
  selectVoidBlock(editor, neighborNode, neighborPath, intent);
  return true;
}
