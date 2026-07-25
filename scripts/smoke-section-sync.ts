/**
 * Smoke: Prisma Section sync-on-save + section ThreadTargets (M5).
 * Run: DATABASE_URL="file:./smoke-section-sync.db" pnpm exec tsx scripts/smoke-section-sync.ts
 */
import { promises as fs } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { execFile } from "child_process";
import { promisify } from "util";
import { seedIfEmpty } from "../prisma/seed";
import { sectionIdFor } from "../src/doc/sections";
import {
  setPrisma,
  listSections,
  getSection,
  createArtifactRevision,
  syncSectionsForArtifact,
  getThread,
} from "../server/db";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "prisma", "smoke-section-sync.db");

async function main() {
  process.env.DATABASE_URL = "file:./smoke-section-sync.db";
  await fs.rm(DB_PATH, { force: true });
  await fs.rm(`${DB_PATH}-journal`, { force: true });

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

    const sections = await listSections("page-001");
    if (sections.length < 2) {
      throw new Error(`page-001 should have ≥2 seeded sections, got ${sections.length}`);
    }
    const goalsId = sectionIdFor("page-001", "block-003");
    const goals = sections.find((s) => s.section_id === goalsId);
    if (!goals) throw new Error("sec_page-001__block-003 missing after seed");
    if (goals.stable_key !== "block-003") {
      throw new Error("stable_key mismatch");
    }
    if (!/goals/i.test(goals.title)) {
      throw new Error(`expected Goals title, got ${goals.title}`);
    }

    const byId = await getSection(goalsId);
    if (!byId || byId.artifact_id !== "page-001") {
      throw new Error("getSection failed");
    }

    const sectionThread = await getThread("thread-canon-goals-section");
    if (!sectionThread) throw new Error("section-targeted thread missing");
    const sectionTargets = (sectionThread.targets ?? []).filter(
      (t) => t.target_kind === "section",
    );
    if (sectionTargets.length !== 1 || sectionTargets[0].target_id !== goalsId) {
      throw new Error("seed thread should target sec_page-001__block-003");
    }

    // Sync-on-save: new revision with renamed heading + one removed heading.
    const content = [
      {
        type: "h2",
        id: "block-001",
        children: [{ text: "Voting systems overview (revised)" }],
      },
      {
        type: "h3",
        id: "block-003",
        children: [{ text: "Goals (narrowed)" }],
      },
      {
        type: "h3",
        id: "block-new",
        children: [{ text: "New section" }],
      },
      { type: "p", id: "p-1", children: [{ text: "body" }] },
    ];

    await createArtifactRevision({
      revision_id: "rev-smoke-section-sync",
      artifact_id: "page-001",
      author: "smoke",
      content_json: content,
    });

    const after = await listSections("page-001");
    const keys = new Set(after.map((s) => s.stable_key));
    if (!keys.has("block-001") || !keys.has("block-003") || !keys.has("block-new")) {
      throw new Error(`sync missing expected keys: ${[...keys].join(",")}`);
    }
    if (after.some((s) => s.stable_key === "block-002")) {
      throw new Error("removed heading should delete Section row");
    }
    const renamed = after.find((s) => s.stable_key === "block-003");
    if (!renamed || !/narrowed/i.test(renamed.title)) {
      throw new Error("title should update on sync");
    }
    // Section id stays stable across title edits.
    if (renamed.section_id !== goalsId) {
      throw new Error("section_id must remain stable when title changes");
    }

    // Explicit sync removes a heading and cleans section ThreadTargets.
    await syncSectionsForArtifact("page-001", [
      {
        type: "h2",
        id: "block-001",
        children: [{ text: "Only overview" }],
      },
    ]);
    const pruned = await listSections("page-001");
    if (pruned.length !== 1 || pruned[0].stable_key !== "block-001") {
      throw new Error("prune should leave only block-001");
    }
    const threadAfter = await getThread("thread-canon-goals-section");
    const stillHasSection = (threadAfter?.targets ?? []).some(
      (t) => t.target_kind === "section" && t.target_id === goalsId,
    );
    if (stillHasSection) {
      throw new Error("ThreadTarget for deleted section should be removed");
    }

    console.log(`smoke-section-sync: OK (${sections.length} seeded → sync/prune)`);
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
