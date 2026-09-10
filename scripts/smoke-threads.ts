/**
 * Smoke: M5 Thread / ThreadPost / ThreadTarget seed + API helpers.
 * Run: DATABASE_URL="file:./smoke-threads.db" pnpm exec tsx scripts/smoke-threads.ts
 */
import { promises as fs } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { execFile } from "child_process";
import { promisify } from "util";
import { seedIfEmpty } from "../prisma/seed";
import {
  setPrisma,
  getCollectionDashboard,
  getThread,
  listThreads,
  createThreadPost,
} from "../server/db";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "prisma", "smoke-threads.db");

async function main() {
  process.env.DATABASE_URL = "file:./smoke-threads.db";
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

    const all = await listThreads();
    if (all.length < 5) {
      throw new Error(`expected ≥5 seeded threads, got ${all.length}`);
    }

    const us = await listThreads({ homeDossierId: "us-voting-1" });
    if (us.length < 4) {
      throw new Error(`us-voting-1 threads: ${us.length}`);
    }
    const rfc = us.find((t) => t.state === "rfc");
    if (!rfc || rfc.merge_artifact_id !== "us-voter-reg") {
      throw new Error("RFC stub missing merge_artifact_id");
    }
    const mergedSeed = us.find((t) => t.thread_id === "thread-us-overview-merged");
    if (
      !mergedSeed ||
      mergedSeed.state !== "decided" ||
      mergedSeed.decision_outcome !== "merged"
    ) {
      throw new Error("seeded merged overview RFC missing for reputation signals");
    }

    const detail = await getThread("thread-us-provisional-open");
    if (!detail) throw new Error("thread-us-provisional-open missing");
    if (!detail.posts || detail.posts.length < 2) {
      throw new Error("provisional thread should include seeded posts");
    }
    if (!detail.targets || detail.targets.length < 2) {
      throw new Error("provisional thread should target dossier + artifact");
    }
    const kinds = new Set(detail.targets.map((t) => t.target_kind));
    if (!kinds.has("dossier") || !kinds.has("artifact")) {
      throw new Error(`bad target kinds: ${[...kinds].join(",")}`);
    }

    const sectionThread = await getThread("thread-canon-goals-section");
    if (!sectionThread) throw new Error("section thread missing");
    const sectionKinds = new Set(
      (sectionThread.targets ?? []).map((t) => t.target_kind),
    );
    if (!sectionKinds.has("section")) {
      throw new Error("section-targeted thread should include section target");
    }

    const reply = await createThreadPost({
      thread_id: "thread-us-provisional-open",
      author_id: "user-dave",
      body: "Smoke reply",
    });
    if (!reply.ok || reply.post.author_id !== "user-dave") {
      throw new Error("createThreadPost failed");
    }
    const after = await getThread("thread-us-provisional-open");
    if (!after?.posts || after.posts.length < 3) {
      throw new Error("reply not persisted");
    }

    const canonDash = await getCollectionDashboard("collection-canon");
    if (!canonDash || canonDash.open_threads.count < 1) {
      throw new Error("canon dashboard should count seeded open threads");
    }
    if ("deferred" in canonDash.open_threads) {
      throw new Error("Critical findings should no longer defer to M7");
    }

    const usDash = await getCollectionDashboard("collection-us");
    if (!usDash || usDash.open_threads.count < 2) {
      throw new Error("US dashboard should count open+rfc threads");
    }
    if (usDash.open_threads.critical_findings < 1) {
      throw new Error("US dashboard should count seeded Critical Finding");
    }

    const missing = await getThread("thread-nope");
    if (missing !== null) throw new Error("unknown thread should be null");

    console.log("smoke-threads: OK");
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
