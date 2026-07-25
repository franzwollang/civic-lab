import { z, ZodIssueCode } from "zod";

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
    severity: "error" | "warning";
  }>;
};

export type ValidationRegistry = {
  attributions?: Set<string>;
  terms?: Map<string, { status?: string }>;
};

export type ValidationOptions = {
  parsers?: TextParser[];
  registry?: ValidationRegistry;
};

const getNodeText = (node: unknown): string => {
  if (!node || typeof node !== "object") return "";
  if (typeof (node as { text?: unknown }).text === "string") {
    return String((node as { text: string }).text);
  }
  const children = (node as { children?: unknown }).children;
  if (!Array.isArray(children)) return "";
  return children.map(getNodeText).join("");
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

const createDocumentSchema = (
  parsers: TextParser[],
  registry?: ValidationRegistry,
) =>
  z.array(z.any()).superRefine((nodes: Array<SlateBlock>, ctx) => {
    let lastHeadingLevel: number | null = null;
    const hasAttribution = (id?: string) =>
      typeof id === "string" &&
      id.trim().length > 0 &&
      (!registry?.attributions || registry.attributions.has(id));
    const hasTerm = (id?: string) =>
      typeof id === "string" &&
      id.trim().length > 0 &&
      (!registry?.terms || registry.terms.has(id));
    const getTermStatus = (id?: string) => {
      if (!registry?.terms) return null;
      if (!id) return null;
      return registry.terms.get(id)?.status ?? null;
    };
    const warn = (message: string, path: Array<string | number>, params?: Record<string, unknown>) => {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message,
        path,
        params: { ...(params ?? {}) },
      });
    };

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

      if (node.type === "data_block") {
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

      if (node.type === "evidence_block") {
        const kind = typeof (node as any).kind === "string" ? (node as any).kind : "text";
        const lang = typeof (node as any).lang === "string" ? (node as any).lang : "";
        const attributionRef = typeof (node as any).attribution_ref === "string" ? (node as any).attribution_ref : "";
        const children = Array.isArray((node as any).children)
          ? (node as any).children
          : [];
        const translationChild = children.find(
          (child: unknown) =>
            child &&
            typeof child === "object" &&
            (child as { type?: unknown }).type === "evidence_block_translation",
        );
        const dataChild = children.find(
          (child: unknown) =>
            child &&
            typeof child === "object" &&
            (child as { type?: unknown }).type === "evidence_block_data",
        ) as { code?: unknown } | undefined;
        const mathChild = children.find(
          (child: unknown) =>
            child &&
            typeof child === "object" &&
            (child as { type?: unknown }).type === "evidence_block_math",
        ) as { latex?: unknown } | undefined;
        const translationText = translationChild
          ? getNodeText(translationChild).trim()
          : "";

        if (kind === "text" && !lang.trim()) {
          warn("Evidence block is missing a language.", [index, "lang"], {
            rule: "evidence-lang",
          });
        }

        if (!attributionRef.trim()) {
          warn("Evidence block is missing an attribution.", [index, "attribution_ref"], {
            rule: "evidence-attribution",
          });
        } else if (!hasAttribution(attributionRef)) {
          warn("Evidence block attribution was not found in the registry.", [index, "attribution_ref"], {
            rule: "evidence-attribution-missing",
          });
        }

        if (kind === "text" && lang.trim() && lang.trim() !== "en" && !translationText) {
          warn("Non-English evidence blocks require an English translation.", [index, "children"], {
            rule: "evidence-translation",
          });
        }

        if (kind === "data") {
          if (!dataChild) {
            warn("Evidence block is missing a data excerpt.", [index, "children"], {
              rule: "evidence-data-missing",
            });
          } else if (typeof dataChild.code !== "string" || !dataChild.code.trim()) {
            warn("Evidence data excerpt is empty.", [index, "children"], {
              rule: "evidence-data-empty",
            });
          }
        }

        if (kind === "math") {
          if (!mathChild) {
            warn("Evidence block is missing a math excerpt.", [index, "children"], {
              rule: "evidence-math-missing",
            });
          } else {
            const tex = typeof mathChild.latex === "string" ? mathChild.latex : "";
            if (!tex.trim()) {
              warn("Evidence math excerpt is empty.", [index, "children"], {
                rule: "evidence-math-empty",
              });
            } else {
              const result = validateTexWithMathJax(tex, true);
              if (!result.ok) {
                ctx.addIssue({
                  code: ZodIssueCode.custom,
                  message: result.message,
                  path: [index, "children"],
                  params: {
                    rule: "parser-error",
                    parser: "latex",
                    code: "latex-parse-error",
                  },
                });
              }
            }
          }
        }
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

      if (node.type === "image_block") {
        const src = typeof (node as any).src === "string" ? (node as any).src : "";
        const trimmed = src.trim();
        const isWebp =
          /\.webp(\?.*)?$/i.test(trimmed) ||
          /^data:image\/webp/i.test(trimmed);
        if (!src.trim()) {
          warn("Image block is missing a source URL.", [index, "src"], {
            rule: "image-src",
          });
        } else if (!isWebp) {
          ctx.addIssue({
            code: ZodIssueCode.custom,
            message:
              "Image source must be a .webp URL for now. Other formats will be auto-converted after the Next.js migration.",
            path: [index, "src"],
            params: { rule: "image-webp-only" },
          });
        }
        return;
      }

      if (node.type === "procedure_block") {
        const code = typeof (node as any).code === "string" ? (node as any).code : "";
        if (!code.trim()) {
          ctx.addIssue({
            code: ZodIssueCode.custom,
            message: "Procedure block is empty.",
            path: [index, "code"],
            params: {
              rule: "parser-error",
              parser: "procedure",
              code: "procedure-empty",
            },
          });
          return;
        }
        const firstLine = code
          .split(/\r?\n/)
          .map((line) => line.trim())
          .find((line) => line.length > 0 && !line.startsWith("#") && !line.startsWith("//"));
        if (firstLine && !/^(procedure|function)\b/i.test(firstLine)) {
          ctx.addIssue({
            code: ZodIssueCode.custom,
            message: "Procedure block should start with `procedure` or `function`.",
            path: [index, "code"],
            params: {
              rule: "parser-error",
              parser: "procedure",
              code: "procedure-missing-header",
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
          if (n.type === "citation_inline") {
            const attributionRef =
              typeof n.attribution_ref === "string" ? n.attribution_ref : "";
            if (!attributionRef.trim()) {
              warn("Citation is missing an attribution.", [...path, "attribution_ref"], {
                rule: "citation-attribution",
              });
            } else if (!hasAttribution(attributionRef)) {
              warn("Citation attribution was not found in the registry.", [...path, "attribution_ref"], {
                rule: "citation-attribution-missing",
              });
            }
            return;
          }

          if (n.type === "term_inline") {
            const termRef = typeof n.term_ref === "string" ? n.term_ref : "";
            if (!termRef.trim()) {
              warn("Term link is missing a term reference.", [...path, "term_ref"], {
                rule: "term-ref",
              });
            } else if (!hasTerm(termRef)) {
              warn("Term reference was not found in the registry.", [...path, "term_ref"], {
                rule: "term-ref-missing",
              });
            } else {
              // No-op: term status is not a validation concern at this stage.
            }
          }

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
  options: ValidationOptions = {},
): ValidationResult {
  const parsers = options.parsers ?? defaultParsers;
  const schema = createDocumentSchema(parsers, options.registry);
  const result = schema.safeParse(value);
  if (result.success) {
    return { success: true, issues: [] };
  }
  const issues = result.error.issues.map((issue) => ({
    code: issue.code,
    message: issue.message,
    path: issue.path,
    params: issue.params,
    severity:
      issue.params && (issue.params as Record<string, unknown>).severity === "warning"
        ? "warning"
        : "error",
  }));
  const hasErrors = issues.some((issue) => issue.severity === "error");
  return {
    success: !hasErrors,
    issues,
  };
}

export function validateDocumentForMerge(
  value: Array<Record<string, unknown>>,
  options: ValidationOptions = {},
): ValidationResult {
  const result = validateDocument(value, options);
  const issues = result.issues.map((issue) => ({
    ...issue,
    severity: "error" as const,
  }));
  const hasErrors = issues.length > 0;
  return {
    success: !hasErrors,
    issues,
  };
}
