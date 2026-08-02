/**
 * Smoke: reply composer author catalog + multi-author POST persistence.
 * Run: DATABASE_URL="file:./smoke-reply-composer.db" pnpm exec tsx scripts/smoke-reply-composer.ts
 */
import { promises as fs } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { execFile } from "child_process";
import { promisify } from "util";
import { seedIfEmpty } from "../prisma/seed";
import {
  setPrisma,
  getThread,
  createThreadPost,
} from "../server/db";
import {
  DEFAULT_PROTOTYPE_USER_ID,
  PROTOTYPE_USERS,
  formatUserLabel,
  getPrototypeUser,
} from "../src/app/lib/prototype-users";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "prisma", "smoke-reply-composer.db");

async function main() {
  process.env.DATABASE_URL = "file:./smoke-reply-composer.db";
  await fs.rm(DB_PATH, { force: true });
  await fs.rm(`${DB_PATH}-journal`, { force: true });

  if (PROTOTYPE_USERS.length < 5) {
    throw new Error("expected ≥5 prototype users for impersonation");
  }
  if (DEFAULT_PROTOTYPE_USER_ID !== "user-alice") {
    throw new Error("default acting user should be user-alice");
  }
  for (const id of [
    "user-alice",
    "user-bob",
    "user-carol",
    "user-dave",
    "user-eve",
  ]) {
    const u = getPrototypeUser(id);
    if (!u) throw new Error(`missing prototype user ${id}`);
    if (!formatUserLabel(u).includes(u.display_name)) {
      throw new Error(`bad label for ${id}`);
    }
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

    const threadId = "thread-us-provisional-open";
    const before = await getThread(threadId);
    if (!before?.posts) throw new Error("seed thread missing posts");
    const baseCount = before.posts.length;

    const authors = ["user-bob", "user-dave"] as const;
    for (const author_id of authors) {
      const post = await createThreadPost({
        thread_id: threadId,
        author_id,
        body: `Composer smoke from ${author_id}`,
        type: "comment",
      });
      if (!post.ok || post.post.author_id !== author_id) {
        throw new Error(`createThreadPost failed for ${author_id}`);
      }
      if (post.post.type !== "comment") {
        throw new Error(`expected comment type, got ${post.post.type}`);
      }
    }

    const after = await getThread(threadId);
    if (!after?.posts || after.posts.length !== baseCount + authors.length) {
      throw new Error(
        `expected ${baseCount + authors.length} posts, got ${after?.posts?.length}`,
      );
    }
    const last = after.posts[after.posts.length - 1];
    if (last.author_id !== "user-dave") {
      throw new Error("last reply should be from user-dave");
    }

    const missing = await createThreadPost({
      thread_id: "thread-nope",
      author_id: "user-alice",
      body: "should fail",
    });
    if (missing.ok || missing.error.code !== "not_found") {
      throw new Error("unknown thread should return not_found");
    }

    console.log("smoke-reply-composer: OK");
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
