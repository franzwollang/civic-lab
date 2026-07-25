/**
 * Node-safe document structure checks (no MathJax/Mermaid DOM).
 * Used by the server save path; browser `validateDocument` still owns
 * render-based TeX/diagram parsing.
 */
import { z, ZodIssueCode } from "zod";
import { parse as parseYaml } from "yaml";
import { load as parseToml } from "js-toml";
import { parse as parseCsv } from "csv-parse/sync";
import {
  isExternalArtifactEmpty,
  validateExternalArtifact,
} from "../lib/externalArtifact";

type SlateBlock = Record<string, unknown> & { type?: string; id?: string };

export type StructuralIssue = {
  code: string;
  message: string;
  path: Array<string | number>;
  params?: Record<string, unknown>;
  severity: "error" | "warning";
};

export type StructuralValidationResult = {
  success: boolean;
  issues: StructuralIssue[];
};

export type StructuralValidationRegistry = {
  attributions?: Set<string>;
  terms?: Map<string, { status?: string }>;
};

export type StructuralValidationOptions = {
  registry?: StructuralValidationRegistry;
};

type TextParserResult =
  | { ok: true }
  | { ok: false; message: string; code?: string };

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

const createStructuralSchema = (registry?: StructuralValidationRegistry) =>
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

    const warn = (
      message: string,
      path: Array<string | number>,
      params?: Record<string, unknown>,
    ) => {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message,
        path,
        params: { ...(params ?? {}), severity: "warning" },
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
          typeof (node as { language?: unknown }).language === "string"
            ? (node as { language: string }).language
            : "json";
        const code =
          typeof (node as { code?: unknown }).code === "string"
            ? (node as { code: string }).code
            : "";
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
        const kind =
          typeof (node as { kind?: unknown }).kind === "string"
            ? (node as { kind: string }).kind
            : "text";
        const lang =
          typeof (node as { lang?: unknown }).lang === "string"
            ? (node as { lang: string }).lang
            : "";
        const attributionRef =
          typeof (node as { attribution_ref?: unknown }).attribution_ref ===
          "string"
            ? (node as { attribution_ref: string }).attribution_ref
            : "";
        const children = Array.isArray((node as { children?: unknown }).children)
          ? ((node as { children: unknown[] }).children)
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
          warn(
            "Evidence block is missing an attribution.",
            [index, "attribution_ref"],
            { rule: "evidence-attribution" },
          );
        } else if (!hasAttribution(attributionRef)) {
          warn(
            "Evidence block attribution was not found in the registry.",
            [index, "attribution_ref"],
            { rule: "evidence-attribution-missing" },
          );
        }

        if (
          kind === "text" &&
          lang.trim() &&
          lang.trim() !== "en" &&
          !translationText
        ) {
          warn(
            "Non-English evidence blocks require an English translation.",
            [index, "children"],
            { rule: "evidence-translation" },
          );
        }

        if (kind === "data") {
          if (!dataChild) {
            warn("Evidence block is missing a data excerpt.", [index, "children"], {
              rule: "evidence-data-missing",
            });
          } else if (
            typeof dataChild.code !== "string" ||
            !dataChild.code.trim()
          ) {
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
            const tex =
              typeof mathChild.latex === "string" ? mathChild.latex : "";
            if (!tex.trim()) {
              warn("Evidence math excerpt is empty.", [index, "children"], {
                rule: "evidence-math-empty",
              });
            }
          }
        }
      }

      if (node.type === "mermaid_block") {
        const code =
          typeof (node as { code?: unknown }).code === "string"
            ? (node as { code: string }).code
            : "";
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
        }
        return;
      }

      if (node.type === "image_block") {
        const src =
          typeof (node as { src?: unknown }).src === "string"
            ? (node as { src: string }).src
            : "";
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

      if (node.type === "external_artifact") {
        const fields = {
          provider:
            typeof (node as { provider?: unknown }).provider === "string"
              ? (node as { provider: string }).provider
              : "",
          general_id:
            typeof (node as { general_id?: unknown }).general_id === "string"
              ? (node as { general_id: string }).general_id
              : "",
          specific_id:
            typeof (node as { specific_id?: unknown }).specific_id === "string"
              ? (node as { specific_id: string }).specific_id
              : "",
          display_title:
            typeof (node as { display_title?: unknown }).display_title ===
            "string"
              ? (node as { display_title: string }).display_title
              : "",
          summary:
            typeof (node as { summary?: unknown }).summary === "string"
              ? (node as { summary: string }).summary
              : "",
          license:
            typeof (node as { license?: unknown }).license === "string"
              ? (node as { license: string }).license
              : "",
        };
        if (isExternalArtifactEmpty(fields)) {
          warn(
            "External artifact is missing provider, general_id, specific_id, and display_title.",
            [index, "provider"],
            { rule: "external-artifact-empty" },
          );
          return;
        }
        const result = validateExternalArtifact(fields);
        if (!result.ok) {
          const field = result.field ?? "provider";
          const incomplete =
            field === "provider" ||
            field === "general_id" ||
            field === "specific_id" ||
            field === "display_title"
              ? !String(fields[field] ?? "").trim()
              : false;
          if (incomplete) {
            warn(result.message, [index, field], {
              rule: "external-artifact-incomplete",
            });
          } else {
            ctx.addIssue({
              code: ZodIssueCode.custom,
              message: result.message,
              path: [index, field],
              params: { rule: "external-artifact-invalid", field },
            });
          }
        }
        return;
      }

      if (node.type === "procedure_block") {
        const code =
          typeof (node as { code?: unknown }).code === "string"
            ? (node as { code: string }).code
            : "";
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
          .find(
            (line) =>
              line.length > 0 &&
              !line.startsWith("#") &&
              !line.startsWith("//"),
          );
        if (firstLine && !/^(procedure|function)\b/i.test(firstLine)) {
          ctx.addIssue({
            code: ZodIssueCode.custom,
            message:
              "Procedure block should start with `procedure` or `function`.",
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

      if (node.type === "math_block") {
        const next = (
          typeof (node as { latex?: unknown }).latex === "string"
            ? (node as { latex: string }).latex
            : ""
        ).trim();
        if (!next) {
          ctx.addIssue({
            code: ZodIssueCode.custom,
            message: "Math block is empty.",
            path: [index, "latex"],
            params: {
              rule: "parser-error",
              parser: "latex",
              code: "latex-empty-math",
            },
          });
        }
        return;
      }

      const visit = (n: Record<string, unknown>, path: Array<string | number>) => {
        if (!n || typeof n !== "object") return;

        if (n.type === "citation_inline") {
          const attributionRef =
            typeof n.attribution_ref === "string" ? n.attribution_ref : "";
          if (!attributionRef.trim()) {
            warn("Citation is missing an attribution.", [...path, "attribution_ref"], {
              rule: "citation-attribution",
            });
          } else if (!hasAttribution(attributionRef)) {
            warn(
              "Citation attribution was not found in the registry.",
              [...path, "attribution_ref"],
              { rule: "citation-attribution-missing" },
            );
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
          }
          return;
        }

        if (Array.isArray(n.children)) {
          n.children.forEach((child: unknown, childIndex: number) => {
            if (child && typeof child === "object") {
              visit(child as Record<string, unknown>, [
                ...path,
                "children",
                childIndex,
              ]);
            }
          });
        }
      };

      visit(node as Record<string, unknown>, [index]);
    });
  });

/**
 * Validate Slate document shape + structural rules (headings, empty voids,
 * procedure header, webp images, data parse). Does not run MathJax/Mermaid.
 */
export function validateDocumentStructure(
  value: unknown,
  options: StructuralValidationOptions = {},
): StructuralValidationResult {
  if (!Array.isArray(value)) {
    return {
      success: false,
      issues: [
        {
          code: "invalid_type",
          message: "content_json must be an array of document nodes",
          path: [],
          params: { rule: "content-json-array" },
          severity: "error",
        },
      ],
    };
  }

  const schema = createStructuralSchema(options.registry);
  const result = schema.safeParse(value);
  if (result.success) {
    return { success: true, issues: [] };
  }

  const issues: StructuralIssue[] = result.error.issues.map((issue) => ({
    code: String(issue.code),
    message: issue.message,
    path: issue.path as Array<string | number>,
    params: issue.params as Record<string, unknown> | undefined,
    severity:
      issue.params &&
      (issue.params as Record<string, unknown>).severity === "warning"
        ? ("warning" as const)
        : ("error" as const),
  }));

  const hasErrors = issues.some((issue) => issue.severity === "error");
  return {
    success: !hasErrors,
    issues,
  };
}

/**
 * Merge/proposal path: treat every structural issue (including warnings) as
 * an error. Mirrors client `validateDocumentForMerge` without MathJax/Mermaid.
 */
export function validateDocumentStructureForMerge(
  value: unknown,
  options: StructuralValidationOptions = {},
): StructuralValidationResult {
  const result = validateDocumentStructure(value, options);
  const issues = result.issues.map((issue) => ({
    ...issue,
    severity: "error" as const,
  }));
  return {
    success: issues.length === 0,
    issues,
  };
}
