import type { DecoratedRange } from "platejs";
import { createSlatePlugin } from "platejs";

import { scanLatex } from "@/doc/latex";

type LatexDecoration = DecoratedRange & {
  latex?: {
    tex: string;
    display: boolean;
    raw: string;
    start: number;
    end: number;
    pathKey: string;
  };
};

export const MathDecoratePlugin = createSlatePlugin({
  key: "mathDecorate",
  decorate: ({ entry }) => {
    const [node, path] = entry;
    const text = (node as { text?: unknown }).text;
    if (typeof text !== "string") return;

    const { expressions } = scanLatex(text);
    if (expressions.length === 0) return;

    const pathKey = path.join(",");

    const ranges: LatexDecoration[] = expressions.map((expr) => ({
      anchor: { path, offset: expr.start },
      focus: { path, offset: expr.end },
      latex: {
        tex: expr.tex,
        display: expr.display,
        raw: expr.raw,
        start: expr.start,
        end: expr.end,
        pathKey,
      },
    }));

    return ranges;
  },
});
