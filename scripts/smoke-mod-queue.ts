/**
 * Smoke: CONCEPT §9.4 / §8.3 moderation queue helpers + API feed.
 * Run: DATABASE_URL="file:./smoke-mod-queue.db" pnpm exec tsx scripts/smoke-mod-queue.ts
 */
import { promises as fs } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { execFile } from "child_process";
import { promisify } from "util";
import { seedIfEmpty } from "../prisma/seed";
import {
  setPrisma,
  createThreadPost,
  softDeleteThreadPost,
  listAuditLogs,
  listFindings,
  listAdjudicationQueue,
  getThread,
} from "../server/db";
import { app } from "../server/index";
import { getPrototypeUser } from "../src/app/lib/prototype-users";
import { userHasCapability } from "../src/app/lib/role-affordances";
import {
  canAccessModQueue,
  defaultModQueueTab,
  filterSoftDeleteAuditsForActor,
  findingThreadHref,
  modQueueTabsForUser,
  parseSoftDeletePayload,
  softDeleteThreadHref,
} from "../src/lib/modQueue";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "prisma", "smoke-mod-queue.db");

async function main() {
  const alice = getPrototypeUser("user-alice")!;
  const bob = getPrototypeUser("user-bob")!;
  const eve = getPrototypeUser("user-eve")!;
  const frank = getPrototypeUser("user-frank")!;

  if (!canAccessModQueue(alice) || !canAccessModQueue(eve)) {
    throw new Error("steward/Owner must access mod queue");
  }
  if (!canAccessModQueue(frank)) {
    throw new Error("adjudicator must access mod queue");
  }
  if (canAccessModQueue(bob)) {
    throw new Error("contributor must not access mod queue");
  }

  const aliceTabs = modQueueTabsForUser(alice);
  if (
    !aliceTabs.includes("deleted-posts") ||
    !aliceTabs.includes("open-findings") ||
    !aliceTabs.includes("adjudication")
  ) {
    throw new Error(`Alice tabs incomplete: ${aliceTabs.join(",")}`);
  }
  const frankTabs = modQueueTabsForUser(frank);
  if (frankTabs.includes("deleted-posts") || frankTabs.includes("open-findings")) {
    throw new Error("Frank must not get audit tabs");
  }
  if (!frankTabs.includes("adjudication")) {
    throw new Error("Frank must get adjudication tab");
  }
  if (defaultModQueueTab(frank) !== "adjudication") {
    throw new Error("Frank default tab should be adjudication");
  }
  if (!userHasCapability(frank, "adjudicate_claims")) {
    throw new Error("Frank adjudicate_claims");
  }

  const href = findingThreadHref({
    finding_id: "finding-x",
    thread_id: "thread-y",
  });
  if (href !== "/thread/thread-y#finding-finding-x") {
    throw new Error(`bad finding href ${href}`);
  }

  process.env.DATABASE_URL = "file:./smoke-mod-queue.db";
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

    const openFindings = await listFindings({ status: "open" });
    if (openFindings.length < 1) {
      throw new Error("expected seeded open findings");
    }
    const critical = openFindings.filter((f) => f.severity === "critical");
    if (critical.length < 1) {
      throw new Error("expected at least one open critical finding");
    }

    const adjQueue = await listAdjudicationQueue();
    if (!adjQueue.some((c) => c.claim_id === "claim-us-nvra-coverage")) {
      throw new Error("seed adjudication queue should include claim-us-nvra-coverage");
    }

    const created = await createThreadPost({
      thread_id: "thread-us-multi-open",
      author_id: "user-bob",
      body: "Mod queue soft-delete subject",
      type: "comment",
    });
    if (!created.ok) {
      throw new Error(`create post failed: ${JSON.stringify(created)}`);
    }
    const postId = created.post.post_id;

    const deleted = await softDeleteThreadPost({
      thread_id: "thread-us-multi-open",
      post_id: postId,
      actor_id: "user-alice",
      reason: "mod-queue smoke",
    });
    if (!deleted.ok) {
      throw new Error(`soft-delete failed: ${JSON.stringify(deleted)}`);
    }

    const softAudits = await listAuditLogs({
      action: "post_soft_delete",
      limit: 50,
    });
    const forAlice = filterSoftDeleteAuditsForActor(softAudits, alice);
    const forEve = filterSoftDeleteAuditsForActor(softAudits, eve);
    if (forAlice.length < 1) {
      throw new Error("Alice should see Manual soft-delete audits");
    }
    const ourRow = forAlice.find((r) => r.subject_id === postId);
    if (!ourRow) throw new Error("missing soft-delete audit for smoke post");
    const payload = parseSoftDeletePayload(ourRow.payload);
    if (payload.thread_id !== "thread-us-multi-open") {
      throw new Error("payload thread_id mismatch");
    }
    if (payload.area_kind === "canon") {
      throw new Error("Manual delete should not be canon");
    }
    if (softDeleteThreadHref(payload) !== "/thread/thread-us-multi-open") {
      throw new Error("soft-delete href");
    }

    // Owner-only Canon soft-delete should be hidden from steward filter
    const canonPost = await createThreadPost({
      thread_id: "thread-canon-voting-open",
      author_id: "user-bob",
      body: "Canon soft-delete for filter test",
      type: "comment",
    });
    if (!canonPost.ok) {
      throw new Error(`canon post create failed: ${JSON.stringify(canonPost)}`);
    }
    const canonDel = await softDeleteThreadPost({
      thread_id: "thread-canon-voting-open",
      post_id: canonPost.post.post_id,
      actor_id: "user-eve",
      reason: "canon mod-queue smoke",
    });
    if (!canonDel.ok) {
      throw new Error(`Owner Canon soft-delete failed: ${JSON.stringify(canonDel)}`);
    }
    const softAfter = await listAuditLogs({
      action: "post_soft_delete",
      limit: 50,
    });
    const aliceAfter = filterSoftDeleteAuditsForActor(softAfter, alice);
    const eveAfter = filterSoftDeleteAuditsForActor(softAfter, eve);
    if (aliceAfter.some((r) => r.subject_id === canonPost.post.post_id)) {
      throw new Error("steward must not see Canon soft-deletes");
    }
    if (!eveAfter.some((r) => r.subject_id === canonPost.post.post_id)) {
      throw new Error("Owner must see Canon soft-deletes");
    }
    if (eveAfter.length < forEve.length + 1) {
      throw new Error("Owner soft-delete count should grow");
    }

    const withDeleted = await getThread("thread-us-multi-open", {
      include_deleted_posts: true,
    });
    const tomb = (withDeleted?.posts ?? []).find((p) => p.post_id === postId);
    if (!tomb?.deleted_at) {
      throw new Error("include_deleted should surface tombstone");
    }

    // HTTP: audit soft-delete feed gated by session
    const { loginAs, withSession } = await import("./smoke-session-helper");
    const bobCookie = await loginAs("user-bob");
    const aliceCookie = await loginAs("user-alice");

    const denyBob = await app.request(
      "/api/audit-logs?action=post_soft_delete&limit=10",
      withSession(bobCookie),
    );
    if (denyBob.status !== 403) {
      throw new Error(`Bob audit expected 403, got ${denyBob.status}`);
    }
    const okAlice = await app.request(
      "/api/audit-logs?action=post_soft_delete&limit=50",
      withSession(aliceCookie),
    );
    if (okAlice.status !== 200) {
      throw new Error(`Alice audit expected 200, got ${okAlice.status}`);
    }
    const aliceJson = (await okAlice.json()) as Array<{ subject_id: string }>;
    if (!aliceJson.some((r) => r.subject_id === postId)) {
      throw new Error("Alice HTTP audit missing Manual soft-delete");
    }

    const findingsHttp = await app.request("/api/findings?status=open");
    if (findingsHttp.status !== 200) {
      throw new Error(`findings HTTP ${findingsHttp.status}`);
    }
    const findingsJson = (await findingsHttp.json()) as unknown[];
    if (findingsJson.length < 1) {
      throw new Error("open findings HTTP empty");
    }

    const adjHttp = await app.request("/api/adjudication-queue");
    if (adjHttp.status !== 200) {
      throw new Error(`adjudication-queue HTTP ${adjHttp.status}`);
    }

    const includeDeleted = await app.request(
      `/api/threads/thread-us-multi-open?include_deleted=1`,
      withSession(aliceCookie),
    );
    if (includeDeleted.status !== 200) {
      throw new Error(`include_deleted HTTP ${includeDeleted.status}`);
    }

    console.log("smoke-mod-queue: ok");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
