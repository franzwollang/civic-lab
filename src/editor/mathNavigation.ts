import type { KeyboardEvent } from "react";
import { Editor, Element, Node, Range, Text, Transforms } from "slate";

const isMathInline = (n: unknown) =>
  Element.isElement(n) && (n as any).type === "math_inline";

const isBlockVoid = (n: unknown) => {
  if (!Element.isElement(n)) return false;
  const type = (n as any).type;
  return (
    type === "math_block" ||
    type === "code_block" ||
    type === "mermaid_block" ||
    type === "procedure_block"
  );
};

/**
 * Make `math_inline` (an inline void) feel easier to enter/exit with arrows:
 * - From adjacent text: ArrowLeft/ArrowRight selects the math element in 1 tap.
 * - While math element is selected: Arrow keys jump before/after it.
 *
 * Also handles block void up/down navigation: ArrowUp/ArrowDown selects the
 * block in one tap, and exits the selected block in one tap.
 */
export function handleMathInlineArrowNavigation(
  editor: Editor,
  event: KeyboardEvent,
): boolean {
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

  // 1) If we're currently on a math node, arrow keys should exit it.
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

  const blockEntry = Editor.above(editor, { match: isBlockVoid });
  if (blockEntry) {
    const [, path] = blockEntry;
    const point =
      key === "ArrowUp" || key === "ArrowLeft"
        ? Editor.before(editor, path)
        : Editor.after(editor, path);
    if (!point) return false;
    event.preventDefault();
    event.stopPropagation();
    Transforms.select(editor, point);
    return true;
  }

  if (!Range.isCollapsed(sel)) return false;

  // 2) Enter math_inline from adjacent text with left/right.
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

  // 3) Enter math_block from adjacent blocks with up/down.
  if (key === "ArrowDown" || key === "ArrowUp") {
    const currentBlock = Editor.above(editor, {
      match: (n) => Element.isElement(n) && Editor.isBlock(editor, n),
    });
    if (!currentBlock) return false;

    const [, blockPath] = currentBlock;
    const atEdge = (() => {
      try {
        return key === "ArrowDown"
          ? Editor.isEnd(editor, anchor, blockPath)
          : Editor.isStart(editor, anchor, blockPath);
      } catch {
        return false;
      }
    })();
    if (!atEdge) return false;

    const neighbor =
      key === "ArrowDown"
        ? Editor.next(editor, {
            at: blockPath,
            match: (n) => Element.isElement(n) && Editor.isBlock(editor, n),
          })
        : Editor.previous(editor, {
            at: blockPath,
            match: (n) => Element.isElement(n) && Editor.isBlock(editor, n),
          });
    if (!neighbor) return false;

    const [neighborNode, neighborPath] = neighbor;
    if (!isBlockVoid(neighborNode)) return false;

    event.preventDefault();
    event.stopPropagation();
    Transforms.select(editor, Editor.range(editor, neighborPath));
    return true;
  }

  return false;
}
