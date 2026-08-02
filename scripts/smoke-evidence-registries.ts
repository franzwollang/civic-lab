/**
 * Smoke: richer attribution/term seeds + product reader registry bridge +
 * immutable_ref validation (CONCEPT App E.1 / D.3 patterns).
 * Run: DATABASE_URL="file:./smoke-evidence-registries.db" pnpm exec tsx scripts/smoke-evidence-registries.ts
 */
import assert from "node:assert/strict";
import { promises as fs } from "fs";
import path from "path";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { execFile } from "child_process";
import { promisify } from "util";
import { seedIfEmpty } from "../prisma/seed";
import { setPrisma, getAttributions, getTerms } from "../server/db";
import {
  parseImmutableRef,
  validateImmutableRef,
} from "../src/lib/immutableRef";
import type { AttributionEntity, TermEntity } from "../src/doc/evidence";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "prisma", "smoke-evidence-registries.db");

async function resetDb() {
  await fs.rm(DB_PATH, { force: true });
  await fs.rm(`${DB_PATH}-journal`, { force: true });
  await execFileAsync(
    path.join(ROOT, "node_modules", ".bin", "prisma"),
    ["db", "push", "--skip-generate"],
    {
      cwd: ROOT,
      env: { ...process.env, DATABASE_URL: `file:${DB_PATH}` },
    },
  );
}

async function main() {
  // --- Static wiring: product artifact body uses EvidenceRegistryProvider ---
  const bodySrc = readFileSync("src/doc/ArtifactDocumentBody.tsx", "utf8");
  assert.match(bodySrc, /EvidenceRegistryProvider/);
  assert.match(bodySrc, /useEvidenceRegistry/);
  assert.match(bodySrc, /DocumentReader/);

  const readerSrc = readFileSync("src/doc/DocumentReader.tsx", "utf8");
  assert.match(readerSrc, /immutable_ref/);
  assert.match(readerSrc, /definition_en/);

  const dialogSrc = readFileSync(
    "src/app/components/evidence/attribution-dialogs.tsx",
    "utf8",
  );
  assert.match(dialogSrc, /validateImmutableRef/);
  assert.match(dialogSrc, /Immutable ref/);

  const serverSrc = readFileSync("server/routes/artifacts.ts", "utf8");
  assert.match(serverSrc, /invalid_immutable_ref/);
  assert.match(
    readFileSync("server/index.ts", "utf8"),
    /registerArtifactRoutes/,
  );
  assert.match(serverSrc, /validateImmutableRef/);

  // --- Pure helpers ---
  assert.equal(validateImmutableRef(null).ok, true);
  assert.equal(validateImmutableRef("").ok, true);

  const doi = validateImmutableRef("https://doi.org/10.2307/1961377");
  assert.equal(doi.ok, true);
  if (doi.ok) {
    assert.equal(doi.parsed?.kind, "doi");
    assert.equal(doi.parsed?.normalized, "doi:10.2307/1961377");
  }

  const gh = validateImmutableRef(
    "github:example/ballot-defs@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  );
  assert.equal(gh.ok, true);
  if (gh.ok) {
    assert.equal(gh.parsed?.kind, "github_commit");
    assert.equal(gh.parsed?.specific_id?.length, 40);
  }

  const arxiv = parseImmutableRef("arxiv:2001.00001v2");
  assert.equal(arxiv?.kind, "arxiv");
  assert.equal(arxiv?.specific_id, "v2");

  const osf = validateImmutableRef("osf:abc12/v3");
  assert.equal(osf.ok, true);

  assert.equal(validateImmutableRef("not-a-ref").ok, false);
  assert.equal(validateImmutableRef("osf:abc12").ok, false); // needs version

  // --- Seed richness ---
  await resetDb();
  const prisma = new PrismaClient({
    datasources: { db: { url: `file:${DB_PATH}` } },
  });
  setPrisma(prisma);
  await seedIfEmpty(prisma);

  const attributions = await getAttributions();
  const terms = await getTerms();
  const attrItems = attributions.items as AttributionEntity[];
  const termItems = terms.items as TermEntity[];

  assert.ok(
    attrItems.length >= 5,
    `expected ≥5 attributions, got ${attrItems.length}`,
  );
  assert.ok(
    termItems.length >= 5,
    `expected ≥5 terms, got ${termItems.length}`,
  );

  // Legacy page-001 refs must still resolve
  assert.ok(
    attrItems.some((a) => a.id === "e64a1ad1-33f4-47b2-b020-1e70a3cdc68e"),
  );
  assert.ok(
    termItems.some((t) => t.id === "78546bdc-1d1a-4b4f-905c-8983686d0139"),
  );

  const withImmutable = attrItems.filter(
    (a) => typeof a.immutable_ref === "string" && a.immutable_ref.trim(),
  );
  assert.ok(
    withImmutable.length >= 3,
    `expected ≥3 attributions with immutable_ref, got ${withImmutable.length}`,
  );
  for (const a of withImmutable) {
    const check = validateImmutableRef(a.immutable_ref);
    assert.equal(check.ok, true, `seed immutable_ref invalid for ${a.id}`);
  }

  const scoped = termItems.filter((t) => t.scope.kind !== "global");
  assert.ok(scoped.length >= 2, "expected dossier/country scoped terms");

  await prisma.$disconnect();
  await fs.rm(DB_PATH, { force: true });
  await fs.rm(`${DB_PATH}-journal`, { force: true });

  console.log("smoke-evidence-registries: ok");
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
