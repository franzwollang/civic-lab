import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import type { AttributionRegistry, TermRegistry } from "@/doc/evidence";
import { ELEMENT_TYPES } from "@/editor/model";
import { renderTexToSvgHtml, validateTexWithMathJax } from "@/editor/mathjax";
import { renderMermaidToSvgHtml, validateMermaidDiagram } from "@/editor/mermaid";
import { useMathJaxTick } from "@/editor/useMathJaxTick";
import { useMermaidTick } from "@/editor/useMermaidTick";
import { usePrismHighlight } from "@/editor/usePrism";
import { truncateForAria } from "@/editor/voidA11y";

export type ReaderNode = {
  type?: string;
  text?: string;
  id?: string;
  children?: ReaderNode[];
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  code?: boolean;
  [key: string]: unknown;
};

export type DocumentReaderProps = {
  value: ReaderNode[];
  attributions?: AttributionRegistry;
  terms?: TermRegistry;
  className?: string;
};

const emptyAttributions: AttributionRegistry = { version: 1, items: [] };
const emptyTerms: TermRegistry = { version: 1, items: [] };

const getAttributionLabel = (item: {
  title?: string;
  url?: string;
  id: string;
}) => {
  if (item.title && item.title.trim()) return item.title;
  if (item.url && item.url.trim()) return item.url;
  return item.id;
};

const getTermLabel = (item: { canonical_label_en?: string; id: string }) => {
  if (item.canonical_label_en && item.canonical_label_en.trim()) {
    return item.canonical_label_en;
  }
  return item.id;
};

function isTextNode(node: ReaderNode): boolean {
  return typeof node.text === "string";
}

function renderLeafText(node: ReaderNode, key: string): ReactNode {
  let next: ReactNode = node.text ?? "";
  if (node.bold) next = <strong>{next}</strong>;
  if (node.italic) next = <em>{next}</em>;
  if (node.underline) next = <u>{next}</u>;
  if (node.code) {
    next = (
      <code className="rounded bg-neutral-100 px-1 py-0.5 text-[0.85em]">
        {next}
      </code>
    );
  }
  return <span key={key}>{next}</span>;
}

function MathInlineRead({ latex }: { latex: string }) {
  const mathjaxTick = useMathJaxTick();
  const hasLatex = latex.trim().length > 0;
  const validation = hasLatex
    ? validateTexWithMathJax(latex, false)
    : ({ ok: false as const, message: "Empty inline math." } as const);
  // Re-render when MathJax finishes async load (tick updates).
  const svgHtml = useMemo(
    () => (hasLatex ? renderTexToSvgHtml(latex, false) : null),
    [hasLatex, latex, mathjaxTick],
  );

  return (
    <span
      role="img"
      aria-label={`Inline math: ${truncateForAria(latex || "empty")}`}
      className="inline-flex items-baseline whitespace-nowrap rounded bg-neutral-50 px-1"
    >
      {svgHtml ? (
        <span dangerouslySetInnerHTML={{ __html: svgHtml }} />
      ) : (
        <span
          className={
            !validation.ok
              ? validation.message === "Validating LaTeX..."
                ? "rounded bg-neutral-100 px-1 text-xs text-neutral-500"
                : "rounded bg-red-50 px-1 text-xs text-red-700"
              : "text-xs text-neutral-600"
          }
        >
          {`$${latex}$`}
        </span>
      )}
    </span>
  );
}

function MathBlockRead({
  latex,
  embedded = false,
}: {
  latex: string;
  embedded?: boolean;
}) {
  const mathjaxTick = useMathJaxTick();
  const renderRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const hasLatex = latex.trim().length > 0;
  const validation = hasLatex
    ? validateTexWithMathJax(latex, true)
    : ({ ok: false as const, message: "Empty math block." } as const);

  useLayoutEffect(() => {
    const el = renderRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const svgHtml = useMemo(() => {
    if (!hasLatex) return null;
    return renderTexToSvgHtml(latex, true, containerWidth ?? undefined);
  }, [containerWidth, hasLatex, latex, mathjaxTick]);

  return (
    <div
      className={
        embedded
          ? "relative rounded border border-neutral-200 bg-neutral-50 px-3 py-2"
          : "relative my-3 rounded border border-neutral-200 bg-neutral-50 px-3 py-2"
      }
      role="img"
      aria-label={`Math expression: ${truncateForAria(latex.trim() || "empty")}`}
    >
      <div className="absolute right-2 top-2 rounded bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-700">
        Math
      </div>
      <div ref={renderRef} className="overflow-x-auto text-center">
        {svgHtml ? (
          <div dangerouslySetInnerHTML={{ __html: svgHtml }} />
        ) : (
          <div
            className={
              !validation.ok
                ? validation.message === "Validating LaTeX..."
                  ? "rounded bg-neutral-100 px-2 py-1 text-xs text-neutral-500"
                  : "rounded bg-red-50 px-2 py-1 text-xs text-red-700"
                : "rounded bg-neutral-100 px-2 py-1 text-xs text-neutral-600"
            }
          >
            {`$$\n${latex}\n$$`}
          </div>
        )}
      </div>
    </div>
  );
}

function MermaidBlockRead({ code }: { code: string }) {
  const mermaidTick = useMermaidTick();
  const validation = validateMermaidDiagram(code);
  const svgHtml = useMemo(
    () => (validation.ok ? renderMermaidToSvgHtml(code) : null),
    [code, mermaidTick, validation.ok],
  );
  const highlighted = usePrismHighlight({ language: "mermaid", code });

  return (
    <div
      className="my-3 rounded border border-neutral-200 bg-neutral-50 px-3 py-2"
      role="img"
      aria-label={`Mermaid diagram: ${truncateForAria(code || "empty")}`}
    >
      <div className="flex items-center text-xs text-neutral-600">
        <span className="inline-flex items-center gap-1 rounded bg-neutral-100 px-2 py-0.5">
          <span className="text-[11px] font-semibold text-neutral-700">
            Diagram
          </span>
          <span className="text-[10px] font-medium text-neutral-500">
            Mermaid
          </span>
        </span>
      </div>
      <div className="mt-2 rounded border border-neutral-200 bg-white p-2 text-[11px] text-neutral-600">
        {svgHtml ? (
          <div dangerouslySetInnerHTML={{ __html: svgHtml }} />
        ) : (
          <pre className="code-prism mt-0 whitespace-pre-wrap break-words font-mono text-[11px] text-neutral-700">
            <code
              className="language-mermaid"
              dangerouslySetInnerHTML={{ __html: highlighted.html }}
            />
          </pre>
        )}
      </div>
    </div>
  );
}

function ProcedureBlockRead({
  code,
  dialect,
}: {
  code: string;
  dialect: string;
}) {
  const highlightLanguage = "pseudocode";
  const highlighted = usePrismHighlight({
    language: highlightLanguage,
    code,
  });
  const trimmed = code.trim();
  const hasHeader =
    /^procedure\b/i.test(trimmed) || /^function\b/i.test(trimmed);

  return (
    <div
      className="my-3 rounded border border-neutral-200 bg-neutral-50 px-3 py-2"
      aria-label={`Procedure: ${truncateForAria(code || "empty")}`}
    >
      <div className="flex items-center text-xs text-neutral-600">
        <span className="inline-flex items-center gap-1 rounded bg-neutral-100 px-2 py-0.5">
          <span className="text-[11px] font-semibold text-neutral-700">
            Procedure
          </span>
          <span className="text-[10px] font-medium text-neutral-500">
            {dialect}
          </span>
        </span>
      </div>
      <div className="mt-2 rounded border border-neutral-200 bg-white p-2">
        {!hasHeader ? (
          <div className="mb-2 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
            Start with <span className="font-semibold">procedure</span> or{" "}
            <span className="font-semibold">function</span>.
          </div>
        ) : null}
        <pre
          className={`code-prism language-${highlightLanguage} whitespace-pre-wrap break-words font-mono text-[11px] text-neutral-800`}
        >
          <code
            className={`language-${highlightLanguage}`}
            dangerouslySetInnerHTML={{ __html: highlighted.html }}
          />
        </pre>
      </div>
    </div>
  );
}

function DataBlockRead({
  code,
  language,
  caption,
  embedded = false,
}: {
  code: string;
  language: string;
  caption?: string;
  embedded?: boolean;
}) {
  const highlighted = usePrismHighlight({ language, code });

  return (
    <div
      className={
        embedded
          ? "rounded border border-neutral-200 bg-neutral-50 px-3 py-2"
          : "my-3 rounded border border-neutral-200 bg-neutral-50 px-3 py-2"
      }
      aria-label={`Data (${language}): ${truncateForAria(code || "empty")}`}
    >
      <div className="flex items-center text-xs text-neutral-600">
        <span className="inline-flex items-center gap-1 rounded bg-neutral-100 px-2 py-0.5">
          <span className="text-[11px] font-semibold text-neutral-700">Data</span>
          <span className="text-[10px] font-medium text-neutral-500">
            {language}
          </span>
        </span>
      </div>
      <div className="mt-2 rounded border border-neutral-200 bg-white p-2">
        <pre
          className={`code-prism language-${language} whitespace-pre-wrap break-words font-mono text-[11px] text-neutral-800`}
        >
          <code
            className={`language-${language}`}
            dangerouslySetInnerHTML={{ __html: highlighted.html }}
          />
        </pre>
      </div>
      {caption ? (
        <div className="mt-2 text-[11px] text-neutral-600">{caption}</div>
      ) : null}
    </div>
  );
}

function ImageBlockRead({
  src,
  alt,
  caption,
}: {
  src: string;
  alt?: string;
  caption?: string;
}) {
  return (
    <figure
      className="my-3 rounded border border-neutral-200 bg-neutral-50 px-3 py-2"
      aria-label={alt || caption || "Image"}
    >
      <div className="flex items-center text-xs text-neutral-600">
        <span className="inline-flex items-center gap-1 rounded bg-neutral-100 px-2 py-0.5">
          <span className="text-[11px] font-semibold text-neutral-700">
            Image
          </span>
        </span>
      </div>
      <div className="mt-2 rounded border border-neutral-200 bg-white p-2">
        {src ? (
          <img
            src={src}
            alt={alt || ""}
            className="max-h-[320px] w-auto max-w-full rounded"
          />
        ) : (
          <div className="text-[11px] text-neutral-500">Image URL missing.</div>
        )}
        {caption ? (
          <figcaption className="mt-2 text-[11px] text-neutral-600">
            {caption}
          </figcaption>
        ) : null}
      </div>
    </figure>
  );
}

function ExternalArtifactRead({
  provider,
  generalId,
  specificId,
  displayTitle,
  summary,
  license,
}: {
  provider: string;
  generalId: string;
  specificId: string;
  displayTitle: string;
  summary?: string;
  license?: string;
}) {
  const incomplete = !provider || !generalId || !specificId || !displayTitle;
  return (
    <aside
      className={
        "my-3 rounded border bg-neutral-50 px-3 py-2 " +
        (incomplete ? "border-amber-200" : "border-neutral-200")
      }
      aria-label={displayTitle || "External artifact"}
    >
      <div className="flex items-center text-xs text-neutral-600">
        <span className="inline-flex items-center gap-1 rounded bg-neutral-100 px-2 py-0.5">
          <span className="text-[11px] font-semibold text-neutral-700">
            External artifact
          </span>
        </span>
      </div>
      <div className="mt-2 space-y-1">
        <div className="text-[13px] font-medium text-neutral-900">
          {displayTitle || "Untitled external artifact"}
        </div>
        <div className="text-[11px] text-neutral-600">
          {[provider || "provider?", generalId || "general_id?", specificId || "specific_id?"].join(
            " · ",
          )}
        </div>
        {summary ? (
          <div className="text-[11px] text-neutral-500">{summary}</div>
        ) : null}
        {license ? (
          <div className="text-[10px] uppercase tracking-wide text-neutral-400">
            {license}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function CitationRead({
  attributionRef,
  attributions,
  locator,
  note,
}: {
  attributionRef: string;
  attributions: AttributionRegistry;
  locator?: { kind?: string; value?: string };
  note?: string;
}) {
  const item = attributionRef
    ? attributions.items.find((a) => a.id === attributionRef)
    : undefined;
  const label = item
    ? getAttributionLabel(item)
    : attributionRef
      ? attributionRef
      : "Missing source";
  const titleParts = [label];
  if (item?.immutable_ref) {
    titleParts.push(`immutable: ${item.immutable_ref}`);
  }
  if (locator?.kind && locator?.value) {
    titleParts.push(`${locator.kind}: ${locator.value}`);
  }
  if (note) titleParts.push(note);

  return (
    <span
      role="note"
      aria-label={`Citation: ${truncateForAria(label)}`}
      title={titleParts.join(" · ")}
      className={
        "mx-0.5 inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide " +
        (attributionRef
          ? "border-neutral-200 bg-neutral-100 text-neutral-700"
          : "border-red-200 bg-red-50 text-red-700")
      }
    >
      [S]
    </span>
  );
}

function TermRead({
  termRef,
  terms,
  children,
}: {
  termRef: string;
  terms: TermRegistry;
  children: ReactNode;
}) {
  const term = termRef
    ? terms.items.find((item) => item.id === termRef)
    : undefined;
  const label = term
    ? getTermLabel(term)
    : termRef
      ? termRef
      : "Missing term";
  const title = term?.definition_en
    ? `${label} — ${term.definition_en}`
    : label;

  return (
    <span
      title={title}
      className={
        "rounded px-1 py-0.5 text-[0.95em] underline decoration-dotted " +
        (termRef
          ? "decoration-neutral-400"
          : "decoration-red-500 text-red-700")
      }
    >
      {children}
    </span>
  );
}

type RenderCtx = {
  attributions: AttributionRegistry;
  terms: TermRegistry;
  /** Parent evidence block kind, when rendering nested evidence children. */
  evidenceKind?: string;
  evidenceLang?: string;
};

function renderNodes(nodes: ReaderNode[], ctx: RenderCtx): ReactNode[] {
  return nodes.map((node, index) => {
    const key = (typeof node.id === "string" && node.id) || `node-${index}`;
    if (isTextNode(node)) {
      return renderLeafText(node, key);
    }

    const children = Array.isArray(node.children)
      ? renderNodes(node.children, ctx)
      : null;
    const type = typeof node.type === "string" ? node.type : "";

    switch (type) {
      case ELEMENT_TYPES.H2:
      case "h1":
        return (
          <h2
            key={key}
            id={typeof node.id === "string" ? node.id : undefined}
            className="mb-3 text-2xl font-semibold text-neutral-900"
          >
            {children}
          </h2>
        );
      case ELEMENT_TYPES.H3:
        return (
          <h3
            key={key}
            id={typeof node.id === "string" ? node.id : undefined}
            className="mb-2 text-lg font-semibold text-neutral-900"
          >
            {children}
          </h3>
        );
      case ELEMENT_TYPES.H4:
        return (
          <h4
            key={key}
            id={typeof node.id === "string" ? node.id : undefined}
            className="mb-2 text-base font-semibold text-neutral-900"
          >
            {children}
          </h4>
        );
      case ELEMENT_TYPES.MATH_INLINE:
        return (
          <MathInlineRead
            key={key}
            latex={typeof node.latex === "string" ? node.latex : ""}
          />
        );
      case ELEMENT_TYPES.MATH_BLOCK:
      case ELEMENT_TYPES.EVIDENCE_BLOCK_MATH:
        return (
          <MathBlockRead
            key={key}
            latex={typeof node.latex === "string" ? node.latex : ""}
            embedded={type === ELEMENT_TYPES.EVIDENCE_BLOCK_MATH}
          />
        );
      case ELEMENT_TYPES.MERMAID_BLOCK:
        return (
          <MermaidBlockRead
            key={key}
            code={typeof node.code === "string" ? node.code : ""}
          />
        );
      case ELEMENT_TYPES.PROCEDURE_BLOCK:
        return (
          <ProcedureBlockRead
            key={key}
            code={typeof node.code === "string" ? node.code : ""}
            dialect={
              typeof node.dialect === "string" ? node.dialect : "pseudocode.js"
            }
          />
        );
      case ELEMENT_TYPES.DATA_BLOCK:
      case ELEMENT_TYPES.EVIDENCE_BLOCK_DATA:
        return (
          <DataBlockRead
            key={key}
            code={typeof node.code === "string" ? node.code : ""}
            language={
              typeof node.language === "string" ? node.language : "json"
            }
            caption={
              typeof node.caption === "string" ? node.caption : undefined
            }
            embedded={type === ELEMENT_TYPES.EVIDENCE_BLOCK_DATA}
          />
        );
      case ELEMENT_TYPES.IMAGE_BLOCK:
        return (
          <ImageBlockRead
            key={key}
            src={typeof node.src === "string" ? node.src : ""}
            alt={typeof node.alt === "string" ? node.alt : undefined}
            caption={
              typeof node.caption === "string" ? node.caption : undefined
            }
          />
        );
      case ELEMENT_TYPES.EXTERNAL_ARTIFACT:
        return (
          <ExternalArtifactRead
            key={key}
            provider={typeof node.provider === "string" ? node.provider : ""}
            generalId={
              typeof node.general_id === "string" ? node.general_id : ""
            }
            specificId={
              typeof node.specific_id === "string" ? node.specific_id : ""
            }
            displayTitle={
              typeof node.display_title === "string" ? node.display_title : ""
            }
            summary={
              typeof node.summary === "string" ? node.summary : undefined
            }
            license={
              typeof node.license === "string" ? node.license : undefined
            }
          />
        );
      case ELEMENT_TYPES.CITATION_INLINE: {
        const locator =
          node.locator && typeof node.locator === "object"
            ? (node.locator as { kind?: string; value?: string })
            : undefined;
        return (
          <CitationRead
            key={key}
            attributionRef={
              typeof node.attribution_ref === "string"
                ? node.attribution_ref
                : ""
            }
            attributions={ctx.attributions}
            locator={locator}
            note={typeof node.note === "string" ? node.note : undefined}
          />
        );
      }
      case ELEMENT_TYPES.TERM_INLINE:
        return (
          <TermRead
            key={key}
            termRef={typeof node.term_ref === "string" ? node.term_ref : ""}
            terms={ctx.terms}
          >
            {children}
          </TermRead>
        );
      case ELEMENT_TYPES.LINK: {
        const url = typeof node.url === "string" ? node.url : "";
        const target =
          typeof node.target === "string" ? node.target : undefined;
        return (
          <a
            key={key}
            href={url || undefined}
            target={target}
            rel={target === "_blank" ? "noopener noreferrer" : undefined}
            className="font-medium text-sky-800 underline underline-offset-2"
          >
            {children}
          </a>
        );
      }
      case ELEMENT_TYPES.EVIDENCE_BLOCK: {
        const kind =
          node.kind === "data" || node.kind === "math" ? node.kind : "text";
        const lang =
          typeof node.lang === "string" && node.lang.trim()
            ? node.lang
            : "en";
        const attributionRef =
          typeof node.attribution_ref === "string"
            ? node.attribution_ref
            : "";
        const item = attributionRef
          ? ctx.attributions.items.find((a) => a.id === attributionRef)
          : undefined;
        const attributionLabel = item
          ? getAttributionLabel(item)
          : attributionRef || "None";
        const missingAttribution = !attributionRef || !item;
        const locator =
          node.locator && typeof node.locator === "object"
            ? (node.locator as { kind?: string; value?: string })
            : undefined;
        const locatorKind = locator?.kind ?? "page";
        const locatorValue = locator?.value ?? "";
        const nestedCtx: RenderCtx = {
          ...ctx,
          evidenceKind: kind,
          evidenceLang: lang,
        };
        return (
          <aside
            key={key}
            className="my-4 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3"
            aria-label="Evidence block"
          >
            <div className="inline-flex flex-wrap items-center gap-2 rounded-md bg-neutral-100 px-2 py-1.5 text-[11px] text-neutral-700">
              {kind === "text" ? (
                <>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                    Lang
                  </span>
                  <span className="text-[11px] font-semibold text-neutral-900">
                    {lang}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                    Kind
                  </span>
                  <span className="text-[11px] font-semibold text-neutral-900">
                    {kind}
                  </span>
                </>
              )}
              <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                Source
              </span>
              <span
                className={
                  "max-w-[220px] truncate text-[11px] font-semibold " +
                  (missingAttribution ? "text-red-700" : "text-neutral-700")
                }
                title={missingAttribution ? "Missing source" : attributionLabel}
              >
                {missingAttribution ? "None" : attributionLabel}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                Locator
              </span>
              <span className="text-[11px] font-semibold text-neutral-900">
                {locatorValue ? `${locatorKind} ${locatorValue}` : "—"}
              </span>
            </div>
            <div className="mt-3 space-y-3">
              {Array.isArray(node.children)
                ? renderNodes(node.children, nestedCtx)
                : null}
            </div>
          </aside>
        );
      }
      case ELEMENT_TYPES.EVIDENCE_BLOCK_TEXT: {
        if (ctx.evidenceKind && ctx.evidenceKind !== "text") return null;
        return (
          <blockquote
            key={key}
            className="border-l-2 border-neutral-300 pl-3 text-sm text-neutral-800"
          >
            {children}
          </blockquote>
        );
      }
      case ELEMENT_TYPES.EVIDENCE_BLOCK_TRANSLATION: {
        const kind = ctx.evidenceKind ?? "text";
        const lang = ctx.evidenceLang ?? "en";
        const needsTranslation = kind === "text" && lang.trim() !== "en";
        if (!needsTranslation) return null;
        const text = collectText(node).trim();
        const isEmpty = text.length === 0;
        return (
          <div
            key={key}
            className={
              "rounded border px-3 py-2 text-sm " +
              (isEmpty
                ? "border-red-200 bg-red-50/40"
                : "border-neutral-200 bg-white")
            }
          >
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
              English Translation
            </div>
            <div className="min-h-[1.5rem] text-sm text-neutral-800">
              {children}
            </div>
            {isEmpty ? (
              <div className="mt-1 text-[10px] font-medium text-red-600">
                Translation required for non-English evidence blocks.
              </div>
            ) : null}
          </div>
        );
      }
      case ELEMENT_TYPES.BLOCKQUOTE:
        return (
          <blockquote
            key={key}
            className="mb-4 border-l-2 border-neutral-300 pl-4 text-sm italic leading-7 text-neutral-600"
          >
            {children}
          </blockquote>
        );
      case ELEMENT_TYPES.TABLE:
        return (
          <div key={key} className="mb-4 w-full overflow-x-auto">
            <table className="w-full border-collapse border border-neutral-300 text-sm">
              <tbody className="[&>tr]:border-b [&>tr]:border-neutral-200">
                {children}
              </tbody>
            </table>
          </div>
        );
      case ELEMENT_TYPES.TABLE_ROW:
        return (
          <tr key={key} className="border-b border-neutral-200">
            {children}
          </tr>
        );
      case ELEMENT_TYPES.TABLE_CELL_HEADER:
        return (
          <th
            key={key}
            className="border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-left align-top text-sm font-semibold leading-6 text-neutral-900"
          >
            {children}
          </th>
        );
      case ELEMENT_TYPES.TABLE_CELL:
        return (
          <td
            key={key}
            className="border border-neutral-200 px-2 py-1.5 align-top text-sm leading-6 text-neutral-700"
          >
            {children}
          </td>
        );
      case ELEMENT_TYPES.PARAGRAPH: {
        const listStyleType =
          typeof node.listStyleType === "string" ? node.listStyleType : null;
        if (listStyleType) {
          const indent =
            typeof node.indent === "number" && node.indent > 0
              ? node.indent
              : 1;
          return (
            <div
              key={key}
              className="mb-1 list-item text-sm leading-7 text-neutral-700"
              style={{
                listStyleType,
                marginLeft: `${indent * 1.25}rem`,
              }}
            >
              {children}
            </div>
          );
        }
        return (
          <p key={key} className="mb-4 text-sm leading-7 text-neutral-700">
            {children}
          </p>
        );
      }
      default:
        return (
          <p key={key} className="mb-4 text-sm leading-7 text-neutral-700">
            {children}
          </p>
        );
    }
  });
}

function collectText(node: ReaderNode): string {
  if (typeof node.text === "string") return node.text;
  if (!Array.isArray(node.children)) return "";
  return node.children.map(collectText).join("");
}

/**
 * Read-only renderer for editor document JSON (Plate/Slate nodes).
 * Shared by `/test/preview` and future artifact readers.
 */
export function DocumentReader({
  value,
  attributions = emptyAttributions,
  terms = emptyTerms,
  className,
}: DocumentReaderProps) {
  // Kick async MathJax / Mermaid loaders so first paint can refresh after load.
  useEffect(() => {
    void import("@/editor/mathjax").then((m) => {
      void m.ensureMathJaxLoaded();
    });
    void import("@/editor/mermaid").then((m) => {
      void m.ensureMermaidLoaded();
    });
  }, []);

  const ctx: RenderCtx = useMemo(
    () => ({ attributions, terms }),
    [attributions, terms],
  );

  return (
    <div className={className ?? "document-reader prose-neutral max-w-none"}>
      {renderNodes(Array.isArray(value) ? value : [], ctx)}
    </div>
  );
}

/** Node types the reader is expected to handle (acceptance checklist). */
export const DOCUMENT_READER_NODE_TYPES = [
  ELEMENT_TYPES.PARAGRAPH,
  ELEMENT_TYPES.H2,
  ELEMENT_TYPES.H3,
  ELEMENT_TYPES.H4,
  ELEMENT_TYPES.BLOCKQUOTE,
  ELEMENT_TYPES.TABLE,
  ELEMENT_TYPES.TABLE_ROW,
  ELEMENT_TYPES.TABLE_CELL,
  ELEMENT_TYPES.TABLE_CELL_HEADER,
  ELEMENT_TYPES.MATH_INLINE,
  ELEMENT_TYPES.MATH_BLOCK,
  ELEMENT_TYPES.MERMAID_BLOCK,
  ELEMENT_TYPES.PROCEDURE_BLOCK,
  ELEMENT_TYPES.DATA_BLOCK,
  ELEMENT_TYPES.IMAGE_BLOCK,
  ELEMENT_TYPES.EXTERNAL_ARTIFACT,
  ELEMENT_TYPES.EVIDENCE_BLOCK,
  ELEMENT_TYPES.EVIDENCE_BLOCK_TEXT,
  ELEMENT_TYPES.EVIDENCE_BLOCK_TRANSLATION,
  ELEMENT_TYPES.EVIDENCE_BLOCK_DATA,
  ELEMENT_TYPES.EVIDENCE_BLOCK_MATH,
  ELEMENT_TYPES.CITATION_INLINE,
  ELEMENT_TYPES.TERM_INLINE,
  ELEMENT_TYPES.LINK,
] as const;
