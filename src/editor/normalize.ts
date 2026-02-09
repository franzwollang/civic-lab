type SlateBlock = Record<string, unknown> & { type?: string };

const getHeadingLevel = (type?: string) => {
  if (type === "h2") return 2;
  if (type === "h3") return 3;
  if (type === "h4") return 4;
  return null;
};

export function normalizeHeadingLevels(
  value: Array<Record<string, unknown>>,
) {
  let changed = false;
  let lastHeadingLevel: number | null = null;
  const nextValue: Array<Record<string, unknown>> = value.map((node) => {
    const block = node as SlateBlock;
    const level = getHeadingLevel(block.type);
    if (level === null) {
      return node;
    }

    let nextType = block.type;

    if (level === 3 && (lastHeadingLevel === null || lastHeadingLevel < 2)) {
      nextType = "h2";
    }

    if (level === 4 && (lastHeadingLevel === null || lastHeadingLevel < 3)) {
      nextType = lastHeadingLevel === 2 ? "h3" : "h2";
    }

    if (nextType !== block.type) {
      changed = true;
    }

    const normalizedLevel = getHeadingLevel(nextType);
    if (normalizedLevel !== null) {
      lastHeadingLevel = normalizedLevel;
    }

    if (nextType === block.type) return node;
    return {
      ...node,
      type: nextType,
    };
  });

  return {
    value: changed ? nextValue : value,
    changed,
  };
}
