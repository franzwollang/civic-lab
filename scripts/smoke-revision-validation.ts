/**
 * Smoke: server revision validation (Zod envelope + structural rules).
 * Run: pnpm exec tsx scripts/smoke-revision-validation.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { pageRevisionSchema } from "../src/api/schemas.ts";
import { validateDocumentStructure } from "../src/doc/structuralValidation.ts";

const validDoc = [
  { type: "h2", id: "h1", children: [{ text: "Title" }] },
  { type: "p", id: "p1", children: [{ text: "Hello" }] },
  {
    type: "math_block",
    id: "m1",
    latex: "x^2",
    children: [{ text: "" }],
  },
  {
    type: "data_block",
    id: "d1",
    language: "json",
    code: '{"a":1}',
    children: [{ text: "" }],
  },
];

const ok = validateDocumentStructure(validDoc);
assert.equal(ok.success, true, "valid doc should pass");

const badHeading = validateDocumentStructure([
  { type: "h3", id: "h3", children: [{ text: "orphan h3" }] },
]);
assert.equal(badHeading.success, false, "orphan H3 should fail");
assert.ok(
  badHeading.issues.some((i) => i.message.includes("H3 must follow")),
  "orphan H3 issue message",
);

const emptyMath = validateDocumentStructure([
  { type: "math_block", id: "m", latex: "  ", children: [{ text: "" }] },
]);
assert.equal(emptyMath.success, false, "empty math should fail");

const badData = validateDocumentStructure([
  {
    type: "data_block",
    id: "d",
    language: "json",
    code: "{not-json",
    children: [{ text: "" }],
  },
]);
assert.equal(badData.success, false, "invalid JSON data block should fail");

const notArray = validateDocumentStructure({ nope: true });
assert.equal(notArray.success, false, "non-array content_json should fail");

const revision = {
  revision_id: "rev-1",
  page_id: "page-1",
  parent_revision_id: null,
  created_at: new Date().toISOString(),
  author: "local",
  content_json: validDoc,
  blocks: [
    {
      block_id: "h1",
      type: "h2",
      order: 0,
      hash: "abc",
      text_preview: "Title",
    },
  ],
  doc_root_hash: "root",
  schema_version: 2,
};

const parsed = pageRevisionSchema.safeParse(revision);
assert.equal(parsed.success, true, "valid revision envelope");
if (parsed.success) {
  assert.equal(parsed.data.artifact_id, "page-1", "dual-emit artifact_id");
  assert.equal(parsed.data.page_id, "page-1", "legacy page_id kept");
}

const preferred = pageRevisionSchema.safeParse({
  ...revision,
  page_id: undefined,
  artifact_id: "page-1",
});
assert.equal(preferred.success, true, "artifact_id-only envelope");
if (preferred.success) {
  assert.equal(preferred.data.page_id, "page-1");
}

const missingAuthor = pageRevisionSchema.safeParse({
  ...revision,
  author: undefined,
});
assert.equal(missingAuthor.success, false, "missing author rejected");

const contentNotArray = pageRevisionSchema.safeParse({
  ...revision,
  content_json: { nodes: [] },
});
assert.equal(contentNotArray.success, false, "content_json must be array");

const indexSrc = readFileSync("server/index.ts", "utf8");
assert.match(indexSrc, /validateRevisionPayload/);
assert.match(indexSrc, /issues: validated\.issues/);

const validateSrc = readFileSync("server/validateRevision.ts", "utf8");
assert.match(validateSrc, /pageRevisionSchema/);
assert.match(validateSrc, /validateDocumentStructure/);

console.log("smoke-revision-validation: ok");
