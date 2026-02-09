import { v4 as uuidv4 } from "uuid";
import { Editor, Element, Path, Transforms } from "slate";

const isMathInline = (n: unknown) =>
  Element.isElement(n) && (n as any).type === "math_inline";

const isMathBlock = (n: unknown) =>
  Element.isElement(n) && (n as any).type === "math_block";

export function insertMathInline(editor: Editor) {
  const at = editor.selection ?? Editor.end(editor, []);

  Transforms.insertNodes(
    editor,
    { type: "math_inline", id: uuidv4(), latex: "", children: [{ text: "" }] } as any,
    { at, select: true },
  );

  const entry = Editor.above(editor, { match: isMathInline });
  if (!entry) return;
  const [, path] = entry;
  Transforms.select(editor, Editor.range(editor, path));
}

export function insertMathBlock(editor: Editor) {
  const blockEntry = editor.selection
    ? Editor.above(editor, {
        match: (n) => Element.isElement(n) && Editor.isBlock(editor, n),
      })
    : null;

  const insertPath = blockEntry ? Path.next(blockEntry[1]) : [editor.children.length];

  Transforms.insertNodes(
    editor,
    { type: "math_block", id: uuidv4(), latex: "", children: [{ text: "" }] } as any,
    { at: insertPath, select: true },
  );

  const entry = Editor.above(editor, { match: isMathBlock });
  const path = entry ? entry[1] : insertPath;
  Transforms.select(editor, Editor.range(editor, path));
}
