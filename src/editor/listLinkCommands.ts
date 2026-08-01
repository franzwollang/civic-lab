import { ListStyleType, someList, toggleList } from "@platejs/list";
import { upsertLink, unwrapLink } from "@platejs/link";
import type { Editor } from "slate";

/** Toggle bulleted (disc) flat list on the current block selection. */
export function toggleBulletedList(editor: Editor) {
  toggleList(editor as any, { listStyleType: ListStyleType.Disc });
}

/** Toggle numbered (decimal) flat list on the current block selection. */
export function toggleNumberedList(editor: Editor) {
  toggleList(editor as any, { listStyleType: ListStyleType.Decimal });
}

export function isBulletedListActive(editor: Editor): boolean {
  try {
    return someList(editor as any, ListStyleType.Disc);
  } catch {
    return false;
  }
}

export function isNumberedListActive(editor: Editor): boolean {
  try {
    return someList(editor as any, ListStyleType.Decimal);
  } catch {
    return false;
  }
}

/**
 * Insert or update a link via browser prompt (MVP — no floating toolbar).
 * Empty cancel leaves the document unchanged; empty URL unwraps when inside a link.
 */
export function promptUpsertLink(editor: Editor) {
  if (typeof window === "undefined") return;
  const url = window.prompt("Link URL", "https://");
  if (url === null) return;
  const trimmed = url.trim();
  if (!trimmed) {
    unwrapLink(editor as any);
    return;
  }
  upsertLink(editor as any, { url: trimmed });
}
