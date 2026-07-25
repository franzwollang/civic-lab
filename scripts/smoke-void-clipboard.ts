/**
 * Node smoke tests for void plain-text export / paste parsing.
 * Run: pnpm exec tsx scripts/smoke-void-clipboard.ts
 */
import { serializeNode, serializeNodes } from "../src/doc/plainTextExport";
import { parseVoidPlainText } from "../src/editor/voidClipboard";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function assertEq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  assert(a === e, `${label}: expected ${e}, got ${a}`);
}

const mathInline = {
  type: "math_inline",
  id: "m1",
  latex: "x^2",
  children: [{ text: "" }],
};
const mathBlock = {
  type: "math_block",
  id: "m2",
  latex: "E=mc^2",
  children: [{ text: "" }],
};
const mermaid = {
  type: "mermaid_block",
  id: "mm",
  code: "graph TD\n  A-->B",
  children: [{ text: "" }],
};
const data = {
  type: "data_block",
  id: "d1",
  language: "json",
  code: '{\n  "a": 1\n}',
  children: [{ text: "" }],
};
const procedure = {
  type: "procedure_block",
  id: "p1",
  dialect: "pseudocode.js",
  code: "\\begin{algorithm}\n\\end{algorithm}",
  children: [{ text: "" }],
};
const image = {
  type: "image_block",
  id: "i1",
  src: "/img.webp",
  alt: "Ballot",
  caption: "A ballot",
  children: [{ text: "" }],
};
const external = {
  type: "external_artifact",
  id: "e1",
  provider: "github",
  general_id: "github:example/ballot-defs",
  specific_id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  display_title: "Ballot defs",
  summary: "Pinned",
  license: "MIT",
  children: [{ text: "" }],
};
const citation = {
  type: "citation_inline",
  id: "c1",
  attribution_ref: "attr-1",
  children: [{ text: "" }],
};
const term = {
  type: "term_inline",
  id: "t1",
  term_ref: "term-1",
  children: [{ text: "plurality" }],
};

assertEq(serializeNode(mathInline), "$x^2$", "math_inline export");
assertEq(serializeNode(mathBlock), "$$\nE=mc^2\n$$", "math_block export");
assertEq(
  serializeNode(mermaid),
  "```mermaid\ngraph TD\n  A-->B\n```",
  "mermaid export",
);
assertEq(
  serializeNode(data),
  '```json\n{\n  "a": 1\n}\n```',
  "data export",
);
assertEq(
  serializeNode(procedure),
  "```pseudocode.js\n\\begin{algorithm}\n\\end{algorithm}\n```",
  "procedure export",
);
assertEq(
  serializeNode(image),
  "![Ballot](/img.webp)\nA ballot",
  "image export",
);
assertEq(
  serializeNode(external),
  "```external_artifact\nprovider: github\ngeneral_id: github:example/ballot-defs\nspecific_id: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\ndisplay_title: Ballot defs\nsummary: Pinned\nlicense: MIT\n```",
  "external_artifact export",
);
assertEq(serializeNode(citation), "[cite:attr-1]", "citation export");
assertEq(serializeNode(term), "[term:term-1|plurality]", "term export");

assertEq(
  parseVoidPlainText(serializeNode(mathInline)),
  { kind: "math_inline", latex: "x^2" },
  "math_inline round-trip",
);
assertEq(
  parseVoidPlainText(serializeNode(mathBlock)),
  { kind: "math_block", latex: "E=mc^2" },
  "math_block round-trip",
);
assertEq(
  parseVoidPlainText(serializeNode(mermaid)),
  { kind: "mermaid", code: "graph TD\n  A-->B" },
  "mermaid round-trip",
);
assertEq(
  parseVoidPlainText(serializeNode(data)),
  { kind: "data", language: "json", code: '{\n  "a": 1\n}' },
  "data round-trip",
);
assertEq(
  parseVoidPlainText(serializeNode(procedure)),
  {
    kind: "procedure",
    code: "\\begin{algorithm}\n\\end{algorithm}",
  },
  "procedure round-trip",
);
assertEq(
  parseVoidPlainText(serializeNode(image)),
  {
    kind: "image",
    alt: "Ballot",
    src: "/img.webp",
    caption: "A ballot",
  },
  "image round-trip",
);
assertEq(
  parseVoidPlainText(serializeNode(external)),
  {
    kind: "external_artifact",
    provider: "github",
    general_id: "github:example/ballot-defs",
    specific_id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    display_title: "Ballot defs",
    summary: "Pinned",
    license: "MIT",
  },
  "external_artifact round-trip",
);
assertEq(
  parseVoidPlainText(serializeNode(citation)),
  { kind: "citation", attributionRef: "attr-1" },
  "citation round-trip",
);
assertEq(
  parseVoidPlainText(serializeNode(term)),
  { kind: "term", termRef: "term-1", label: "plurality" },
  "term round-trip",
);

// Broken double-escaped regex must not be needed; yml alias works
assertEq(
  parseVoidPlainText("```yml\nfoo: 1\n```"),
  { kind: "data", language: "yaml", code: "foo: 1" },
  "yml → yaml",
);

const doc = serializeNodes([
  { type: "h2", id: "h", children: [{ text: "Title" }] },
  { type: "p", id: "p", children: [{ text: "Hello " }, mathInline] },
  mermaid,
]);
assert(doc.includes("## Title"), "heading export");
assert(doc.includes("Hello $x^2$"), "inline math in paragraph");
assert(doc.includes("```mermaid"), "block in document");

assertEq(parseVoidPlainText("just plain text"), null, "non-void text → null");

console.log("smoke-void-clipboard: ok");
