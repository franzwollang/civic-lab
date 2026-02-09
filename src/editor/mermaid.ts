import DOMPurify from "dompurify";

type MermaidApi = {
  initialize?: (config: Record<string, unknown>) => void;
  parse?: (code: string, options?: Record<string, unknown>) => unknown;
  render?: (
    id: string,
    code: string,
    container?: Element | null,
  ) => Promise<{ svg: string } | string> | { svg: string } | string;
};

type StatusOk<T> = { status: "ok"; value: T };
type StatusPending = { status: "pending" };
type StatusError = { status: "error"; message: string };
type Status<T> = StatusOk<T> | StatusPending | StatusError;

const listeners = new Set<() => void>();
const renderCache = new Map<string, Status<string>>();
const validateCache = new Map<string, Status<true>>();

let loadPromise: Promise<MermaidApi | null> | null = null;
let initialized = false;
let renderCounter = 0;

const notify = () => {
  listeners.forEach((fn) => fn());
};

export function subscribeMermaidUpdates(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const sanitizeSvg = (html: string) => {
  if (typeof window === "undefined") return html;
  try {
    return DOMPurify.sanitize(html, {
      USE_PROFILES: { svg: true, svgFilters: true },
    });
  } catch {
    return html;
  }
};

export async function ensureMermaidLoaded(): Promise<MermaidApi | null> {
  if (typeof document === "undefined") return null;
  if (loadPromise) return loadPromise;

  loadPromise = import("mermaid")
    .then((mod: any) => mod?.default ?? mod)
    .then((api: MermaidApi | null) => {
      if (!api) return null;
      if (!initialized) {
        try {
          api.initialize?.({
            startOnLoad: false,
            securityLevel: "strict",
            theme: "neutral",
          });
        } catch {
          // ignore
        }
        initialized = true;
      }
      return api;
    })
    .catch(() => null);

  return loadPromise;
}

type ValidationResult = { ok: true } | { ok: false; message: string };

export function validateMermaidDiagram(code: string): ValidationResult {
  const key = code;
  const cached = validateCache.get(key);
  if (cached?.status === "ok") return { ok: true };
  if (cached?.status === "pending")
    return { ok: false, message: "Validating diagram..." };
  if (cached?.status === "error") return { ok: false, message: cached.message };

  validateCache.set(key, { status: "pending" });

  void ensureMermaidLoaded().then(async (api) => {
    if (!api?.parse) {
      validateCache.set(key, {
        status: "error",
        message: "Mermaid failed to load.",
      });
      notify();
      return;
    }

    try {
      await Promise.resolve(api.parse(code, { suppressErrors: true }));
      validateCache.set(key, { status: "ok", value: true });
      notify();
    } catch (err) {
      validateCache.set(key, {
        status: "error",
        message: err instanceof Error ? err.message : "Invalid Mermaid diagram.",
      });
      notify();
    }
  });

  return { ok: false, message: "Validating diagram..." };
}

export function renderMermaidToSvgHtml(code: string): string | null {
  const key = code;
  const cached = renderCache.get(key);
  if (cached?.status === "ok") return cached.value;
  if (cached?.status === "pending") return null;
  if (cached?.status === "error") return null;

  renderCache.set(key, { status: "pending" });

  void ensureMermaidLoaded().then(async (api) => {
    if (!api?.render) {
      renderCache.set(key, {
        status: "error",
        message: "Mermaid failed to load.",
      });
      notify();
      return;
    }

    try {
      // Validate before rendering (parse may throw).
      if (api.parse) {
        await Promise.resolve(api.parse(code, { suppressErrors: true }));
      }
      const renderId = `mermaid-${renderCounter++}`;
      const output = await Promise.resolve(api.render(renderId, code));
      const svg = typeof output === "string" ? output : output?.svg;
      if (!svg) throw new Error("Mermaid did not return SVG output.");

      renderCache.set(key, { status: "ok", value: sanitizeSvg(svg) });
      notify();
    } catch (err) {
      renderCache.set(key, {
        status: "error",
        message: err instanceof Error ? err.message : "Invalid Mermaid diagram.",
      });
      notify();
    }
  });

  return null;
}

