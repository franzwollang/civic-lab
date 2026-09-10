import { insertTable } from "@platejs/table";
import type { Editor as SlateEditor } from "slate";

export type InsertSimpleTableOptions = {
  colCount?: number;
  rowCount?: number;
  /** When true, first row uses `th` cells. */
  header?: boolean;
};

/** Insert a simple table at the current selection (2×3 with header by default). */
export function insertSimpleTable(
  editor: SlateEditor,
  options: InsertSimpleTableOptions = {},
) {
  insertTable(editor as any, {
    colCount: options.colCount ?? 2,
    rowCount: options.rowCount ?? 3,
    header: options.header ?? true,
  });
}
