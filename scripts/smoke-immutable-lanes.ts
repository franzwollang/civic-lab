/**
 * Smoke: CONCEPT §4 immutable Manual lanes — create require + PATCH reject
 * + soft composite label from cross-lane claim links.
 * Run: DATABASE_URL="file:./smoke-immutable-lanes.db" pnpm exec tsx scripts/smoke-immutable-lanes.ts
 */
import { promises as fs } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { execFile } from "child_process";
import { promisify } from "util";
import { seedIfEmpty } from "../prisma/seed";
import {
  setPrisma,
  createArtifact,
  updateArtifact,
  getArtifact,
  createClaim,
} from "../server/db";
import {
  computeSoftLaneLabel,
  validateLaneOnCreate,
  validateLaneOnPatch,
  displayLaneLabel,
} from "../src/lib/artifactLanes";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "prisma", "smoke-immutable-lanes.db");

async function main() {
  process.env.DATABASE_URL = "file:./smoke-immutable-lanes.db";
  await fs.rm(DB_PATH, { force: true });
  await fs.rm(`${DB_PATH}-journal`, { force: true });

  // Pure rules (no DB).
  const miss = validateLaneOnCreate("manuals", null);
  if (miss.ok || miss.error.code !== "manual_requires_lane") {
    throw new Error("manuals must require lane");
  }
  const badLane = validateLaneOnCreate("manuals", "bridge");
  if (badLane.ok || badLane.error.code !== "unknown_lane") {
    throw new Error("unknown lane must fail");
  }
  const canonLane = validateLaneOnCreate("canon", "descriptive");
  if (canonLane.ok || canonLane.error.code !== "canon_rejects_lane") {
    throw new Error("canon must reject lane");
  }
  const okCanon = validateLaneOnCreate("canon", null);
  if (!okCanon.ok || okCanon.lane !== null) {
    throw new Error("canon null lane ok");
  }
  const okManual = validateLaneOnCreate("manuals", "alignment");
  if (!okManual.ok || okManual.lane !== "alignment") {
    throw new Error("manual alignment ok");
  }
  const patchLane = validateLaneOnPatch({ lanePresentInPatch: true });
  if (patchLane.ok || patchLane.error.code !== "lane_immutable") {
    throw new Error("patch lane must be immutable");
  }
  if (!validateLaneOnPatch({ lanePresentInPatch: false }).ok) {
    throw new Error("patch without lane ok");
  }
  if (computeSoftLaneLabel("descriptive", ["prescriptive"]) !== "composite") {
    throw new Error("cross-lane soft label should be composite");
  }
  if (computeSoftLaneLabel("descriptive", ["descriptive"]) !== "descriptive") {
    throw new Error("same-lane remains primary");
  }
  if (displayLaneLabel("prescriptive") !== "Prescriptive") {
    throw new Error("display label");
  }

  const prismaCli = path.join(ROOT, "node_modules", "prisma", "build", "index.js");
  await execFileAsync(
    process.execPath,
    [prismaCli, "db", "push", "--skip-generate"],
    { cwd: ROOT, env: { ...process.env }, maxBuffer: 10 * 1024 * 1024 },
  );

  const prisma = new PrismaClient();
  setPrisma(prisma);
  try {
    await seedIfEmpty(prisma);

    // Manual create without lane → reject
    const noLane = await createArtifact({
      artifact_id: "smoke-manual-nolane",
      title: "No Lane",
      slug: "no-lane",
      dossier_id: "us-voting-1",
    });
    if (noLane.ok || noLane.error.code !== "manual_requires_lane") {
      throw new Error(
        `expected manual_requires_lane, got ${JSON.stringify(noLane)}`,
      );
    }

    // Canon create with lane → reject
    const canonWithLane = await createArtifact({
      artifact_id: "smoke-canon-lane",
      title: "Canon Lane",
      slug: "canon-lane",
      dossier_id: "electoral-1",
      lane: "descriptive",
    });
    if (canonWithLane.ok || canonWithLane.error.code !== "canon_rejects_lane") {
      throw new Error(
        `expected canon_rejects_lane, got ${JSON.stringify(canonWithLane)}`,
      );
    }

    // Canon create without lane → ok
    const canonOk = await createArtifact({
      artifact_id: "smoke-canon-ok",
      title: "Canon Ok",
      slug: "canon-ok",
      dossier_id: "electoral-1",
    });
    if (!canonOk.ok || canonOk.artifact.lane !== null) {
      throw new Error(`expected canon create ok: ${JSON.stringify(canonOk)}`);
    }

    // Manual create with lane → ok
    const manualOk = await createArtifact({
      artifact_id: "smoke-manual-desc",
      title: "Manual Descriptive",
      slug: "manual-desc",
      dossier_id: "us-voting-1",
      lane: "descriptive",
    });
    if (!manualOk.ok || manualOk.artifact.lane !== "descriptive") {
      throw new Error(`expected manual create: ${JSON.stringify(manualOk)}`);
    }

    // PATCH attempting to change lane → reject (even same value)
    const sameLane = await updateArtifact(
      "smoke-manual-desc",
      { lane: "descriptive" },
      { lanePresentInPatch: true },
    );
    if (sameLane.ok || sameLane.error.code !== "lane_immutable") {
      throw new Error(
        `expected lane_immutable (same), got ${JSON.stringify(sameLane)}`,
      );
    }
    const changeLane = await updateArtifact(
      "us-overview",
      { lane: "prescriptive" },
      { lanePresentInPatch: true },
    );
    if (changeLane.ok || changeLane.error.code !== "lane_immutable") {
      throw new Error(
        `expected lane_immutable (change), got ${JSON.stringify(changeLane)}`,
      );
    }

    // PATCH title without lane → ok; lane unchanged
    const titlePatch = await updateArtifact("smoke-manual-desc", {
      title: "Manual Descriptive (renamed)",
    });
    if (!titlePatch.ok || titlePatch.artifact.lane !== "descriptive") {
      throw new Error(`title patch failed: ${JSON.stringify(titlePatch)}`);
    }
    if (titlePatch.artifact.title !== "Manual Descriptive (renamed)") {
      throw new Error("title not updated");
    }

    // Soft composite: claim on descriptive linking to prescriptive artifact
    const claim = await createClaim({
      artifact_id: "smoke-manual-desc",
      profile: "empirical",
      text: "Composite soft-label probe fact about linked procedure.",
      empirical_type: "fact",
      links: [{ artifact_id: "us-voter-reg" }],
      author_id: "user-alice",
    });
    if (!claim.ok) {
      throw new Error(`claim create failed: ${JSON.stringify(claim)}`);
    }
    const enriched = await getArtifact("smoke-manual-desc");
    if (!enriched || enriched.lane_soft_label !== "composite") {
      throw new Error(
        `expected composite soft label, got ${JSON.stringify(enriched)}`,
      );
    }

    // Seeded Manual still has its lane; Canon page-001 has null
    const seeded = await getArtifact("us-overview");
    if (!seeded || seeded.lane !== "descriptive") {
      throw new Error("seeded us-overview lane");
    }
    const page001 = await getArtifact("page-001");
    if (!page001 || page001.lane !== null) {
      throw new Error("Canon page-001 must have null lane");
    }

    console.log("smoke-immutable-lanes: ok");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
