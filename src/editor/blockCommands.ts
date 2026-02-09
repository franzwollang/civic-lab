import { v4 as uuidv4 } from "uuid";
import { Editor, Element, Path, Transforms } from "slate";

type VoidBlockNode = Record<string, unknown> & {
  type: string;
  id: string;
  children: Array<{ text: string }>;
};

function insertVoidBlockAfterSelection(editor: Editor, node: VoidBlockNode) {
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

function replaceEmptyParagraphOrInsertAfter(editor: Editor, node: VoidBlockNode) {
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

  insertVoidBlockAfterSelection(editor, node);
}

export function insertMermaidBlock(editor: Editor, code = "") {
  replaceEmptyParagraphOrInsertAfter(editor, {
    type: "mermaid_block",
    id: uuidv4(),
    code,
    children: [{ text: "" }],
  });
}

export function insertProcedureBlock(editor: Editor, code = "") {
  replaceEmptyParagraphOrInsertAfter(editor, {
    type: "procedure_block",
    id: uuidv4(),
    code,
    dialect: "pseudocode.js",
    children: [{ text: "" }],
  });
}

export function insertCodeBlock(editor: Editor, language: string, code = "") {
  replaceEmptyParagraphOrInsertAfter(editor, {
    type: "code_block",
    id: uuidv4(),
    code,
    language,
    children: [{ text: "" }],
  });
}
