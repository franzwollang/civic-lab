import type { KeyboardEvent } from "react";
import { Editor, Element, Node, Range, Text, Transforms } from "slate";
import { handleVoidBlockArrowNavigation } from "@/editor/voidNavigation";

/** Inline void embeds that share enter/exit caret rules. */
const INLINE_VOID_TYPES = new Set(["math_inline", "citation_inline"]);

export const isInlineVoidElement = (n: unknown) =>
  Element.isElement(n) && INLINE_VOID_TYPES.has((n as { type?: string }).type ?? "");

export type VoidNavOptions = {
  /** Skip collapsed/hidden block neighbors when entering/exiting voids. */
  isHidden?: (node: unknown) => boolean;
};

/**
 * Arrow navigation for inline voids + block-level void nodes.
 * - Let block-level void navigation handle entry/exit first.
 * - If the selection is on an inline void, arrow keys exit it.
 * - If the caret is adjacent to an inline void, arrows enter it (L/R and U/D).
 */
export function handleMathInlineArrowNavigation(
  editor: Editor,
  event: KeyboardEvent,
  options?: VoidNavOptions,
): boolean {
  // Step A: guard on arrow keys + no modifiers.
  const key = event.key;
  if (
    key !== "ArrowLeft" &&
    key !== "ArrowRight" &&
    key !== "ArrowUp" &&
    key !== "ArrowDown"
  ) {
    return false;
  }
  if (event.metaKey || event.ctrlKey || event.altKey) return false;
  if (event.shiftKey) return false;

  const sel = editor.selection;
  if (!sel) return false;

  // Step B: block-level void entry/exit (math/code/mermaid/procedure/image/evidence).
  if (handleVoidBlockArrowNavigation(editor, event, options?.isHidden)) {
    return true;
  }

  // Step C: if we're on an inline void node, arrows should exit it.
  const inlineEntry = Editor.above(editor, { match: isInlineVoidElement });
  if (inlineEntry) {
    const [, path] = inlineEntry;
    const point =
      key === "ArrowLeft" || key === "ArrowUp"
        ? Editor.before(editor, path)
        : Editor.after(editor, path);
    if (!point) return false;
    event.preventDefault();
    event.stopPropagation();
    Transforms.select(editor, point);
    return true;
  }

  if (!Range.isCollapsed(sel)) return false;

  // Step D: enter inline void from adjacent text (Left/Right and Up/Down).
  const anchor = sel.anchor;
  let current: unknown;
  try {
    current = Node.get(editor, anchor.path);
  } catch {
    return false;
  }
  if (!Text.isText(current)) return false;

  const [parent, parentPath] = Editor.parent(editor, anchor.path);
  if (!Element.isElement(parent)) return false;

  const idx = anchor.path[anchor.path.length - 1] ?? 0;

  const tryEnterAt = (siblingIndex: number) => {
    const siblingPath = [...parentPath, siblingIndex];
    let sibling: unknown;
    try {
      sibling = Node.get(editor, siblingPath);
    } catch {
      return false;
    }
    if (!isInlineVoidElement(sibling)) return false;
    event.preventDefault();
    event.stopPropagation();
    Transforms.select(editor, Editor.range(editor, siblingPath));
    return true;
  };

  // Right / Down: at end of this text node → enter next sibling if void.
  if (key === "ArrowRight" || key === "ArrowDown") {
    if (anchor.offset !== current.text.length) return false;
    return tryEnterAt(idx + 1);
  }

  // Left / Up: at start of this text node → enter previous sibling if void.
  if (key === "ArrowLeft" || key === "ArrowUp") {
    if (anchor.offset !== 0) return false;
    if (idx <= 0) return false;
    return tryEnterAt(idx - 1);
  }

  return false;
}
