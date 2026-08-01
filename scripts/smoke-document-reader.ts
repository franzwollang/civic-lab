/**
 * Smoke: DocumentReader covers full editor node set + preview wiring.
 * Run: pnpm exec tsx scripts/smoke-document-reader.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  DOCUMENT_READER_NODE_TYPES,
} from "../src/doc/DocumentReader.tsx";
import { ELEMENT_TYPES } from "../src/editor/model.ts";

const required = [
  ELEMENT_TYPES.MATH_INLINE,
  ELEMENT_TYPES.MATH_BLOCK,
  ELEMENT_TYPES.MERMAID_BLOCK,
  ELEMENT_TYPES.PROCEDURE_BLOCK,
  ELEMENT_TYPES.DATA_BLOCK,
  ELEMENT_TYPES.IMAGE_BLOCK,
  ELEMENT_TYPES.EXTERNAL_ARTIFACT,
  ELEMENT_TYPES.EVIDENCE_BLOCK,
  ELEMENT_TYPES.CITATION_INLINE,
  ELEMENT_TYPES.TERM_INLINE,
] as const;

for (const t of required) {
  assert.ok(
    (DOCUMENT_READER_NODE_TYPES as readonly string[]).includes(t),
    `missing reader coverage for ${t}`,
  );
}

const readerSrc = readFileSync("src/doc/DocumentReader.tsx", "utf8");
assert.match(readerSrc, /renderTexToSvgHtml/);
assert.match(readerSrc, /renderMermaidToSvgHtml/);
assert.match(readerSrc, /usePrismHighlight/);
assert.match(readerSrc, /CitationRead/);
assert.match(readerSrc, /TermRead/);
assert.match(readerSrc, /ImageBlockRead/);
assert.match(readerSrc, /ExternalArtifactRead/);
assert.match(readerSrc, /Evidence block/);

const preview = readFileSync("src/app/pages/test-preview.tsx", "utf8");
assert.match(preview, /DocumentReader/);
assert.match(preview, /EvidenceRegistryProvider/);
assert.doesNotMatch(preview, /case "h1"/);

console.log("smoke-document-reader: ok");
