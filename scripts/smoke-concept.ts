/**
 * Smoke: CONCEPT.md editorial invariants (OPEN_ISSUES §6 rewrite checklist).
 * Static checks — no DB required.
 *
 * Run: pnpm exec tsx scripts/smoke-concept.ts
 */
import { promises as fs } from "fs";
import path from "path";

const ROOT = process.cwd();

async function main() {
  const concept = await fs.readFile(path.join(ROOT, "CONCEPT.md"), "utf8");

  const required = [
    // Hierarchy
    "Area → Collection → Dossier → Artifact → ArtifactRevision / Section",
    "UI “pages” are views only",
    // Claims abstraction + kill Requirements Matrix
    "One claims abstraction, two profiles",
    "There is no Requirements Matrix entity",
    // Bridge soft-label
    "lane_soft_label",
    "composite",
    // Parent / sub-RFC
    "Wrapper parent",
    "Leaf RFC",
    // Evidence section
    "### 2.4 Evidence, attributions, and terms",
    "Appendix E",
    // Living site artifacts
    "### 9.3 Charter and living site artifacts",
    "/about",
    "/faq",
    // Title framing
    "# Civic Lab — Product Concept",
  ];

  for (const marker of required) {
    if (!concept.includes(marker)) {
      throw new Error(`CONCEPT.md missing required marker: ${JSON.stringify(marker)}`);
    }
  }

  // Must not reintroduce Requirements Matrix as a positive entity/type.
  const positiveMatrix = [
    "Requirements Matrix entity stores",
    "create a Requirements Matrix",
    "the Requirements Matrix type",
  ];
  for (const bad of positiveMatrix) {
    if (concept.includes(bad)) {
      throw new Error(`CONCEPT.md must not reintroduce: ${JSON.stringify(bad)}`);
    }
  }

  // Numbered body should keep §0–§12 without duplicate "## 5." style collisions.
  const h2 = [...concept.matchAll(/^## (\d+)\./gm)].map((m) => Number(m[1]));
  const expected = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  if (JSON.stringify(h2) !== JSON.stringify(expected)) {
    throw new Error(
      `CONCEPT.md section numbering drift: got [${h2.join(",")}] expected [${expected.join(",")}]`,
    );
  }

  console.log("smoke-concept: CONCEPT.md editorial markers + numbering OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
