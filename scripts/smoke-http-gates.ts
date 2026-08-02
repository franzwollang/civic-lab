/**
 * HTTP-layer smoke: exercise Hono routes via app.request (not server/db only).
 * Covers §K gates + session auth: health, audit-logs auth, include_deleted auth,
 * soft-delete thread pre-check.
 * Run: DATABASE_URL="file:./smoke-http-gates.db" pnpm exec tsx scripts/smoke-http-gates.ts
 */
import { promises as fs } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { execFile } from "child_process";
import { promisify } from "util";
import { seedIfEmpty } from "../prisma/seed";
import { setPrisma } from "../server/db";
import { app } from "../server/index";
import { clearAllSessionsForTests } from "../server/auth/session";
import { loginAs, withSession } from "./smoke-session-helper";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "prisma", "smoke-http-gates.db");

async function json(res: Response) {
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text) as unknown };
  } catch {
    return { status: res.status, body: text };
  }
}

async function main() {
  process.env.DATABASE_URL = "file:./smoke-http-gates.db";
  await fs.rm(DB_PATH, { force: true });
  await fs.rm(`${DB_PATH}-journal`, { force: true });

  const prismaCli = path.join(ROOT, "node_modules", "prisma", "build", "index.js");
  await execFileAsync(
    process.execPath,
    [prismaCli, "db", "push", "--skip-generate"],
    { cwd: ROOT, env: { ...process.env }, maxBuffer: 10 * 1024 * 1024 },
  );

  const prisma = new PrismaClient();
  clearAllSessionsForTests();
  try {
    const seeded = await seedIfEmpty(prisma);
    if (seeded !== "seeded") throw new Error(`expected seeded, got ${seeded}`);
    setPrisma(prisma);

    const health = await json(await app.request("/api/health"));
    if (health.status !== 200 || (health.body as { ok?: boolean }).ok !== true) {
      throw new Error(`health failed: ${health.status} ${JSON.stringify(health.body)}`);
    }

    const auditAnon = await json(await app.request("/api/audit-logs"));
    if (auditAnon.status !== 401) {
      throw new Error(`audit anon expected 401, got ${auditAnon.status}`);
    }

    const eveCookie = await loginAs("user-eve");
    const bobCookie = await loginAs("user-bob");

    const auditOk = await json(
      await app.request("/api/audit-logs?limit=5", withSession(eveCookie)),
    );
    if (auditOk.status !== 200 || !Array.isArray(auditOk.body)) {
      throw new Error(`audit owner expected 200 array, got ${auditOk.status}`);
    }

    const auditContributor = await json(
      await app.request("/api/audit-logs", withSession(bobCookie)),
    );
    if (auditContributor.status !== 403) {
      throw new Error(`audit contributor expected 403, got ${auditContributor.status}`);
    }

    const threadId = "thread-us-voter-reg-rfc";
    const includeAnon = await json(
      await app.request(`/api/threads/${threadId}?include_deleted=1`),
    );
    if (includeAnon.status !== 401) {
      throw new Error(`include_deleted anon expected 401, got ${includeAnon.status}`);
    }

    const includeOk = await json(
      await app.request(
        `/api/threads/${threadId}?include_deleted=1`,
        withSession(eveCookie),
      ),
    );
    if (includeOk.status !== 200) {
      throw new Error(`include_deleted owner expected 200, got ${includeOk.status}`);
    }

    // Soft-delete wrong threadId must not mutate (404, post still live).
    const posts = await prisma.threadPost.findMany({
      where: { threadId, deletedAt: null },
      take: 1,
    });
    if (posts.length === 0) throw new Error("need a live post on leaf RFC thread");
    const postId = posts[0].postId;

    const wrongThread = await json(
      await app.request(
        `/api/threads/thread-us-multi-open/posts/${postId}/soft-delete`,
        withSession(eveCookie, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reason: "smoke" }),
        }),
      ),
    );
    if (wrongThread.status !== 404) {
      throw new Error(`wrong-thread soft-delete expected 404, got ${wrongThread.status}`);
    }
    const stillLive = await prisma.threadPost.findUnique({ where: { postId } });
    if (!stillLive || stillLive.deletedAt != null) {
      throw new Error("wrong-thread soft-delete mutated the post");
    }

    const areas = await json(await app.request("/api/areas"));
    if (areas.status !== 200 || !Array.isArray(areas.body) || areas.body.length < 2) {
      throw new Error(`areas failed: ${areas.status}`);
    }

    console.log("smoke-http-gates: ok");
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
