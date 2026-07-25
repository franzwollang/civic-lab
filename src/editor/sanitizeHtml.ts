import DOMPurify from "dompurify";

/** Sanitize Prism / HTML highlight output before dangerouslySetInnerHTML. */
export function sanitizePrismHtml(html: string): string {
  if (typeof window === "undefined") return html;
  try {
    return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
  } catch {
    return html;
  }
}

/** Sanitize SVG markup (Mermaid / MathJax) before dangerouslySetInnerHTML. */
export function sanitizeSvgHtml(html: string): string {
  if (typeof window === "undefined") return html;
  try {
    return DOMPurify.sanitize(html, {
      USE_PROFILES: { svg: true, svgFilters: true },
    });
  } catch {
    return html;
  }
}
