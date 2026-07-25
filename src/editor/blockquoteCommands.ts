import { Editor, Element, Transforms } from "slate";
import type { Editor as SlateEditor } from "slate";
import { ELEMENT_TYPES } from "./model";

/** Toggle blockquote on the current block selection (Plate `tf.blockquote.toggle`). */
export function toggleBlockquote(editor: SlateEditor) {
  const plate = editor as SlateEditor & {
    tf?: { blockquote?: { toggle?: () => void } };
  };
  if (typeof plate.tf?.blockquote?.toggle === "function") {
    plate.tf.blockquote.toggle();
    return;
  }
  // Fallback when transforms are unavailable (tests / non-Plate editors).
  const entry = editor.selection
    ? Editor.above(editor, {
        match: (n) => Element.isElement(n) && Editor.isBlock(editor, n),
      })
    : null;
  if (!entry) return;
  const [block] = entry;
  const nextType =
    Element.isElement(block) &&
    (block as { type?: string }).type === ELEMENT_TYPES.BLOCKQUOTE
      ? ELEMENT_TYPES.PARAGRAPH
      : ELEMENT_TYPES.BLOCKQUOTE;
  Transforms.setNodes(
    editor,
    { type: nextType } as any,
    {
      match: (n) => Element.isElement(n) && Editor.isBlock(editor, n),
    },
  );
}

export function isBlockquoteActive(editor: SlateEditor): boolean {
  try {
    const entry = editor.selection
      ? Editor.above(editor, {
          match: (n) =>
            Element.isElement(n) &&
            Editor.isBlock(editor, n) &&
            (n as { type?: string }).type === ELEMENT_TYPES.BLOCKQUOTE,
        })
      : null;
    return Boolean(entry);
  } catch {
    return false;
  }
}
