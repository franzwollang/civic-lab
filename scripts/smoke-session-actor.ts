/**
 * Smoke: prototype IdP-lite session→actor binding (no external OAuth secrets).
 * Run: DATABASE_URL="file:./smoke-session-actor.db" pnpm exec tsx scripts/smoke-session-actor.ts
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
import { SESSION_AUTH_MODE, SESSION_COOKIE_NAME } from "../src/lib/sessionAuth";
import { AUTH_MODE } from "../src/lib/identityPolicy";
import { loginAs, withSession } from "./session-smoke-helper";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "prisma", "smoke-session-actor.db");

async function json(res: Response) {
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text) as unknown };
  } catch {
    return { status: res.status, body: text };
  }
}

async function main() {
  if (AUTH_MODE !== SESSION_AUTH_MODE) {
    throw new Error(`AUTH_MODE expected ${SESSION_AUTH_MODE}, got ${AUTH_MODE}`);
  }

  process.env.DATABASE_URL = "file:./smoke-session-actor.db";
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

    const anonMe = await json(await app.request("/api/auth/me"));
    if (
      anonMe.status !== 200 ||
      (anonMe.body as { user_id?: unknown }).user_id !== null
    ) {
      throw new Error("anon /auth/me should return user_id null");
    }

    const unauthAudit = await json(await app.request("/api/audit-logs"));
    if (unauthAudit.status !== 401) {
      throw new Error(`anon audit expected 401, got ${unauthAudit.status}`);
    }

    // Spoof via query actor_id must no longer grant access.
    const spoofAudit = await json(
      await app.request("/api/audit-logs?actor_id=user-eve&limit=5"),
    );
    if (spoofAudit.status !== 401) {
      throw new Error(
        `spoof query actor_id expected 401, got ${spoofAudit.status}`,
      );
    }

    const eveCookie = await loginAs("user-eve");
    const me = await json(
      await app.request("/api/auth/me", withSession(eveCookie)),
    );
    if (
      me.status !== 200 ||
      (me.body as { user_id?: string }).user_id !== "user-eve" ||
      (me.body as { auth_mode?: string }).auth_mode !== SESSION_AUTH_MODE
    ) {
      throw new Error(`login me failed: ${JSON.stringify(me)}`);
    }

    const auditOk = await json(
      await app.request("/api/audit-logs?limit=5", withSession(eveCookie)),
    );
    if (auditOk.status !== 200 || !Array.isArray(auditOk.body)) {
      throw new Error(`Owner audit expected 200, got ${auditOk.status}`);
    }

    // Body actor_id spoof ignored — session is Bob (contributor), not Eve.
    const bobCookie = await loginAs("user-bob");
    const spoofRole = await json(
      await app.request(
        "/api/users/user-alice/roles",
        withSession(bobCookie, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actor_id: "user-eve",
            roles: ["owner", "contributor"],
          }),
        }),
      ),
    );
    if (spoofRole.status !== 403) {
      throw new Error(
        `body actor_id spoof should be 403 (session Bob), got ${spoofRole.status}`,
      );
    }

    const carolCookie = await loginAs("user-carol");
    const spoofRevert = await json(
      await app.request(
        "/api/artifacts/canon-about/revert",
        withSession(carolCookie, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actor_id: "user-eve" }),
        }),
      ),
    );
    if (spoofRevert.status !== 403) {
      throw new Error(
        `body actor_id spoof on revert expected 403, got ${spoofRevert.status}`,
      );
    }

    // Soft-delete without session → 401
    const posts = await prisma.threadPost.findMany({
      where: { threadId: "thread-us-voter-reg-rfc", deletedAt: null },
      take: 1,
    });
    if (posts.length === 0) throw new Error("need a live post");
    const postId = posts[0].postId;
    const unauthDelete = await json(
      await app.request(
        `/api/threads/thread-us-voter-reg-rfc/posts/${postId}/soft-delete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actor_id: "user-eve", reason: "no session" }),
        },
      ),
    );
    if (unauthDelete.status !== 401) {
      throw new Error(
        `unauth soft-delete expected 401, got ${unauthDelete.status}`,
      );
    }

    const logout = await json(
      await app.request(
        "/api/auth/logout",
        withSession(eveCookie, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        }),
      ),
    );
    if (logout.status !== 200) {
      throw new Error(`logout expected 200, got ${logout.status}`);
    }

    const unknown = await json(
      await app.request("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: "user-not-real" }),
      }),
    );
    if (unknown.status !== 404) {
      throw new Error(`unknown user login expected 404, got ${unknown.status}`);
    }

    if (!SESSION_COOKIE_NAME) throw new Error("cookie name missing");

    console.log("smoke-session-actor: OK");
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
