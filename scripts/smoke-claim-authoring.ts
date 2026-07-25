/**
 * Smoke: M6 claim authoring UX helpers + create paths used by the product UI.
 * Run: DATABASE_URL="file:./smoke-claim-authoring.db" pnpm exec tsx scripts/smoke-claim-authoring.ts
 */
import { promises as fs } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { execFile } from "child_process";
import { promisify } from "util";
import { seedIfEmpty } from "../prisma/seed";
import {
  setPrisma,
  listClaims,
  createClaim,
  getArtifact,
  getDossier,
} from "../server/db";
import {
  legalProfilesForOwner,
  validateClaimAgainstOwner,
} from "../src/lib/claimLegality";
import { buildClaimOwnerContext } from "../src/app/lib/claim-owner-context";
import type { ArtifactRow, DossierRow } from "../src/doc/types";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "prisma", "smoke-claim-authoring.db");

function asArtifactRow(
  row: Awaited<ReturnType<typeof getArtifact>>,
): ArtifactRow {
  if (!row) throw new Error("missing artifact");
  return row as ArtifactRow;
}

function asDossierRow(row: Awaited<ReturnType<typeof getDossier>>): DossierRow {
  if (!row) throw new Error("missing dossier");
  return row as DossierRow;
}

async function main() {
  process.env.DATABASE_URL = "file:./smoke-claim-authoring.db";
  await fs.rm(DB_PATH, { force: true });
  await fs.rm(`${DB_PATH}-journal`, { force: true });

  const prismaCli = path.join(
    ROOT,
    "node_modules",
    "prisma",
    "build",
    "index.js",
  );
  await execFileAsync(
    process.execPath,
    [prismaCli, "db", "push", "--skip-generate"],
    { cwd: ROOT, env: { ...process.env }, maxBuffer: 10 * 1024 * 1024 },
  );

  const prisma = new PrismaClient();
  setPrisma(prisma);
  try {
    const seeded = await seedIfEmpty(prisma);
    if (seeded !== "seeded") {
      throw new Error(`expected seeded, got ${seeded}`);
    }

    // Owner context: Manual descriptive (US overview).
    const usOverview = asArtifactRow(await getArtifact("us-overview"));
    const usDossier = asDossierRow(await getDossier("us-voting-1"));
    const descCtx = buildClaimOwnerContext(usOverview, usDossier);
    if (descCtx.area_kind !== "manuals" || descCtx.lane !== "descriptive") {
      throw new Error(
        `expected manuals/descriptive, got ${descCtx.area_kind}/${descCtx.lane}`,
      );
    }
    if (legalProfilesForOwner(descCtx).join() !== "empirical") {
      throw new Error("US overview should allow empirical only");
    }

    // Canon voting-systems.
    const canonPage = asArtifactRow(await getArtifact("page-001"));
    const canonDossier = asDossierRow(await getDossier("electoral-1"));
    const canonCtx = buildClaimOwnerContext(canonPage, canonDossier);
    if (canonCtx.area_kind !== "canon") {
      throw new Error(`expected canon, got ${canonCtx.area_kind}`);
    }
    if (legalProfilesForOwner(canonCtx).join() !== "empirical") {
      throw new Error("Canon should allow empirical only");
    }

    // Alignment requirement owner.
    const align = asArtifactRow(await getArtifact("us-alignment"));
    const alignCtx = buildClaimOwnerContext(align, usDossier);
    if (legalProfilesForOwner(alignCtx).join() !== "requirement") {
      throw new Error("alignment should allow requirement only");
    }

    // Prescriptive: no composer profiles.
    const presc = asArtifactRow(await getArtifact("us-voter-reg"));
    const prescCtx = buildClaimOwnerContext(presc, usDossier);
    if (legalProfilesForOwner(prescCtx).length !== 0) {
      throw new Error("prescriptive should own no claims");
    }
    const prescBlocked = validateClaimAgainstOwner(prescCtx, {
      profile: "empirical",
      text: "Should fail",
      empirical_type: "fact",
    });
    if (
      prescBlocked.ok ||
      prescBlocked.error.code !== "prescriptive_no_claims"
    ) {
      throw new Error("prescriptive create must be blocked");
    }

    // Seeded claims visible via list (product panel load path).
    const seededOverview = await listClaims({ artifactId: "us-overview" });
    if (!seededOverview.some((c) => c.claim_id === "claim-us-nvra-coverage")) {
      throw new Error("seeded NVRA claim missing on us-overview");
    }
    const seededCanon = await listClaims({ artifactId: "page-001" });
    if (!seededCanon.some((c) => c.claim_id === "claim-canon-turnout-trend")) {
      throw new Error("seeded Canon claim missing");
    }

    // Create empirical fact on Manual descriptive (composer happy path).
    const fact = await createClaim({
      claim_id: "claim-smoke-authoring-fact",
      artifact_id: "us-overview",
      profile: "empirical",
      text: "NVRA-covered agencies process a measurable share of voter registrations annually.",
      empirical_type: "fact",
      resolution_criteria: "Agency annual reports",
      preferred_sources: ["Election Assistance Commission"],
      author_id: "user-alice",
    });
    if (!fact.ok) {
      throw new Error(`fact create failed: ${JSON.stringify(fact.error)}`);
    }
    if (fact.claim.profile !== "empirical" || fact.claim.author_id !== "user-alice") {
      throw new Error("created fact shape");
    }

    // Create requirement on alignment.
    const req = await createClaim({
      claim_id: "claim-smoke-authoring-req",
      artifact_id: "us-alignment",
      profile: "requirement",
      text: "Manual Alignment procedures must cite Canon turnout measurement criteria.",
      canon_citations: ["page-001"],
      author_id: "user-bob",
    });
    if (!req.ok) {
      throw new Error(`requirement create failed: ${JSON.stringify(req.error)}`);
    }
    if (
      req.claim.profile !== "requirement" ||
      req.claim.canon_citations[0] !== "page-001"
    ) {
      throw new Error("created requirement shape");
    }

    // Create Canon empirical with scope.
    const canonClaim = await createClaim({
      claim_id: "claim-smoke-authoring-canon",
      artifact_id: "page-001",
      profile: "empirical",
      text: "OECD-average voter turnout stays between 60% and 80% through 2030.",
      empirical_type: "forecast",
      scope: "global",
      probability: 0.55,
      resolution_criteria: "IDEA / OECD turnout series",
      author_id: "user-carol",
    });
    if (!canonClaim.ok) {
      throw new Error(`canon create failed: ${JSON.stringify(canonClaim.error)}`);
    }
    if (
      canonClaim.claim.scope !== "global" ||
      canonClaim.claim.probability !== 0.55
    ) {
      throw new Error("created Canon forecast shape");
    }

    // Reject illegal: empirical on alignment.
    const badAlign = await createClaim({
      artifact_id: "us-alignment",
      profile: "empirical",
      text: "Illegal empirical on alignment",
      empirical_type: "fact",
      author_id: "user-alice",
    });
    if (badAlign.ok || badAlign.error.code !== "illegal_profile") {
      throw new Error(
        `expected illegal_profile, got ${JSON.stringify(badAlign)}`,
      );
    }

    // Reject illegal: any claim on prescriptive.
    const badPresc = await createClaim({
      artifact_id: "us-voter-reg",
      profile: "empirical",
      text: "Illegal on prescriptive",
      empirical_type: "fact",
      author_id: "user-alice",
    });
    if (badPresc.ok || badPresc.error.code !== "prescriptive_no_claims") {
      throw new Error(
        `expected prescriptive_no_claims, got ${JSON.stringify(badPresc)}`,
      );
    }

    // Reject Canon without scope.
    const badCanon = await createClaim({
      artifact_id: "page-001",
      profile: "empirical",
      text: "Missing scope on Canon",
      empirical_type: "fact",
      author_id: "user-carol",
    });
    if (badCanon.ok || badCanon.error.code !== "canon_requires_scope") {
      throw new Error(
        `expected canon_requires_scope, got ${JSON.stringify(badCanon)}`,
      );
    }

    // Dossier aggregate: US voting claims after creates.
    const usArtifacts = ["us-overview", "us-alignment"];
    let total = 0;
    for (const id of usArtifacts) {
      total += (await listClaims({ artifactId: id })).length;
    }
    if (total < 3) {
      throw new Error(`expected ≥3 US claims after creates, got ${total}`);
    }

    console.log("smoke-claim-authoring: ok");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
