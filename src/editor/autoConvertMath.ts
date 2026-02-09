import { Editor, Element, Text, Transforms } from "slate";
import { v4 as uuidv4 } from "uuid";

import { scanLatex } from "@/doc/latex";
import { isMathJaxReady, validateTexWithMathJax } from "@/editor/mathjax";

const isMathElement = (node: any) =>
  Element.isElement(node) &&
  (node.type === "math_inline" || node.type === "math_block");

const isWordChar = (ch: string) => /[A-Za-z0-9_]/.test(ch);

const hasWordBoundaries = (text: string, start: number, end: number) => {
  const prev = start > 0 ? text[start - 1] : "";
  const next = end < text.length ? text[end] : "";
  if (prev && isWordChar(prev)) return false;
  if (next && isWordChar(next)) return false;
  return true;
};

const hasNoEdgeWhitespace = (tex: string) => tex === tex.trim();

const delimiterIsOnOwnLine = (
  text: string,
  tokenStart: number,
  tokenLen: number,
) => {
  const tokenEnd = tokenStart + tokenLen;
  const lineStart = text.lastIndexOf("\n", tokenStart - 1) + 1;
  const lineEnd = (() => {
    const idx = text.indexOf("\n", tokenEnd);
    return idx === -1 ? text.length : idx;
  })();

  const before = text.slice(lineStart, tokenStart);
  const after = text.slice(tokenEnd, lineEnd);
  return before.trim().length === 0 && after.trim().length === 0;
};

const selectionIntersectsRange = (
  editor: Editor,
  pathKey: string,
  start: number,
  end: number,
) => {
  const sel = editor.selection;
  if (!sel) return false;
  const aKey = sel.anchor.path.join(",");
  const fKey = sel.focus.path.join(",");
  const inRange = (key: string, offset: number) =>
    key === pathKey && offset >= start && offset < end;
  return inRange(aKey, sel.anchor.offset) || inRange(fKey, sel.focus.offset);
};

export function autoConvertMath(editor: Editor): boolean {
  if (!isMathJaxReady()) return false;

  let changed = false;

  Editor.withoutNormalizing(editor, () => {
    // 1) Convert block math: a paragraph containing only $$...$$ or \[...\]
    const paragraphs = Array.from(
      Editor.nodes(editor, {
        at: [],
        match: (n) => Element.isElement(n) && (n as any).type === "p",
      }),
    );

    for (const [node, path] of paragraphs) {
      const el = node as any;
      if (!Array.isArray(el.children) || el.children.length !== 1) continue;
      if (!Text.isText(el.children[0])) continue;

      const rawText = el.children[0].text as string;
      const { expressions, error } = scanLatex(rawText);
      if (error) continue;
      if (expressions.length !== 1) continue;

      const expr = expressions[0];
      if (!expr.display) continue;

      const prefix = rawText.slice(0, expr.start);
      const suffix = rawText.slice(expr.end);
      if (prefix.trim().length !== 0) continue;
      if (suffix.trim().length !== 0) continue;

      // Obsidian-ish: display math delimiters should be on their own lines.
      // Example:
      //   $$
      //   x^2
      //   $$
      const openLen = expr.open === "$$" || expr.open === "\\[" ? 2 : 0;
      const closeLen = expr.open === "$$" || expr.open === "\\[" ? 2 : 0;
      if (openLen === 0 || closeLen === 0) continue;

      const closeStart = expr.end - closeLen;
      if (!delimiterIsOnOwnLine(rawText, expr.start, openLen)) continue;
      if (!delimiterIsOnOwnLine(rawText, closeStart, closeLen)) continue;

      const pathKey = [...path, 0].join(",");
      if (selectionIntersectsRange(editor, pathKey, expr.start, expr.end)) {
        continue;
      }

      const tex = expr.tex.trim();
      if (!tex) continue;
      if (!hasNoEdgeWhitespace(expr.tex)) continue;

      const validation = validateTexWithMathJax(tex, true);
      if (!validation.ok) continue;

      const nextNode = {
        type: "math_block",
        id: typeof el.id === "string" ? el.id : uuidv4(),
        latex: tex,
        children: [{ text: "" }],
      };

      Transforms.removeNodes(editor, { at: path });
      Transforms.insertNodes(editor, nextNode as any, { at: path });
      changed = true;
    }

    // 2) Convert inline math inside text nodes: $...$ or \(...\)
    const textNodes = Array.from(
      Editor.nodes(editor, {
        at: [],
        match: (n) => Text.isText(n),
      }),
    );

    for (const [node, path] of textNodes) {
      const textNode = node as any;
      const text = textNode.text as string;
      if (!text || typeof text !== "string") continue;

      // Skip text that is inside a math node.
      const mathAncestor = Editor.above(editor, {
        at: path,
        match: (n) => isMathElement(n),
      });
      if (mathAncestor) continue;

      const { expressions, error } = scanLatex(text);
      if (error) continue;
      if (expressions.length === 0) continue;

      const pathKey = path.join(",");

      // Apply from end to start so offsets remain valid.
      const inlineExprs = expressions
        .filter((expr) => !expr.display && (expr.open === "$" || expr.open === "\\("))
        .filter((expr) => expr.tex.trim().length > 0)
        .sort((a, b) => b.start - a.start);

      for (const expr of inlineExprs) {
        if (selectionIntersectsRange(editor, pathKey, expr.start, expr.end)) {
          continue;
        }

        // Obsidian-ish: avoid converting in-word occurrences like "foo$E$bar".
        if (!hasWordBoundaries(text, expr.start, expr.end)) continue;

        // Require no leading/trailing whitespace inside delimiters to reduce
        // accidental conversions while typing.
        if (!hasNoEdgeWhitespace(expr.tex)) continue;

        const tex = expr.tex.trim();
        const validation = validateTexWithMathJax(tex, false);
        if (!validation.ok) continue;

        const range = {
          anchor: { path, offset: expr.start },
          focus: { path, offset: expr.end },
        };

        Transforms.delete(editor, { at: range });
        Transforms.insertNodes(
          editor,
          {
            type: "math_inline",
            id: uuidv4(),
            latex: tex,
            children: [{ text: "" }],
          } as any,
          { at: { path, offset: expr.start } as any },
        );
        changed = true;
      }
    }
  });

  return changed;
}
