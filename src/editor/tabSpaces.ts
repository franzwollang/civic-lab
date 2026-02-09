export const TAB_SPACES = "  ";

const countLeadingSpaces = (s: string) => {
  let i = 0;
  while (i < s.length && s[i] === " ") i++;
  return i;
};

export function applyTabToText(args: {
  value: string;
  selectionStart: number;
  selectionEnd: number;
  tab: string;
  outdent: boolean;
}): { value: string; selectionStart: number; selectionEnd: number } {
  const { value, selectionStart, selectionEnd, tab, outdent } = args;
  const start = Math.max(0, Math.min(value.length, selectionStart));
  const end = Math.max(0, Math.min(value.length, selectionEnd));
  const selStart = Math.min(start, end);
  const selEnd = Math.max(start, end);

  const lineStart = value.lastIndexOf("\n", selStart - 1) + 1;
  const lineEndIdx = value.indexOf("\n", selEnd);
  const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;

  const block = value.slice(lineStart, lineEnd);
  const lines = block.split("\n");

  if (!outdent) {
    const nextLines = lines.map((l) => tab + l);
    const nextBlock = nextLines.join("\n");
    const nextValue = value.slice(0, lineStart) + nextBlock + value.slice(lineEnd);

    const lineCount = lines.length;
    const nextSelStart =
      selStart === selEnd
        ? selStart + tab.length
        : selStart + tab.length;
    const nextSelEnd =
      selStart === selEnd
        ? selEnd + tab.length
        : selEnd + tab.length * lineCount;

    return {
      value: nextValue,
      selectionStart: start <= end ? nextSelStart : nextSelEnd,
      selectionEnd: start <= end ? nextSelEnd : nextSelStart,
    };
  }

  const tabLen = tab.length;
  let removedTotal = 0;
  let removedFirstLine = 0;

  const nextLines = lines.map((l, idx) => {
    let remove = 0;
    if (l.startsWith(tab)) {
      remove = tabLen;
    } else {
      // If indentation doesn't match exactly, still allow removing leading spaces
      // up to the tab width.
      remove = Math.min(tabLen, countLeadingSpaces(l));
    }
    removedTotal += remove;
    if (idx === 0) removedFirstLine = remove;
    return l.slice(remove);
  });

  const nextBlock = nextLines.join("\n");
  const nextValue = value.slice(0, lineStart) + nextBlock + value.slice(lineEnd);

  const nextSelStart =
    selStart === selEnd
      ? Math.max(lineStart, selStart - removedFirstLine)
      : Math.max(lineStart, selStart - removedFirstLine);
  const nextSelEnd = Math.max(nextSelStart, selEnd - removedTotal);

  return {
    value: nextValue,
    selectionStart: start <= end ? nextSelStart : nextSelEnd,
    selectionEnd: start <= end ? nextSelEnd : nextSelStart,
  };
}

