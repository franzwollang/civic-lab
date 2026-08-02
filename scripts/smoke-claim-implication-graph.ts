/**
 * Smoke: CONCEPT §5.2 artifact-scoped model→forecast implication DAG UI.
 * Run: DATABASE_URL="file:./smoke-claim-implication-graph.db" pnpm exec tsx scripts/smoke-claim-implication-graph.ts
 */
import { promises as fs } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { execFile } from "child_process";
import { promisify } from "util";
import { seedIfEmpty } from "../prisma/seed";
import { setPrisma, listClaims } from "../server/db";
import {
  IMPLIES_FORECAST_KIND,
  buildImplicationGraph,
  hasImplicationEdges,
} from "../src/lib/claimImplications";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "prisma", "smoke-claim-implication-graph.db");

async function main() {
  process.env.DATABASE_URL = "file:./smoke-claim-implication-graph.db";
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

    const claims = await getArtifactClaims("page-001");
    if (!hasImplicationEdges(claims)) {
      throw new Error("page-001 seed should include model→forecast edges");
    }

    const graph = buildImplicationGraph(claims);
    if (graph.edges.length < 2) {
      throw new Error(
        `expected ≥2 implication edges on page-001, got ${graph.edges.length}`,
      );
    }
    for (const edge of graph.edges) {
      if (edge.kind !== IMPLIES_FORECAST_KIND) {
        throw new Error(`unexpected edge kind ${edge.kind}`);
      }
    }

    const model = graph.nodes.find((n) => n.claim_id === "claim-canon-enp-model");
    if (!model || model.role !== "model" || !model.present) {
      throw new Error("seed model node missing from graph");
    }
    const targets = new Set(
      graph.edges
        .filter((e) => e.from === "claim-canon-enp-model")
        .map((e) => e.to),
    );
    if (!targets.has("claim-canon-pr-enp-resolved")) {
      throw new Error("missing edge to claim-canon-pr-enp-resolved");
    }
    if (!targets.has("claim-canon-turnout-trend")) {
      throw new Error("missing edge to claim-canon-turnout-trend");
    }
    for (const tid of targets) {
      const node = graph.nodes.find((n) => n.claim_id === tid);
      if (!node || node.role !== "forecast" || !node.present) {
        throw new Error(`forecast node missing or stub: ${tid}`);
      }
    }

    // Stub target when forecast is not in the loaded set
    const stubGraph = buildImplicationGraph([
      {
        claim_id: "claim-local-model",
        text: "Local model",
        status: "open",
        profile: "empirical",
        empirical_type: "model",
        links: [
          { kind: IMPLIES_FORECAST_KIND, claim_id: "claim-missing-forecast" },
        ],
      },
    ]);
    const stub = stubGraph.nodes.find(
      (n) => n.claim_id === "claim-missing-forecast",
    );
    if (!stub || stub.present || stub.role !== "forecast") {
      throw new Error("expected stub forecast node for missing target");
    }

    // Empty when no model implications
    const empty = buildImplicationGraph(
      claims.filter((c) => c.empirical_type !== "model"),
    );
    if (empty.edges.length !== 0) {
      throw new Error("non-model claims must not produce implication edges");
    }

    const panel = await fs.readFile(
      path.join(ROOT, "src/app/components/artifact-claims-panel.tsx"),
      "utf8",
    );
    if (!panel.includes("ClaimImplicationGraph")) {
      throw new Error("ArtifactClaimsPanel must render ClaimImplicationGraph");
    }
    const graphUi = await fs.readFile(
      path.join(ROOT, "src/app/components/claim-implication-graph.tsx"),
      "utf8",
    );
    if (
      !graphUi.includes("data-testid=\"claim-implication-graph\"") ||
      !graphUi.includes("buildImplicationGraph")
    ) {
      throw new Error("implication graph UI missing markers");
    }

    console.log("smoke-claim-implication-graph: ok");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
