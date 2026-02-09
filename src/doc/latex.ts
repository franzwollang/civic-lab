export type LatexExpression = {
  /** Start offset (inclusive) of the full expression including delimiters. */
  start: number;
  /** End offset (exclusive) of the full expression including delimiters. */
  end: number;
  /** TeX content inside the delimiters. */
  tex: string;
  /** Whether this is display math. */
  display: boolean;
  /** The raw substring including delimiters. */
  raw: string;
  /** Opening delimiter. */
  open: "$" | "$$" | "\\(" | "\\[";
};

export type LatexScanError = {
  code:
    | "latex-inline-newline"
    | "latex-unmatched-delimiter"
    | "latex-unclosed-delimiter";
  message: string;
  index: number;
};

export function scanLatex(text: string): {
  expressions: LatexExpression[];
  error: LatexScanError | null;
} {
  const expressions: LatexExpression[] = [];

  const isEscaped = (index: number) => {
    let backslashes = 0;
    for (let i = index - 1; i >= 0 && text[i] === "\\"; i--) backslashes++;
    return backslashes % 2 === 1;
  };

  type Open =
    | { kind: "$"; outerStart: number; contentStart: number; mode: "inline" }
    | {
        kind: "$$";
        outerStart: number;
        contentStart: number;
        mode: "display";
      }
    | {
        kind: "\\(";
        outerStart: number;
        contentStart: number;
        mode: "inline";
      }
    | {
        kind: "\\[";
        outerStart: number;
        contentStart: number;
        mode: "display";
      };

  let open: Open | null = null;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (open && open.mode === "inline" && ch === "\n") {
      return {
        expressions,
        error: {
          code: "latex-inline-newline",
          message: "Inline LaTeX cannot contain a newline.",
          index: i,
        },
      };
    }

    if (ch === "\\" && !isEscaped(i) && i + 1 < text.length) {
      const next = text[i + 1];

      if (!open) {
        if (next === "(") {
          open = { kind: "\\(", outerStart: i, contentStart: i + 2, mode: "inline" };
          i++;
          continue;
        }
        if (next === "[") {
          open = { kind: "\\[", outerStart: i, contentStart: i + 2, mode: "display" };
          i++;
          continue;
        }
        if (next === ")" || next === "]") {
          return {
            expressions,
            error: {
              code: "latex-unmatched-delimiter",
              message: `Unmatched LaTeX delimiter (\\\\${next}).`,
              index: i,
            },
          };
        }
      } else {
        if (open.kind === "\\(" && next === ")") {
          const outerEnd = i + 2;
          const tex = text.slice(open.contentStart, i);
          expressions.push({
            start: open.outerStart,
            end: outerEnd,
            tex,
            display: false,
            raw: text.slice(open.outerStart, outerEnd),
            open: "\\(",
          });
          open = null;
          i++;
          continue;
        }
        if (open.kind === "\\[" && next === "]") {
          const outerEnd = i + 2;
          const tex = text.slice(open.contentStart, i);
          expressions.push({
            start: open.outerStart,
            end: outerEnd,
            tex,
            display: true,
            raw: text.slice(open.outerStart, outerEnd),
            open: "\\[",
          });
          open = null;
          i++;
          continue;
        }
      }
    }

    if (ch === "$" && !isEscaped(i)) {
      const isDouble =
        i + 1 < text.length && text[i + 1] === "$" && !isEscaped(i + 1);

      if (!open) {
        if (isDouble) {
          open = { kind: "$$", outerStart: i, contentStart: i + 2, mode: "display" };
          i++;
          continue;
        }
        open = { kind: "$", outerStart: i, contentStart: i + 1, mode: "inline" };
        continue;
      }

      if (open.kind === "$" && !isDouble) {
        const outerEnd = i + 1;
        const tex = text.slice(open.contentStart, i);
        expressions.push({
          start: open.outerStart,
          end: outerEnd,
          tex,
          display: false,
          raw: text.slice(open.outerStart, outerEnd),
          open: "$",
        });
        open = null;
        continue;
      }

      if (open.kind === "$$" && isDouble) {
        const outerEnd = i + 2;
        const tex = text.slice(open.contentStart, i);
        expressions.push({
          start: open.outerStart,
          end: outerEnd,
          tex,
          display: true,
          raw: text.slice(open.outerStart, outerEnd),
          open: "$$",
        });
        open = null;
        i++;
        continue;
      }
    }
  }

  if (open) {
    const pretty = open.kind === "$" ? "$" : open.kind === "$$" ? "$$" : open.kind;
    return {
      expressions,
      error: {
        code: "latex-unclosed-delimiter",
        message: `Unclosed LaTeX delimiter (${pretty}). Use \\$ for a literal dollar sign.`,
        index: open.outerStart,
      },
    };
  }

  return { expressions, error: null };
}
