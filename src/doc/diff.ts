import type { BlockRow } from "./types";

export type DiffSummary = {
  added: BlockRow[];
  deleted: BlockRow[];
  edited: BlockRow[];
  moved: Array<{ block_id: string; from: number; to: number }>;
};

export function diffBlocks(oldBlocks: BlockRow[], newBlocks: BlockRow[]): DiffSummary {
  const oldById = new Map(oldBlocks.map((block) => [block.block_id, block]));
  const newById = new Map(newBlocks.map((block) => [block.block_id, block]));

  const added = newBlocks.filter((block) => !oldById.has(block.block_id));
  const deleted = oldBlocks.filter((block) => !newById.has(block.block_id));
  const edited = newBlocks.filter((block) => {
    const previous = oldById.get(block.block_id);
    return previous ? previous.hash !== block.hash : false;
  });

  const moved = newBlocks.flatMap((block, to) => {
    const previous = oldById.get(block.block_id);
    if (!previous) return [];
    const from = previous.order;
    return from !== to ? [{ block_id: block.block_id, from, to }] : [];
  });

  return { added, deleted, edited, moved };
}
