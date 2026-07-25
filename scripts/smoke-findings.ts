/**
 * Smoke: CONCEPT §7.3 Findings + Collection Critical counts.
 * Run: DATABASE_URL="file:./smoke-findings.db" pnpm exec tsx scripts/smoke-findings.ts
 */
import { promises as fs } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { execFile } from "child_process";
import { promisify } from "util";
import { seedIfEmpty } from "../prisma/seed";
import {
  setPrisma,
  listFindings,
  getFinding,
  createFinding,
  getCollectionDashboard,
  listOpenCriticalFindingsForMerge,
} from "../server/db";
import {
  actorMayCreateFinding,
  isOpenCriticalFinding,
} from "../src/lib/findings";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "prisma", "smoke-findings.db");

async function main() {
  process.env.DATABASE_URL = "file:./smoke-findings.db";
  await fs.rm(DB_PATH, { force: true });
  await fs.rm(`${DB_PATH}-journal`, { force: true });

  if (!actorMayCreateFinding("user-dave")) {
    throw new Error("Dave (red_team) should create Findings");
  }
  if (actorMayCreateFinding("user-alice")) {
    throw new Error("Alice (steward) must not create Findings");
  }
  if (
    !isOpenCriticalFinding({ severity: "critical", status: "open" }) ||
    isOpenCriticalFinding({ severity: "critical", status: "mitigated" }) ||
    isOpenCriticalFinding({ severity: "high", status: "open" })
  ) {
    throw new Error("isOpenCriticalFinding logic wrong");
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
    const seeded = await seedIfEmpty(prisma);
    if (seeded !== "seeded") {
      throw new Error(`expected seeded, got ${seeded}`);
    }

    const all = await listFindings();
    if (all.length < 3) {
      throw new Error(`expected ≥3 seeded findings, got ${all.length}`);
    }

    const seededCritical = await getFinding("finding-us-voter-reg-critical");
    if (!seededCritical || seededCritical.severity !== "critical") {
      throw new Error("seeded critical finding missing");
    }
    if (seededCritical.targets.length < 2) {
      throw new Error("critical finding should have targets");
    }

    const usList = await listFindings({ collectionId: "collection-us" });
    if (usList.length < 2) {
      throw new Error("US collection should scope ≥2 findings");
    }

    const threadFindings = await listFindings({
      threadId: "thread-us-voter-reg-rfc",
    });
    if (threadFindings.length < 1) {
      throw new Error("RFC thread should list seeded Finding");
    }

    const blockers = await listOpenCriticalFindingsForMerge({
      threadId: "thread-us-voter-reg-rfc",
      mergeArtifactId: "us-voter-reg",
    });
    if (blockers.length < 1) {
      throw new Error("open Critical should block merge helper list");
    }
    if (!blockers.some((f) => f.finding_id === "finding-us-voter-reg-critical")) {
      throw new Error("seeded Critical should appear in merge blocker list");
    }

    const usDash = await getCollectionDashboard("collection-us");
    if (!usDash) throw new Error("US dashboard missing");
    if (usDash.open_threads.critical_findings < 1) {
      throw new Error("US dashboard should count open Critical findings");
    }
    if ("deferred" in usDash.open_threads) {
      throw new Error("open_threads should no longer defer Critical findings");
    }
    if (usDash.red_team.recent_count < 2) {
      throw new Error("US red_team.recent_count should include seeded findings");
    }
    if ("deferred" in usDash.red_team) {
      throw new Error("red_team should no longer defer M7");
    }

    const canonDash = await getCollectionDashboard("collection-canon");
    if (!canonDash || canonDash.red_team.recent_count < 1) {
      throw new Error("Canon should count seeded Finding");
    }
    if (canonDash.open_threads.critical_findings !== 0) {
      throw new Error("Canon seed Finding is med, not Critical");
    }

    const forbidden = await createFinding({
      thread_id: "thread-us-provisional-open",
      title: "Steward should not file",
      severity: "high",
      author_id: "user-alice",
    });
    if (forbidden.ok || forbidden.error.code !== "forbidden") {
      throw new Error("non-red-team create must be forbidden");
    }

    const created = await createFinding({
      finding_id: "finding-smoke-created",
      thread_id: "thread-canon-voting-open",
      title: "Smoke-created Finding",
      severity: "low",
      likelihood: "low",
      author_id: "user-dave",
      evidence: "smoke",
      attack_path: "n/a",
      targets: [
        { target_kind: "artifact", target_id: "page-001" },
        { target_kind: "thread", target_id: "thread-canon-voting-open" },
      ],
    });
    if (!created.ok) {
      throw new Error(`createFinding failed: ${JSON.stringify(created.error)}`);
    }
    if (created.finding.targets.length !== 2) {
      throw new Error("created Finding should persist targets");
    }

    const missingThread = await createFinding({
      thread_id: "thread-nope",
      title: "orphan",
      severity: "med",
      author_id: "user-dave",
    });
    if (missingThread.ok || missingThread.error.code !== "not_found") {
      throw new Error("missing thread must 404-style not_found");
    }

    console.log("smoke-findings: OK");
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
