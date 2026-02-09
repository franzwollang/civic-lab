type MathJaxGlobal = {
  startup?: { promise?: Promise<unknown> };
  tex2svg?: (
    tex: string,
    options?: { display?: boolean; containerWidth?: number },
  ) => HTMLElement;
  tex2svgPromise?: (
    tex: string,
    options?: { display?: boolean; containerWidth?: number },
  ) => Promise<HTMLElement>;
};

type ValidationResult = { ok: true } | { ok: false; message: string };

const getMathJax = (): MathJaxGlobal | null =>
  ((globalThis as any).MathJax as MathJaxGlobal | undefined) ?? null;

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribeMathJaxUpdates(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let loadPromise: Promise<boolean> | null = null;

function ensureConfig() {
  const existing = (globalThis as any).MathJax ?? {};

  // Config must be set before the component is imported. During dev/HMR we may
  // already have a global; we still want to enforce our options.
  (globalThis as any).MathJax = {
    ...existing,
    tex: {
      ...(existing.tex ?? {}),
      inlineMath: [
        ["$", "$"],
        ["\\(", "\\)"],
      ],
      displayMath: [
        ["$$", "$$"],
        ["\\[", "\\]"],
      ],
      processEscapes: true,
    },
    // Use per-expression glyph definitions so SVG output doesn't depend on a
    // separate, document-global cache element being injected.
    svg: { ...(existing.svg ?? {}), fontCache: "local" },
    startup: { ...(existing.startup ?? {}), typeset: false },
  };
}

export async function ensureMathJaxLoaded(): Promise<boolean> {
  if (typeof document === "undefined") return false;

  const mj = getMathJax();
  if (mj?.tex2svg || mj?.tex2svgPromise) return true;

  if (loadPromise) return loadPromise;

  ensureConfig();

  loadPromise = import("mathjax/tex-svg.js")
    .then(async () => {
      const next = getMathJax();
      await (next?.startup?.promise ?? Promise.resolve());
      notify();
      return Boolean(next?.tex2svg || next?.tex2svgPromise);
    })
    .catch(() => false);

  return loadPromise;
}

export function isMathJaxReady(): boolean {
  const mj = getMathJax();
  return Boolean(mj?.tex2svg || mj?.tex2svgPromise);
}

type StatusOk<T> = { status: "ok"; value: T };
type StatusPending = { status: "pending" };
type StatusError = { status: "error"; message: string };
type Status<T> = StatusOk<T> | StatusPending | StatusError;

const renderCache = new Map<string, Status<string>>();
const validateCache = new Map<string, Status<true>>();

const keyFor = (tex: string, display: boolean, containerWidth?: number) => {
  const widthKey =
    typeof containerWidth === "number" && Number.isFinite(containerWidth)
      ? `:${Math.max(0, Math.floor(containerWidth))}`
      : "";
  return `${display ? "d" : "i"}:${tex}${widthKey}`;
};

export function renderTexToSvgHtml(
  tex: string,
  display: boolean,
  containerWidth?: number,
): string | null {
  const key = keyFor(tex, display, containerWidth);
  const cached = renderCache.get(key);
  if (cached?.status === "ok") return cached.value;
  if (cached?.status === "pending") return null;
  if (cached?.status === "error") return null;

  renderCache.set(key, { status: "pending" });

  void ensureMathJaxLoaded().then(async (ready) => {
    if (!ready) {
      renderCache.set(key, {
        status: "error",
        message: "MathJax failed to load.",
      });
      notify();
      return;
    }

    const mj = getMathJax();
    try {
      // When MathJax typesets off-DOM, it can think the container is 0px wide
      // and introduce automatic line breaks even for short inline expressions.
      //
      // Inline math: never line-break (let the user convert to a block instead).
      // Display math: allow line breaks according to the container width.
      const nextContainerWidth =
        typeof containerWidth === "number" && Number.isFinite(containerWidth)
          ? containerWidth
          : display
            ? 800
            : 1_000_000;
      const node = mj?.tex2svg
        ? mj.tex2svg(tex, {
            display,
            containerWidth: nextContainerWidth,
          } as any)
        : await mj?.tex2svgPromise?.(tex, {
            display,
            containerWidth: nextContainerWidth,
          });

      const html = node?.outerHTML;
      if (!html) throw new Error("MathJax did not return SVG output.");

      renderCache.set(key, { status: "ok", value: html });
      notify();
    } catch (err) {
      renderCache.set(key, {
        status: "error",
        message: err instanceof Error ? err.message : "Invalid LaTeX expression.",
      });
      notify();
    }
  });

  return null;
}

export function validateTexWithMathJax(
  tex: string,
  display: boolean,
): ValidationResult {
  const key = keyFor(tex, display);
  const cached = validateCache.get(key);
  if (cached?.status === "ok") return { ok: true };
  if (cached?.status === "pending") return { ok: false, message: "Validating LaTeX..." };
  if (cached?.status === "error") return { ok: false, message: cached.message };

  // Kick off async validation. While pending, we block saving.
  validateCache.set(key, { status: "pending" });

  void ensureMathJaxLoaded().then(async (ready) => {
    if (!ready) {
      validateCache.set(key, {
        status: "error",
        message: "MathJax failed to load.",
      });
      notify();
      return;
    }

    const mj = getMathJax();
    try {
      // Validation shouldn't depend on layout, so always validate as unbroken.
      const containerWidth = 1_000_000;
      if (mj?.tex2svg) {
        mj.tex2svg(tex, { display, containerWidth } as any);
      } else if (mj?.tex2svgPromise) {
        await mj.tex2svgPromise(tex, { display, containerWidth });
      } else {
        throw new Error("MathJax is not ready.");
      }

      validateCache.set(key, { status: "ok", value: true });
      notify();
    } catch (err) {
      validateCache.set(key, {
        status: "error",
        message: err instanceof Error ? err.message : "Invalid LaTeX expression.",
      });
      notify();
    }
  });

  return { ok: false, message: "Validating LaTeX..." };
}
