/**
 * Smoke: CONCEPT Appendix D external_artifact node + provider whitelist.
 * Run: pnpm exec tsx scripts/smoke-external-artifact.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  EXTERNAL_ARTIFACT_PROVIDERS,
  isExternalArtifactEmpty,
  parseExternalArtifactFenceBody,
  serializeExternalArtifactFence,
  validateExternalArtifact,
} from "../src/lib/externalArtifact";
import {
  validateDocumentStructure,
  validateDocumentStructureForMerge,
} from "../src/doc/structuralValidation";
import { serializeNode } from "../src/doc/plainTextExport";
import { parseVoidPlainText } from "../src/editor/voidClipboard";
import { DOCUMENT_READER_NODE_TYPES } from "../src/doc/DocumentReader.tsx";
import { ELEMENT_TYPES } from "../src/editor/model.ts";

const SHA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

// --- Pure helpers ---
assert.deepEqual(
  [...EXTERNAL_ARTIFACT_PROVIDERS],
  ["github", "zenodo", "arxiv", "osf"],
);

assert.equal(
  isExternalArtifactEmpty({
    provider: "",
    general_id: "",
    specific_id: "",
    display_title: "",
  }),
  true,
);

const gh = validateExternalArtifact({
  provider: "github",
  general_id: "example/ballot-defs",
  specific_id: SHA,
  display_title: "Ballot defs snapshot",
  summary: "Pinned commit",
  license: "MIT",
});
assert.equal(gh.ok, true);
if (gh.ok) {
  assert.equal(gh.normalized.general_id, "github:example/ballot-defs");
  assert.equal(gh.normalized.specific_id, SHA);
}

const badProvider = validateExternalArtifact({
  provider: "gitlab",
  general_id: "x/y",
  specific_id: SHA,
  display_title: "Nope",
});
assert.equal(badProvider.ok, false);
if (!badProvider.ok) assert.equal(badProvider.field, "provider");

const badSha = validateExternalArtifact({
  provider: "github",
  general_id: "example/ballot-defs",
  specific_id: "notasha",
  display_title: "Nope",
});
assert.equal(badSha.ok, false);
if (!badSha.ok) assert.equal(badSha.field, "specific_id");

const zenodo = validateExternalArtifact({
  provider: "zenodo",
  general_id: "10.5281/zenodo.1234567",
  specific_id: "10.5281/zenodo.1234567",
  display_title: "Dataset",
});
assert.equal(zenodo.ok, true);

const arxiv = validateExternalArtifact({
  provider: "arxiv",
  general_id: "2001.00001",
  specific_id: "v2",
  display_title: "Paper",
});
assert.equal(arxiv.ok, true);
if (arxiv.ok) {
  assert.equal(arxiv.normalized.general_id, "arxiv:2001.00001");
  assert.equal(arxiv.normalized.specific_id, "v2");
}

const osf = validateExternalArtifact({
  provider: "osf",
  general_id: "abcde",
  specific_id: "v1",
  display_title: "OSF project",
});
assert.equal(osf.ok, true);

// Fence round-trip
const fence = serializeExternalArtifactFence({
  provider: "github",
  general_id: "github:example/ballot-defs",
  specific_id: SHA,
  display_title: "Ballot defs snapshot",
  summary: "Pinned",
  license: "MIT",
});
const parsedFence = parseExternalArtifactFenceBody(
  fence.replace(/^```external_artifact\n/, "").replace(/\n```$/, ""),
);
assert.ok(parsedFence);
assert.equal(parsedFence?.provider, "github");
assert.equal(parsedFence?.display_title, "Ballot defs snapshot");

const node = {
  type: "external_artifact",
  id: "ext-1",
  provider: "github",
  general_id: "github:example/ballot-defs",
  specific_id: SHA,
  display_title: "Ballot defs snapshot",
  summary: "Pinned",
  license: "MIT",
  children: [{ text: "" }],
};
const exported = serializeNode(node);
assert.match(exported, /^```external_artifact\n/);
const paste = parseVoidPlainText(exported);
assert.ok(paste);
assert.equal(paste?.kind, "external_artifact");
if (paste?.kind === "external_artifact") {
  assert.equal(paste.provider, "github");
  assert.equal(paste.specific_id, SHA);
  assert.equal(paste.display_title, "Ballot defs snapshot");
}

// Structural validation: empty → warning; invalid provider → error; valid → ok
const emptyDoc = [
  {
    type: "external_artifact",
    id: "e0",
    provider: "",
    general_id: "",
    specific_id: "",
    display_title: "",
    children: [{ text: "" }],
  },
];
const emptyResult = validateDocumentStructure(emptyDoc);
assert.equal(emptyResult.success, true);
assert.ok(
  emptyResult.issues.some((i) => i.params?.rule === "external-artifact-empty"),
);
const emptyMerge = validateDocumentStructureForMerge(emptyDoc);
assert.equal(emptyMerge.success, false);

const invalidDoc = [
  {
    type: "external_artifact",
    id: "e1",
    provider: "gitlab",
    general_id: "x/y",
    specific_id: SHA,
    display_title: "Bad",
    children: [{ text: "" }],
  },
];
const invalidResult = validateDocumentStructure(invalidDoc);
assert.equal(invalidResult.success, false);
assert.ok(
  invalidResult.issues.some(
    (i) => i.params?.rule === "external-artifact-invalid",
  ),
);

const validDoc = [node];
const validResult = validateDocumentStructure(validDoc);
assert.equal(validResult.success, true);
assert.equal(validResult.issues.length, 0);
assert.equal(validateDocumentStructureForMerge(validDoc).success, true);

// Wiring asserts
assert.ok(
  (DOCUMENT_READER_NODE_TYPES as readonly string[]).includes(
    ELEMENT_TYPES.EXTERNAL_ARTIFACT,
  ),
);

const modelSrc = readFileSync("src/editor/model.ts", "utf8");
assert.match(modelSrc, /EXTERNAL_ARTIFACT:\s*"external_artifact"/);

const plateSrc = readFileSync("src/editor/plate.tsx", "utf8");
assert.match(plateSrc, /ExternalArtifactPlugin/);

const editorSrc = readFileSync("src/app/pages/test-editor.tsx", "utf8");
assert.match(editorSrc, /insertExternalArtifact/);
assert.match(editorSrc, /External/);

const readerSrc = readFileSync("src/doc/DocumentReader.tsx", "utf8");
assert.match(readerSrc, /ExternalArtifactRead/);

const voidNavSrc = readFileSync("src/editor/voidNavigation.ts", "utf8");
assert.match(voidNavSrc, /external_artifact/);

console.log("smoke-external-artifact: ok");
