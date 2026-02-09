import { v4 as uuidv4 } from "uuid";

export type SlateValue = Array<Record<string, unknown>>;

export function ensureTopLevelBlockIds(value: SlateValue): SlateValue {
  const seen = new Set<string>();

  return value.map((node) => {
    const next = { ...node };
    const currentId = typeof next.id === "string" ? next.id : "";
    let id = currentId;

    if (!id || seen.has(id)) {
      id = uuidv4();
    }

    seen.add(id);
    next.id = id;
    return next;
  });
}
