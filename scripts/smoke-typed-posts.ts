/**
 * Smoke: CONCEPT §7 typed finding/mitigation ThreadPost types.
 * Run: DATABASE_URL="file:./smoke-typed-posts.db" pnpm exec tsx scripts/smoke-typed-posts.ts
 */
import { promises as fs } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { execFile } from "child_process";
import { promisify } from "util";
import { seedIfEmpty } from "../prisma/seed";
import { setPrisma, createThreadPost, getThread } from "../server/db";
import { app } from "../server/index";
import {
  actorMayPostTypedFindingOrMitigation,
  postMatchesTimelineFilter,
} from "../src/lib/candidateFindings";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "prisma", "smoke-typed-posts.db");

async function main() {
  process.env.DATABASE_URL = "file:./smoke-typed-posts.db";
  await fs.rm(DB_PATH, { force: true });
  await fs.rm(`${DB_PATH}-journal`, { force: true });

  if (!actorMayPostTypedFindingOrMitigation("user-dave")) {
    throw new Error("Dave (red_team) should post typed finding/mitigation");
  }
  if (actorMayPostTypedFindingOrMitigation("user-alice")) {
    throw new Error("Alice (steward) must not post typed finding/mitigation");
  }

  // Filter helpers: finding posts appear under findings + findings_responses.
  if (
    !postMatchesTimelineFilter("finding", "findings") ||
    !postMatchesTimelineFilter("finding", "findings_responses") ||
    postMatchesTimelineFilter("comment", "findings") ||
    !postMatchesTimelineFilter("mitigation", "findings_responses") ||
    postMatchesTimelineFilter("mitigation", "findings") ||
    !postMatchesTimelineFilter("finding", "all")
  ) {
    throw new Error("typed-post timeline filter helpers wrong");
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

    const seedThread = await getThread("thread-us-voter-reg-rfc");
    if (!seedThread?.posts) throw new Error("RFC thread missing posts");
    const seededFinding = seedThread.posts.find(
      (p) => p.post_id === "post-us-reg-finding-1",
    );
    const seededMitigation = seedThread.posts.find(
      (p) => p.post_id === "post-us-reg-mitigation-1",
    );
    if (!seededFinding || seededFinding.type !== "finding") {
      throw new Error("seeded finding-typed post missing");
    }
    if (!seededMitigation || seededMitigation.type !== "mitigation") {
      throw new Error("seeded mitigation-typed post missing");
    }
    if (seededFinding.author_id !== "user-dave") {
      throw new Error("seeded finding note should be authored by Dave");
    }

    // Non-RT cannot create typed posts.
    const denied = await createThreadPost({
      thread_id: "thread-us-voter-reg-rfc",
      author_id: "user-alice",
      type: "finding",
      body: "Alice must not post a finding note",
    });
    if (denied.ok || denied.error.code !== "forbidden") {
      throw new Error("non-RT finding post must be forbidden");
    }

    const deniedMit = await createThreadPost({
      thread_id: "thread-us-voter-reg-rfc",
      author_id: "user-bob",
      type: "mitigation",
      body: "Bob must not post mitigation",
    });
    if (deniedMit.ok || deniedMit.error.code !== "forbidden") {
      throw new Error("non-RT mitigation post must be forbidden");
    }

    // RT create finding + mitigation; list via getThread + filter helpers.
    const finding = await createThreadPost({
      thread_id: "thread-us-multi-open",
      author_id: "user-dave",
      type: "finding",
      body: "Smoke typed finding note on multi-open thread.",
      post_id: "post-smoke-typed-finding-1",
    });
    if (!finding.ok || finding.post.type !== "finding") {
      throw new Error(`finding create failed: ${JSON.stringify(finding)}`);
    }

    const mitigation = await createThreadPost({
      thread_id: "thread-us-multi-open",
      author_id: "user-dave",
      type: "mitigation",
      body: "Smoke typed mitigation response.",
      post_id: "post-smoke-typed-mitigation-1",
    });
    if (!mitigation.ok || mitigation.post.type !== "mitigation") {
      throw new Error(`mitigation create failed: ${JSON.stringify(mitigation)}`);
    }

    const listed = await getThread("thread-us-multi-open");
    const posts = listed?.posts ?? [];
    const findingListed = posts.find(
      (p) => p.post_id === "post-smoke-typed-finding-1",
    );
    const mitListed = posts.find(
      (p) => p.post_id === "post-smoke-typed-mitigation-1",
    );
    if (!findingListed || !mitListed) {
      throw new Error("typed posts missing from thread list");
    }

    const findingsOnly = posts.filter((p) =>
      postMatchesTimelineFilter(p.type, "findings"),
    );
    const findingsResponses = posts.filter((p) =>
      postMatchesTimelineFilter(p.type, "findings_responses"),
    );
    if (!findingsOnly.some((p) => p.post_id === findingListed.post_id)) {
      throw new Error("findings filter should include typed finding posts");
    }
    if (findingsOnly.some((p) => p.type === "mitigation")) {
      throw new Error("findings filter must not include mitigation posts");
    }
    if (
      !findingsResponses.some((p) => p.post_id === findingListed.post_id) ||
      !findingsResponses.some((p) => p.post_id === mitListed.post_id)
    ) {
      throw new Error(
        "findings_responses filter should include finding + mitigation",
      );
    }

    // HTTP: RT create finding; non-RT 403; invalid type 400.
    const httpOk = await app.request("/api/threads/thread-us-multi-open/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        author_id: "user-dave",
        type: "finding",
        body: "HTTP typed finding note",
        post_id: "post-smoke-typed-finding-http",
      }),
    });
    if (httpOk.status !== 201) {
      throw new Error(`HTTP RT finding expected 201, got ${httpOk.status}`);
    }
    const httpBody = (await httpOk.json()) as { type?: string };
    if (httpBody.type !== "finding") {
      throw new Error("HTTP finding response type wrong");
    }

    const httpForbid = await app.request(
      "/api/threads/thread-us-multi-open/posts",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          author_id: "user-carol",
          type: "mitigation",
          body: "HTTP non-RT mitigation",
        }),
      },
    );
    if (httpForbid.status !== 403) {
      throw new Error(`HTTP non-RT typed post expected 403, got ${httpForbid.status}`);
    }

    const httpBad = await app.request("/api/threads/thread-us-multi-open/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        author_id: "user-dave",
        type: "not_a_type",
        body: "bad",
      }),
    });
    if (httpBad.status !== 400) {
      throw new Error(`HTTP invalid type expected 400, got ${httpBad.status}`);
    }

    console.log("smoke-typed-posts: ok");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
