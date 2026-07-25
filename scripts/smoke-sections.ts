/**
 * Smoke: Section extraction from artifact content_json (M3 section plan).
 * Run: pnpm exec tsx scripts/smoke-sections.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { extractSectionsFromContent } from "../src/doc/sections.ts";

const revisions = JSON.parse(
  readFileSync("prisma/seed/page_revisions.json", "utf8"),
) as Array<{ content_json: unknown }>;

assert.ok(revisions.length > 0, "seed revisions present");

const sections = extractSectionsFromContent(revisions[0].content_json);
assert.ok(sections.length >= 1, "extracts at least one heading section");

const overview = sections.find((s) => s.stable_key === "block-001");
assert.ok(overview, "seed h2 block-001 present");
assert.equal(overview.level, 2);
assert.match(overview.title, /Voting systems overview/i);

const goals = sections.find((s) => s.stable_key === "block-003");
assert.ok(goals, "seed h3 block-003 present");
assert.equal(goals.level, 3);
assert.match(goals.title, /Goals/i);

// Missing id → skipped
assert.deepEqual(
  extractSectionsFromContent([
    { type: "h2", children: [{ text: "No id" }] },
    { type: "p", id: "p-1", children: [{ text: "skip" }] },
  ]),
  [],
);

// Empty / non-array
assert.deepEqual(extractSectionsFromContent(null), []);
assert.deepEqual(extractSectionsFromContent({}), []);

const typesSrc = readFileSync("src/doc/types.ts", "utf8");
assert.match(typesSrc, /export type ArtifactRow/);
assert.match(typesSrc, /export type ArtifactRevisionRow/);

const clientSrc = readFileSync("src/api/client.ts", "utf8");
assert.match(clientSrc, /export async function getArtifact/);
assert.match(clientSrc, /\/artifacts/);

const serverSrc = readFileSync("server/index.ts", "utf8");
assert.match(serverSrc, /\/api\/artifacts/);

const artifactPage = readFileSync("src/app/pages/artifact-page.tsx", "utf8");
assert.match(artifactPage, /ArtifactDocumentBody|useArtifactDocument/);
assert.match(artifactPage, /extractSectionsFromContent|sections/);

console.log(`smoke-sections: ok (${sections.length} sections from seed)`);
