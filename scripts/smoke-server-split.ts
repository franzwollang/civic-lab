/**
 * Smoke: modular server/db + server/routes split — file presence, barrel imports, runtime DB.
 * Run: DATABASE_URL="file:./smoke-server-split.db" pnpm exec tsx scripts/smoke-server-split.ts
 */
import { promises as fs } from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { PrismaClient } from "@prisma/client";
import {
  appendAuditLog,
  createArtifact,
  createClaim,
  createFinding,
  getArtifact,
  getAttributions,
  getCollectionDashboard,
  getDossier,
  getPrisma,
  listAreas,
  listClaims,
  listDossiers,
  listFindings,
  listThreads,
  getThread,
  promoteThreadToRfc,
  decideThread,
  resolveMergeAuthorityForArtifact,
  listUserIdentities,
  searchCorpus,
  setPrisma,
} from "../server/db";
import { registerArtifactRoutes } from "../server/routes/artifacts";
import { registerClaimRoutes } from "../server/routes/claims";
import { registerCorpusRoutes } from "../server/routes/corpus";
import { registerFindingRoutes } from "../server/routes/findings";
import { registerHealthRoutes } from "../server/routes/health";
import { registerModerationRoutes } from "../server/routes/moderation";
import { registerThreadRoutes } from "../server/routes/threads";
import { registerUploadRoutes } from "../server/routes/uploads";
import { seedIfEmpty } from "../prisma/seed";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();

const REQUIRED_FILES = [
  "server/db/prisma.ts",
  "server/db/registries.ts",
  "server/db/search.ts",
  "server/db/moderationDb.ts",
  "server/db/identities.ts",
  "server/db/findingsDb.ts",
  "server/db/claimsDb.ts",
  "server/db/artifactsDb.ts",
  "server/db/threadsDb.ts",
  "server/db/corpusDb.ts",
  "server/routes/health.ts",
  "server/routes/uploads.ts",
  "server/routes/corpus.ts",
  "server/routes/moderation.ts",
  "server/routes/threads.ts",
  "server/routes/claims.ts",
  "server/routes/findings.ts",
  "server/routes/artifacts.ts",
];

async function main() {
  for (const rel of REQUIRED_FILES) {
    try {
      await fs.access(path.join(ROOT, rel));
    } catch {
      throw new Error(`missing module file: ${rel}`);
    }
  }

  if (typeof setPrisma !== "function" || typeof getPrisma !== "function") {
    throw new Error("prisma barrel exports missing");
  }
  if (typeof getAttributions !== "function" || typeof searchCorpus !== "function") {
    throw new Error("registry/search barrel exports missing");
  }
  if (typeof appendAuditLog !== "function" || typeof listUserIdentities !== "function") {
    throw new Error("moderation/identity barrel exports missing");
  }
  if (typeof listFindings !== "function" || typeof createFinding !== "function") {
    throw new Error("findingsDb barrel exports missing");
  }
  if (typeof listClaims !== "function" || typeof createClaim !== "function") {
    throw new Error("claimsDb barrel exports missing");
  }
  if (typeof getArtifact !== "function" || typeof createArtifact !== "function") {
    throw new Error("artifactsDb barrel exports missing");
  }
  if (
    typeof listThreads !== "function" ||
    typeof getThread !== "function" ||
    typeof promoteThreadToRfc !== "function" ||
    typeof decideThread !== "function" ||
    typeof resolveMergeAuthorityForArtifact !== "function"
  ) {
    throw new Error("threadsDb barrel exports missing");
  }
  if (
    typeof listAreas !== "function" ||
    typeof getCollectionDashboard !== "function" ||
    typeof listDossiers !== "function" ||
    typeof getDossier !== "function"
  ) {
    throw new Error("corpusDb barrel exports missing");
  }
  const findingsSrc = await fs.readFile(
    path.join(ROOT, "server/db/findingsDb.ts"),
    "utf8",
  );
  if (
    !findingsSrc.includes("export async function listFindings") ||
    !findingsSrc.includes("export async function createFinding") ||
    !findingsSrc.includes("export async function flagCandidateFinding")
  ) {
    throw new Error("findingsDb.ts must own Findings/Candidate Finding accessors");
  }
  const claimsSrc = await fs.readFile(
    path.join(ROOT, "server/db/claimsDb.ts"),
    "utf8",
  );
  if (
    !claimsSrc.includes("export async function listClaims") ||
    !claimsSrc.includes("export async function createClaim") ||
    !claimsSrc.includes("export async function adjudicateClaim") ||
    !claimsSrc.includes("export async function listAdjudicationQueue")
  ) {
    throw new Error("claimsDb.ts must own Claims/adjudication accessors");
  }
  const artifactsSrc = await fs.readFile(
    path.join(ROOT, "server/db/artifactsDb.ts"),
    "utf8",
  );
  if (
    !artifactsSrc.includes("export async function listArtifacts") ||
    !artifactsSrc.includes("export async function getArtifact") ||
    !artifactsSrc.includes("export async function createArtifact") ||
    !artifactsSrc.includes("export async function revertCanonArtifact") ||
    !artifactsSrc.includes("export async function syncSectionsForArtifact") ||
    !artifactsSrc.includes("export async function createArtifactRevision")
  ) {
    throw new Error("artifactsDb.ts must own Artifact/revision/section accessors");
  }
  const threadsSrc = await fs.readFile(
    path.join(ROOT, "server/db/threadsDb.ts"),
    "utf8",
  );
  if (
    !threadsSrc.includes("export async function listThreads") ||
    !threadsSrc.includes("export async function getThread") ||
    !threadsSrc.includes("export async function promoteThreadToRfc") ||
    !threadsSrc.includes("export async function decideThread") ||
    !threadsSrc.includes("export async function resolveMergeAuthorityForArtifact")
  ) {
    throw new Error("threadsDb.ts must own Thread/RFC/RevSet/decide accessors");
  }
  const corpusSrc = await fs.readFile(
    path.join(ROOT, "server/db/corpusDb.ts"),
    "utf8",
  );
  if (
    !corpusSrc.includes("export async function listAreas") ||
    !corpusSrc.includes("export async function getCollection") ||
    !corpusSrc.includes("export async function getCollectionDashboard") ||
    !corpusSrc.includes("export async function listDossiers") ||
    !corpusSrc.includes("export async function getDossier")
  ) {
    throw new Error("corpusDb.ts must own Area/Collection/Dossier/dashboard accessors");
  }
  const dbSrc = await fs.readFile(path.join(ROOT, "server/db.ts"), "utf8");
  if (/export async function listFindings/.test(dbSrc)) {
    throw new Error("listFindings must live in server/db/findingsDb.ts, not db.ts");
  }
  if (/export async function listClaims/.test(dbSrc)) {
    throw new Error("listClaims must live in server/db/claimsDb.ts, not db.ts");
  }
  if (/export async function listArtifacts/.test(dbSrc)) {
    throw new Error("listArtifacts must live in server/db/artifactsDb.ts, not db.ts");
  }
  if (/export async function getArtifact/.test(dbSrc)) {
    throw new Error("getArtifact must live in server/db/artifactsDb.ts, not db.ts");
  }
  if (/export async function listThreads/.test(dbSrc)) {
    throw new Error("listThreads must live in server/db/threadsDb.ts, not db.ts");
  }
  if (/export async function getThread/.test(dbSrc)) {
    throw new Error("getThread must live in server/db/threadsDb.ts, not db.ts");
  }
  if (/export async function promoteThreadToRfc/.test(dbSrc)) {
    throw new Error("promoteThreadToRfc must live in server/db/threadsDb.ts, not db.ts");
  }
  if (/export async function decideThread/.test(dbSrc)) {
    throw new Error("decideThread must live in server/db/threadsDb.ts, not db.ts");
  }
  if (/export async function listAreas/.test(dbSrc)) {
    throw new Error("listAreas must live in server/db/corpusDb.ts, not db.ts");
  }
  if (/export async function getCollectionDashboard/.test(dbSrc)) {
    throw new Error(
      "getCollectionDashboard must live in server/db/corpusDb.ts, not db.ts",
    );
  }
  if (/export async function listDossiers/.test(dbSrc)) {
    throw new Error("listDossiers must live in server/db/corpusDb.ts, not db.ts");
  }
  if (/export async function getDossier/.test(dbSrc)) {
    throw new Error("getDossier must live in server/db/corpusDb.ts, not db.ts");
  }
  if (!dbSrc.includes('from "./db/findingsDb"')) {
    throw new Error("server/db.ts must re-export findingsDb");
  }
  if (!dbSrc.includes('from "./db/claimsDb"')) {
    throw new Error("server/db.ts must re-export claimsDb");
  }
  if (!dbSrc.includes('from "./db/artifactsDb"')) {
    throw new Error("server/db.ts must re-export artifactsDb");
  }
  if (!dbSrc.includes('from "./db/threadsDb"')) {
    throw new Error("server/db.ts must re-export threadsDb");
  }
  if (!dbSrc.includes('from "./db/corpusDb"')) {
    throw new Error("server/db.ts must re-export corpusDb");
  }
  if (!dbSrc.includes("export async function createAcceptedRisk")) {
    throw new Error("createAcceptedRisk must remain in server/db.ts");
  }
  if (
    typeof registerArtifactRoutes !== "function" ||
    typeof registerCorpusRoutes !== "function" ||
    typeof registerHealthRoutes !== "function" ||
    typeof registerModerationRoutes !== "function" ||
    typeof registerUploadRoutes !== "function" ||
    typeof registerThreadRoutes !== "function" ||
    typeof registerClaimRoutes !== "function" ||
    typeof registerFindingRoutes !== "function"
  ) {
    throw new Error("route registrar exports missing");
  }

  const indexSrc = await fs.readFile(path.join(ROOT, "server/index.ts"), "utf8");
  if (!indexSrc.includes("registerArtifactRoutes")) {
    throw new Error("server/index.ts must register artifact routes");
  }
  if (
    /app\.(get|post|patch)\(\s*["'`]\/api\/artifacts/.test(indexSrc) ||
    /app\.(get|put)\(\s*["'`]\/api\/attributions/.test(indexSrc)
  ) {
    throw new Error(
      "artifact/attribution HTTP handlers must live in server/routes/artifacts.ts",
    );
  }

  const dbPath = path.join(ROOT, "prisma", "smoke-server-split.db");
  process.env.DATABASE_URL = "file:./smoke-server-split.db";
  await fs.rm(dbPath, { force: true });
  await fs.rm(`${dbPath}-journal`, { force: true });

  const prismaCli = path.join(ROOT, "node_modules", "prisma", "build", "index.js");
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

    const search = await searchCorpus("");
    if (search.hits.length !== 0 || search.query !== "") {
      throw new Error("empty searchCorpus must yield no hits");
    }

    const attributions = await getAttributions();
    if (typeof attributions.version !== "number" || !Array.isArray(attributions.items)) {
      throw new Error("getAttributions shape invalid");
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log("smoke-server-split: OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
