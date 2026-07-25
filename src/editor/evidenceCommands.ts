import { v4 as uuidv4 } from "uuid";
import { Editor, Element, Path, Range, Transforms } from "slate";

type BlockNode = Record<string, unknown> & {
  type: string;
  id: string;
  children: Array<{ text: string }>;
};

function insertBlockAfterSelection(editor: Editor, node: BlockNode) {
  const blockEntry = editor.selection
    ? Editor.above(editor, {
        match: (n) => Element.isElement(n) && Editor.isBlock(editor, n),
      })
    : null;

  const insertPath = blockEntry
    ? Path.next(blockEntry[1])
    : [editor.children.length];

  Transforms.insertNodes(editor, node as any, { at: insertPath, select: true });
  Transforms.select(editor, Editor.range(editor, insertPath));
}

function replaceEmptyParagraphOrInsertAfter(editor: Editor, node: BlockNode) {
  const blockEntry = editor.selection
    ? Editor.above(editor, {
        match: (n) => Element.isElement(n) && Editor.isBlock(editor, n),
      })
    : null;

  if (blockEntry) {
    const [block, path] = blockEntry as any;
    if (
      Element.isElement(block) &&
      block.type === "p" &&
      Editor.string(editor, path).trim().length === 0
    ) {
      Transforms.removeNodes(editor, { at: path });
      Transforms.insertNodes(editor, node as any, { at: path, select: true });
      Transforms.select(editor, Editor.range(editor, path));
      return;
    }
  }

  insertBlockAfterSelection(editor, node);
}

export function insertEvidenceBlock(editor: Editor) {
  replaceEmptyParagraphOrInsertAfter(editor, {
    type: "evidence_block",
    id: uuidv4(),
    kind: "text",
    lang: "en",
    attribution_ref: "",
    children: [
      {
        type: "evidence_block_text",
        children: [{ text: "" }],
      },
      {
        type: "evidence_block_translation",
        children: [{ text: "" }],
      },
    ],
  });
}

export function insertCitationInline(editor: Editor, attributionRef = "") {
  Transforms.insertNodes(
    editor,
    {
      type: "citation_inline",
      id: uuidv4(),
      attribution_ref: attributionRef,
      children: [{ text: "" }],
    } as any,
    { select: true },
  );
}

export function insertTermInline(
  editor: Editor,
  termRef = "",
  fallbackLabel = "",
) {
  const selection = editor.selection;
  if (selection && Range.isExpanded(selection)) {
    Transforms.delete(editor);
  }

  Transforms.insertNodes(
    editor,
    {
      type: "term_inline",
      id: uuidv4(),
      term_ref: termRef,
      children: [{ text: fallbackLabel || "term" }],
    } as any,
    { select: true },
  );
}
