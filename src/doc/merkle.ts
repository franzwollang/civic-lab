import { sha256Hex } from "../crypto/hash";

export function merkleRoot(blockHashes: string[]): string {
  if (blockHashes.length === 0) {
    return sha256Hex("empty");
  }

  let level = blockHashes.map((hash) => sha256Hex(`block:${hash}`));

  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] ?? left;
      next.push(sha256Hex(`${left}|${right}`));
    }
    level = next;
  }

  return level[0];
}
