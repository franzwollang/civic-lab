import type { KeyboardEvent } from "react";
import { Editor, Element, Node, Range, Text, Transforms } from "slate";
import { handleVoidBlockArrowNavigation } from "@/editor/voidNavigation";

const isMathInline = (n: unknown) =>
  Element.isElement(n) && (n as any).type === "math_inline";

/**
 * Arrow navigation for inline math + block-level void nodes.
 * - Let block-level void navigation handle entry/exit first.
 * - If the selection is on an inline math node, arrow keys exit it.
 * - If the caret is adjacent to inline math, left/right enters it.
 */
export function handleMathInlineArrowNavigation(
  editor: Editor,
  event: KeyboardEvent,
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

  // Step B: block-level void entry/exit (math/code/mermaid/procedure).
  if (handleVoidBlockArrowNavigation(editor, event)) return true;

  // Step C: if we're on a math_inline node, arrows should exit it.
  const inlineEntry = Editor.above(editor, { match: isMathInline });
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

  // Step D: enter math_inline from adjacent text with left/right only.
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

  if (key === "ArrowRight") {
    if (anchor.offset !== current.text.length) return false;
    const nextPath = [...parentPath, idx + 1];
    let next: unknown;
    try {
      next = Node.get(editor, nextPath);
    } catch {
      return false;
    }
    if (!isMathInline(next)) return false;
    event.preventDefault();
    event.stopPropagation();
    Transforms.select(editor, Editor.range(editor, nextPath));
    return true;
  }

  if (key === "ArrowLeft") {
    if (anchor.offset !== 0) return false;
    if (idx <= 0) return false;
    const prevPath = [...parentPath, idx - 1];
    let prev: unknown;
    try {
      prev = Node.get(editor, prevPath);
    } catch {
      return false;
    }
    if (!isMathInline(prev)) return false;
    event.preventDefault();
    event.stopPropagation();
    Transforms.select(editor, Editor.range(editor, prevPath));
    return true;
  }

  return false;
}
