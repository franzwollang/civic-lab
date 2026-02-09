import { useEffect, useMemo, useState } from "react";

type PrismType = any;

async function loadPrism(): Promise<PrismType | null> {
  try {
    const mod: any = await import("prismjs");

    // Load only the grammars we care about.
    await Promise.allSettled([
      import("prismjs/components/prism-json"),
      import("prismjs/components/prism-yaml"),
      import("prismjs/components/prism-toml"),
      import("prismjs/components/prism-csv"),
    ]);

    if (mod?.languages && !mod.languages.mermaid) {
      mod.languages.mermaid = {
        comment: /%%.*/,
        keyword:
          /\b(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|stateDiagram-v2|erDiagram|journey|gantt|pie|mindmap|timeline|quadrantChart)\b/,
        operator: /-->|---|==>|<--|<->|--|==|->|<-|=>|\.\./,
        number: /\b\d+(?:\.\d+)?\b/,
        string: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/,
        punctuation: /[{}[\]();,.]/,
      };
    }

    return mod?.default ?? mod;
  } catch {
    return null;
  }
}

export function usePrism(): PrismType | null {
  const [prism, setPrism] = useState<PrismType | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadPrism().then((p) => {
      if (cancelled) return;
      setPrism(p);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return prism;
}

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

export function usePrismHighlight(args: {
  language: string;
  code: string;
}): { html: string; ready: boolean } {
  const prism = usePrism();

  return useMemo(() => {
    if (!prism) return { html: escapeHtml(args.code), ready: false };
    const grammar = prism.languages?.[args.language] ?? prism.languages?.markup;
    if (!grammar || typeof prism.highlight !== "function") {
      return { html: escapeHtml(args.code), ready: true };
    }
    try {
      return {
        html: prism.highlight(args.code, grammar, args.language),
        ready: true,
      };
    } catch {
      return { html: escapeHtml(args.code), ready: true };
    }
  }, [args.code, args.language, prism]);
}
