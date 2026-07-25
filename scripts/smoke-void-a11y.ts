/**
 * Smoke: void embed a11y wiring (sanitize + helpers).
 * Run: pnpm exec tsx scripts/smoke-void-a11y.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { truncateForAria } from "../src/editor/voidA11y.tsx";

assert.equal(truncateForAria("  hello   world  "), "hello world");
assert.ok(truncateForAria("x".repeat(200)).endsWith("…"));
assert.equal(truncateForAria(""), "");

const usePrism = readFileSync("src/editor/usePrism.ts", "utf8");
assert.match(usePrism, /sanitizePrismHtml/);

const mathjax = readFileSync("src/editor/mathjax.ts", "utf8");
assert.match(mathjax, /sanitizeSvgHtml/);

const mermaid = readFileSync("src/editor/mermaid.ts", "utf8");
assert.match(mermaid, /sanitizeSvgHtml/);

const voidBlocks = readFileSync("src/editor/void-blocks.tsx", "utf8");
assert.match(voidBlocks, /VoidPreviewRegion/);
assert.match(voidBlocks, /removeButtonKeyDown/);

const mathNodes = readFileSync("src/editor/math-nodes.tsx", "utf8");
assert.match(mathNodes, /VoidPreviewRegion/);
assert.match(mathNodes, /aria-label=\{`Inline math/);

const evidence = readFileSync("src/editor/evidence-nodes.tsx", "utf8");
assert.match(evidence, /aria-label="Evidence block"/);
assert.match(evidence, /aria-label="Remove citation"/);
assert.match(evidence, /voidPreviewKeyDown/);

console.log("smoke-void-a11y: ok");
