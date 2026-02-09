import { z, ZodIssueCode } from "zod";
import { Node } from "slate";

import { scanLatex } from "./latex";
import { validateTexWithMathJax } from "@/editor/mathjax";
import { validateMermaidDiagram } from "@/editor/mermaid";
import { parse as parseYaml } from "yaml";
import { load as parseToml } from "js-toml";
import { parse as parseCsv } from "csv-parse/browser/esm/sync";

type SlateBlock = Record<string, unknown> & { type?: string; id?: string };

export type TextParserResult =
  | { ok: true }
  | { ok: false; message: string; code?: string };

export type TextParser = {
  name: string;
  parse: (text: string) => TextParserResult;
};

export type ValidationResult = {
  success: boolean;
  issues: Array<{
    code: string;
    message: string;
    path: Array<string | number>;
    params?: Record<string, unknown>;
  }>;
};

const getHeadingLevel = (type?: string) => {
  if (type === "h2") return 2;
  if (type === "h3") return 3;
  if (type === "h4") return 4;
  return null;
};

export const markdownParser: TextParser = {
  name: "markdown",
  parse: () => ({ ok: true }),
};

export const latexParser: TextParser = {
  name: "latex",
  parse: (text) => {
    const { expressions, error } = scanLatex(text);
    if (error) {
      return { ok: false, message: error.message, code: error.code };
    }

    if (expressions.length === 0) return { ok: true };

    for (const expr of expressions) {
      const tex = expr.tex.trim();
      if (!tex) {
        return {
          ok: false,
          message: expr.display
            ? "Empty display LaTeX ($$...$$ or \\[...\\])."
            : "Empty inline LaTeX ($...$ or \\(...\\)).",
          code: "latex-empty-math",
        };
      }

      // "Parse by rendering": MathJax will throw on invalid TeX.
      const result = validateTexWithMathJax(tex, expr.display);
      if (!result.ok) {
        return {
          ok: false,
          message: result.message,
          code: "latex-parse-error",
        };
      }
    }

    return { ok: true };
  },
};

const defaultParsers: TextParser[] = [markdownParser, latexParser];

const validateDataBlock = (language: string, code: string): TextParserResult => {
  if (!code.trim()) {
    return { ok: false, message: "Data block is empty.", code: "data-empty" };
  }
  try {
    switch (language) {
      case "json":
        JSON.parse(code);
        return { ok: true };
      case "yaml":
        parseYaml(code);
        return { ok: true };
      case "toml":
        parseToml(code);
        return { ok: true };
      case "csv":
        parseCsv(code, { relax_quotes: true });
        return { ok: true };
      default:
        return { ok: true };
    }
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : `Invalid ${language.toUpperCase()} content.`,
      code: "data-parse-error",
    };
  }
};

const createDocumentSchema = (parsers: TextParser[]) =>
  z.array(z.any()).superRefine((nodes: Array<SlateBlock>, ctx) => {
    let lastHeadingLevel: number | null = null;

    nodes.forEach((node, index) => {
      const headingLevel = getHeadingLevel(node.type);
      if (headingLevel !== null) {
        if (
          headingLevel === 3 &&
          (lastHeadingLevel === null || lastHeadingLevel < 2)
        ) {
          ctx.addIssue({
            code: ZodIssueCode.custom,
            message: "H3 must follow an H2.",
            path: [index, "type"],
            params: { rule: "heading-level", expectedParent: "h2" },
          });
        }
        if (
          headingLevel === 4 &&
          (lastHeadingLevel === null || lastHeadingLevel < 3)
        ) {
          ctx.addIssue({
            code: ZodIssueCode.custom,
            message: "H4 must follow an H3.",
            path: [index, "type"],
            params: { rule: "heading-level", expectedParent: "h3" },
          });
        }
        lastHeadingLevel = headingLevel;
      }

      if (node.type === "code_block") {
        const language =
          typeof (node as any).language === "string"
            ? (node as any).language
            : "json";
        const code = typeof (node as any).code === "string" ? (node as any).code : "";
        const result = validateDataBlock(language, code);
        if (!result.ok) {
          ctx.addIssue({
            code: ZodIssueCode.custom,
            message: result.message,
            path: [index, "code"],
            params: {
              rule: "parser-error",
              parser: "data",
              code: result.code,
              language,
            },
          });
        }
        return;
      }

      if (node.type === "mermaid_block") {
        const code = typeof (node as any).code === "string" ? (node as any).code : "";
        if (!code.trim()) {
          ctx.addIssue({
            code: ZodIssueCode.custom,
            message: "Mermaid diagram is empty.",
            path: [index, "code"],
            params: {
              rule: "parser-error",
              parser: "mermaid",
              code: "mermaid-empty",
            },
          });
          return;
        }

        const result = validateMermaidDiagram(code);
        if (!result.ok) {
          ctx.addIssue({
            code: ZodIssueCode.custom,
            message: result.message,
            path: [index, "code"],
            params: {
              rule: "parser-error",
              parser: "mermaid",
              code: "mermaid-parse-error",
            },
          });
        }
        return;
      }

      // Validate math nodes (block-level).
      if (node.type === "math_block") {
        const next = (typeof (node as any).latex === "string"
          ? (node as any).latex
          : ""
        ).trim();
        if (!next) {
          ctx.addIssue({
            code: ZodIssueCode.custom,
            message: "Math block is empty.",
            path: [index, "latex"],
            params: { rule: "parser-error", parser: "latex", code: "latex-empty-math" },
          });
          return;
        }

        const result = validateTexWithMathJax(next, true);
        if (!result.ok) {
          ctx.addIssue({
            code: ZodIssueCode.custom,
            message: result.message,
            path: [index, "latex"],
            params: {
              rule: "parser-error",
              parser: "latex",
              code: "latex-parse-error",
            },
          });
        }
          return;
        }

        // Validate inline math nodes inside blocks + any remaining raw latex text.
      const visit = (n: any, path: Array<string | number>) => {
        if (n && typeof n === "object") {
          if (n.type === "math_inline") {
            const tex = (typeof n.latex === "string" ? n.latex : "").trim();
            if (!tex) {
              ctx.addIssue({
                code: ZodIssueCode.custom,
                message: "Inline math is empty.",
                path: [...path, "latex"],
                params: {
                  rule: "parser-error",
                  parser: "latex",
                  code: "latex-empty-math",
                },
              });
              return;
            }
            const result = validateTexWithMathJax(tex, false);
            if (!result.ok) {
              ctx.addIssue({
                code: ZodIssueCode.custom,
                message: result.message,
                path: [...path, "latex"],
                params: {
                  rule: "parser-error",
                  parser: "latex",
                  code: "latex-parse-error",
                },
              });
            }
            return;
          }

          if (typeof n.text === "string") {
            const text = n.text.trim();
            if (!text) return;
            parsers.forEach((parser) => {
              const result = parser.parse(text);
              if (result.ok) return;
              ctx.addIssue({
                code: ZodIssueCode.custom,
                message: result.message,
                path: [...path, "text"],
                params: {
                  rule: "parser-error",
                  parser: parser.name,
                  code: result.code,
                },
              });
            });
            return;
          }

          if (Array.isArray(n.children)) {
            n.children.forEach((child: any, childIndex: number) => {
              visit(child, [...path, "children", childIndex]);
            });
          }
        }
      };

      visit(node, [index]);
    });
  });

export function validateDocument(
  value: Array<Record<string, unknown>>,
  parsers: TextParser[] = defaultParsers,
): ValidationResult {
  const schema = createDocumentSchema(parsers);
  const result = schema.safeParse(value);
  if (result.success) {
    return { success: true, issues: [] };
  }
  return {
    success: false,
    issues: result.error.issues.map((issue) => ({
      code: issue.code,
      message: issue.message,
      path: issue.path,
      params: issue.params,
    })),
  };
}
