/**
 * Smoke: CONCEPT §5 Claim table + profile legality.
 * Run: DATABASE_URL="file:./smoke-claims.db" pnpm exec tsx scripts/smoke-claims.ts
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
  getClaim,
  createClaim,
  getArtifact,
  getCollectionDashboard,
  resolveClaimOwnerContext,
} from "../server/db";
import {
  isProfileLegalForOwner,
  legalProfilesForOwner,
  looksLikeSingleStateSmuggle,
  validateClaimAgainstOwner,
} from "../src/lib/claimLegality";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "prisma", "smoke-claims.db");

async function main() {
  process.env.DATABASE_URL = "file:./smoke-claims.db";
  await fs.rm(DB_PATH, { force: true });
  await fs.rm(`${DB_PATH}-journal`, { force: true });

  // Pure legality matrix (no DB).
  const canon = { artifact_id: "x", area_kind: "canon", lane: null };
  const desc = {
    artifact_id: "x",
    area_kind: "manuals",
    lane: "descriptive",
  };
  const align = {
    artifact_id: "x",
    area_kind: "manuals",
    lane: "alignment",
  };
  const presc = {
    artifact_id: "x",
    area_kind: "manuals",
    lane: "prescriptive",
  };

  if (legalProfilesForOwner(canon).join() !== "empirical") {
    throw new Error("canon legal profiles");
  }
  if (legalProfilesForOwner(desc).join() !== "empirical") {
    throw new Error("descriptive legal profiles");
  }
  if (legalProfilesForOwner(align).join() !== "requirement") {
    throw new Error("alignment legal profiles");
  }
  if (legalProfilesForOwner(presc).length !== 0) {
    throw new Error("prescriptive should own no claims");
  }
  if (isProfileLegalForOwner(presc, "empirical")) {
    throw new Error("prescriptive must reject empirical");
  }
  if (
    !looksLikeSingleStateSmuggle(
      "US midterm elections will be administered by the FEC in 2026",
    )
  ) {
    throw new Error("anti-smuggle should flag US elections");
  }
  if (
    looksLikeSingleStateSmuggle(
      "OECD turnout averages remain between 60% and 80%",
    )
  ) {
    throw new Error("global turnout should not smuggle");
  }

  const badCanonScope = validateClaimAgainstOwner(canon, {
    profile: "empirical",
    text: "Something global",
    empirical_type: "fact",
  });
  if (badCanonScope.ok || badCanonScope.error.code !== "canon_requires_scope") {
    throw new Error("Canon empirical requires scope");
  }

  const smuggle = validateClaimAgainstOwner(canon, {
    profile: "empirical",
    text: "California secretary of state election certification timelines",
    empirical_type: "fact",
    scope: "global",
    resolution_criteria: "California election code filings",
  });
  if (smuggle.ok || smuggle.error.code !== "anti_smuggle_force_manual") {
    throw new Error("anti-smuggle should force Manual");
  }

  const needCite = validateClaimAgainstOwner(align, {
    profile: "requirement",
    text: "Must cite Canon",
    canon_citations: [],
  });
  if (
    needCite.ok ||
    needCite.error.code !== "requirement_requires_canon_citations"
  ) {
    throw new Error("requirement needs canon_citations");
  }

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

    const claims = await listClaims();
    if (claims.length < 3) {
      throw new Error(`expected ≥3 seeded claims, got ${claims.length}`);
    }
    const byId = await getClaim("claim-canon-turnout-trend");
    if (!byId || byId.profile !== "empirical" || byId.scope !== "global") {
      throw new Error("seeded canon claim missing/wrong");
    }
    const req = await getClaim("claim-us-align-canon-criteria");
    if (!req || req.canon_citations.length < 1) {
      throw new Error("seeded requirement claim missing citations");
    }

    const usOverview = await getArtifact("us-overview");
    if (usOverview?.lane !== "descriptive") {
      throw new Error("us-overview should be descriptive lane");
    }
    const usReg = await getArtifact("us-voter-reg");
    if (usReg?.lane !== "prescriptive") {
      throw new Error("us-voter-reg should be prescriptive lane");
    }
    const usAlign = await getArtifact("us-alignment");
    if (usAlign?.lane !== "alignment") {
      throw new Error("us-alignment should be alignment lane");
    }
    const canonArt = await getArtifact("page-001");
    if (canonArt?.lane != null) {
      throw new Error("Canon artifacts must have null lane");
    }

    const ownerCanon = await resolveClaimOwnerContext("page-001");
    if (!ownerCanon || ownerCanon.area_kind !== "canon") {
      throw new Error("page-001 owner context");
    }
    const ownerPresc = await resolveClaimOwnerContext("us-voter-reg");
    if (!ownerPresc || ownerPresc.lane !== "prescriptive") {
      throw new Error("us-voter-reg owner context");
    }

    // Illegal: empirical on Alignment
    const badAlign = await createClaim({
      artifact_id: "us-alignment",
      profile: "empirical",
      text: "Illegal empirical on alignment",
      empirical_type: "fact",
    });
    if (badAlign.ok || badAlign.error.code !== "illegal_profile") {
      throw new Error(`expected illegal_profile, got ${JSON.stringify(badAlign)}`);
    }

    // Illegal: any claim on Prescriptive
    const badPresc = await createClaim({
      artifact_id: "us-voter-reg",
      profile: "empirical",
      text: "Illegal on prescriptive",
      empirical_type: "fact",
    });
    if (badPresc.ok || badPresc.error.code !== "prescriptive_no_claims") {
      throw new Error(
        `expected prescriptive_no_claims, got ${JSON.stringify(badPresc)}`,
      );
    }

    // Illegal: requirement on Canon
    const badCanonReq = await createClaim({
      artifact_id: "page-001",
      profile: "requirement",
      text: "Illegal requirement on Canon",
      canon_citations: ["page-001"],
    });
    if (badCanonReq.ok || badCanonReq.error.code !== "illegal_profile") {
      throw new Error(
        `expected illegal_profile on Canon requirement, got ${JSON.stringify(badCanonReq)}`,
      );
    }

    // Illegal: Canon without scope
    const badScope = await createClaim({
      artifact_id: "page-001",
      profile: "empirical",
      text: "Missing scope",
      empirical_type: "fact",
    });
    if (badScope.ok || badScope.error.code !== "canon_requires_scope") {
      throw new Error(`expected canon_requires_scope, got ${JSON.stringify(badScope)}`);
    }

    // Illegal: anti-smuggle
    const badSmuggle = await createClaim({
      artifact_id: "page-001",
      profile: "empirical",
      text: "US House elections will use ranked choice in California by 2028",
      empirical_type: "forecast",
      scope: "global",
      probability: 0.4,
      preferred_sources: ["California secretary of state"],
    });
    if (
      badSmuggle.ok ||
      badSmuggle.error.code !== "anti_smuggle_force_manual"
    ) {
      throw new Error(
        `expected anti_smuggle_force_manual, got ${JSON.stringify(badSmuggle)}`,
      );
    }

    // Legal: Manual descriptive forecast
    const okDesc = await createClaim({
      artifact_id: "us-overview",
      profile: "empirical",
      text: "At least 40 US states will offer automatic voter registration by 2028.",
      empirical_type: "forecast",
      probability: 0.55,
      deadline: "2028-12-31T00:00:00.000Z",
      author_id: "user-alice",
    });
    if (!okDesc.ok) {
      throw new Error(`expected ok descriptive claim: ${JSON.stringify(okDesc)}`);
    }

    // Legal: Manual alignment requirement
    const okReq = await createClaim({
      artifact_id: "us-alignment",
      profile: "requirement",
      text: "Publish a Canon-cited gap analysis for provisional ballots.",
      canon_citations: ["page-001"],
      author_id: "user-alice",
    });
    if (!okReq.ok) {
      throw new Error(`expected ok requirement: ${JSON.stringify(okReq)}`);
    }

    // Legal: Canon empirical with scope
    const okCanon = await createClaim({
      artifact_id: "page-001",
      profile: "empirical",
      text: "Median effective number of parties in PR systems stays above 2.5 through 2030.",
      empirical_type: "forecast",
      scope: "global",
      probability: 0.6,
      deadline: "2030-12-31T00:00:00.000Z",
      author_id: "user-carol",
    });
    if (!okCanon.ok) {
      throw new Error(`expected ok canon claim: ${JSON.stringify(okCanon)}`);
    }

    const usDash = await getCollectionDashboard("collection-us");
    if (!usDash?.lane_coverage || usDash.lane_coverage.Alignment < 1) {
      throw new Error("US dashboard Alignment lane coverage");
    }
    if (
      !usDash.requirement_satisfaction ||
      usDash.requirement_satisfaction.total < 2
    ) {
      throw new Error("US requirement_satisfaction should include new claim");
    }

    const artClaims = await listClaims({ artifactId: "us-overview" });
    if (artClaims.length < 2) {
      throw new Error("us-overview should list seed + created claims");
    }

    console.log("smoke-claims: ok");
  } finally {
    await prisma.$disconnect();
    await fs.rm(DB_PATH, { force: true });
    await fs.rm(`${DB_PATH}-journal`, { force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
