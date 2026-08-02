/**
 * Smoke: external OIDC swap-in for session login (mock mode, no network secrets).
 * Run: DATABASE_URL="file:./smoke-oidc.db" pnpm exec tsx scripts/smoke-oidc.ts
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
import {
  clearOidcPendingForTests,
  setOidcTokenExchangeForTests,
} from "../server/auth/oidc";
import { SESSION_AUTH_MODE, SESSION_COOKIE_NAME } from "../src/lib/sessionAuth";
import {
  DEFAULT_OIDC_SCOPES,
  OIDC_AUTH_PROVIDER,
  OIDC_ENV,
} from "../src/lib/oidcAuth";
import { withSession } from "./session-smoke-helper";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "prisma", "smoke-oidc.db");

async function json(res: Response) {
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text) as unknown };
  } catch {
    return { status: res.status, body: text };
  }
}

function cookieFrom(res: Response): string {
  const raw = res.headers.get("set-cookie") ?? "";
  const match = raw.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  if (!match) throw new Error(`missing ${SESSION_COOKIE_NAME} cookie`);
  return match[1];
}

function applyOidcEnv(): void {
  process.env[OIDC_ENV.issuer] = "https://oidc.test/realms/civic";
  process.env[OIDC_ENV.clientId] = "civic-lab-smoke";
  process.env[OIDC_ENV.clientSecret] = "smoke-only-not-a-real-secret";
  process.env[OIDC_ENV.redirectUri] =
    "http://localhost:8787/api/auth/oidc/callback";
  process.env[OIDC_ENV.mock] = "1";
  process.env[OIDC_ENV.subjectMap] = JSON.stringify({
    "alice@civic.test": "user-alice",
    "sub-eve": "user-eve",
  });
  process.env[OIDC_ENV.postLoginRedirect] = "http://localhost:5173/";
  process.env[OIDC_ENV.scopes] = DEFAULT_OIDC_SCOPES;
}

function clearOidcEnv(): void {
  for (const key of Object.values(OIDC_ENV)) {
    delete process.env[key];
  }
}

async function main() {
  process.env.DATABASE_URL = "file:./smoke-oidc.db";
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
  clearOidcPendingForTests();
  setOidcTokenExchangeForTests(null);
  clearOidcEnv();

  try {
    const seeded = await seedIfEmpty(prisma);
    if (seeded !== "seeded") throw new Error(`expected seeded, got ${seeded}`);
    setPrisma(prisma);

    const disabled = await json(await app.request("/api/auth/oidc/status"));
    if (
      disabled.status !== 200 ||
      (disabled.body as { enabled?: boolean }).enabled !== false
    ) {
      throw new Error("OIDC should be disabled without env");
    }

    const startDisabled = await json(
      await app.request("/api/auth/oidc/start?format=json"),
    );
    if (startDisabled.status !== 503) {
      throw new Error(
        `OIDC start without config expected 503, got ${startDisabled.status}`,
      );
    }

    applyOidcEnv();
    clearOidcPendingForTests();

    const status = await json(await app.request("/api/auth/oidc/status"));
    const statusBody = status.body as {
      enabled?: boolean;
      mock?: boolean;
      client_id?: string;
      issuer?: string;
    };
    if (
      status.status !== 200 ||
      !statusBody.enabled ||
      !statusBody.mock ||
      statusBody.client_id !== "civic-lab-smoke" ||
      !statusBody.issuer?.includes("oidc.test")
    ) {
      throw new Error(`bad OIDC status: ${JSON.stringify(status)}`);
    }
    // Never leak client_secret in public status.
    if (JSON.stringify(status.body).includes("smoke-only")) {
      throw new Error("OIDC status leaked client_secret");
    }

    const started = await json(
      await app.request(
        "/api/auth/oidc/start?format=json&login_hint=alice@civic.test",
        { headers: { Accept: "application/json" } },
      ),
    );
    const startBody = started.body as {
      authorization_url?: string;
      state?: string;
      provider?: string;
    };
    if (
      started.status !== 200 ||
      !startBody.authorization_url ||
      !startBody.state ||
      startBody.provider !== OIDC_AUTH_PROVIDER
    ) {
      throw new Error(`OIDC start failed: ${JSON.stringify(started)}`);
    }
    const authUrl = new URL(startBody.authorization_url);
    if (!authUrl.pathname.endsWith("/api/auth/oidc/callback")) {
      throw new Error(`mock authorize should target callback: ${authUrl}`);
    }
    if (authUrl.searchParams.get("state") !== startBody.state) {
      throw new Error("state mismatch on mock authorization_url");
    }
    if (!authUrl.searchParams.get("code")?.startsWith("mock:")) {
      throw new Error("mock code missing");
    }

    // Callback as JSON — binds session cookie as provider=oidc.
    const callback = await app.request(
      `/api/auth/oidc/callback?code=${encodeURIComponent(
        authUrl.searchParams.get("code")!,
      )}&state=${encodeURIComponent(startBody.state)}&format=json`,
      { headers: { Accept: "application/json" } },
    );
    const cb = await json(callback);
    const cbBody = cb.body as {
      user_id?: string;
      provider?: string;
      auth_mode?: string;
    };
    if (
      cb.status !== 200 ||
      cbBody.user_id !== "user-alice" ||
      cbBody.provider !== OIDC_AUTH_PROVIDER ||
      cbBody.auth_mode !== SESSION_AUTH_MODE
    ) {
      throw new Error(`OIDC callback failed: ${JSON.stringify(cb)}`);
    }
    const aliceCookie = cookieFrom(callback);

    const me = await json(
      await app.request("/api/auth/me", withSession(aliceCookie)),
    );
    const meBody = me.body as {
      user_id?: string;
      provider?: string;
      oidc?: { enabled?: boolean };
    };
    if (
      me.status !== 200 ||
      meBody.user_id !== "user-alice" ||
      meBody.provider !== OIDC_AUTH_PROVIDER ||
      !meBody.oidc?.enabled
    ) {
      throw new Error(`OIDC me failed: ${JSON.stringify(me)}`);
    }

    // OIDC session authorizes gated reads the same as prototype login.
    const audit = await json(
      await app.request("/api/audit-logs?limit=3", withSession(aliceCookie)),
    );
    // Alice is steward — may or may not pass steward gate; Owner path uses Eve.
    // Soft check: must not be anonymous 401 for "session missing".
    if (audit.status === 401) {
      const msg = JSON.stringify(audit.body);
      if (msg.includes("Session required")) {
        throw new Error("OIDC session cookie not accepted for gated route");
      }
    }

    // Second login as Eve via subject map key.
    clearOidcPendingForTests();
    const eveStart = await json(
      await app.request("/api/auth/oidc/start?format=json&login_hint=sub-eve"),
    );
    const eveAuth = new URL(
      (eveStart.body as { authorization_url: string }).authorization_url,
    );
    const eveCb = await app.request(
      `/api/auth/oidc/callback?code=${encodeURIComponent(
        eveAuth.searchParams.get("code")!,
      )}&state=${encodeURIComponent(
        eveAuth.searchParams.get("state")!,
      )}&format=json`,
      { headers: { Accept: "application/json" } },
    );
    const eveJson = await json(eveCb);
    if (
      eveJson.status !== 200 ||
      (eveJson.body as { user_id?: string }).user_id !== "user-eve" ||
      (eveJson.body as { provider?: string }).provider !== OIDC_AUTH_PROVIDER
    ) {
      throw new Error(`Eve OIDC login failed: ${JSON.stringify(eveJson)}`);
    }
    const eveCookie = cookieFrom(eveCb);
    const eveAudit = await json(
      await app.request("/api/audit-logs?limit=3", withSession(eveCookie)),
    );
    if (eveAudit.status !== 200 || !Array.isArray(eveAudit.body)) {
      throw new Error(
        `Owner OIDC session should read audit logs: ${JSON.stringify(eveAudit)}`,
      );
    }

    // Unmapped subject fails.
    clearOidcPendingForTests();
    const badStart = await json(
      await app.request(
        "/api/auth/oidc/start?format=json&login_hint=nobody@civic.test",
      ),
    );
    const badAuth = new URL(
      (badStart.body as { authorization_url: string }).authorization_url,
    );
    const badCb = await json(
      await app.request(
        `/api/auth/oidc/callback?code=${encodeURIComponent(
          badAuth.searchParams.get("code")!,
        )}&state=${encodeURIComponent(
          badAuth.searchParams.get("state")!,
        )}&format=json`,
        { headers: { Accept: "application/json" } },
      ),
    );
    if (badCb.status !== 400) {
      throw new Error(
        `unmapped subject expected 400, got ${badCb.status}: ${JSON.stringify(badCb)}`,
      );
    }

    // Expired/invalid state.
    const stale = await json(
      await app.request(
        "/api/auth/oidc/callback?code=mock:sub-eve&state=not-a-real-state&format=json",
        { headers: { Accept: "application/json" } },
      ),
    );
    if (stale.status !== 400) {
      throw new Error(`invalid state expected 400, got ${stale.status}`);
    }

    // Token-exchange override path (non-mock code) still maps subject.
    clearOidcPendingForTests();
    process.env[OIDC_ENV.mock] = "0";
    setOidcTokenExchangeForTests(async () => ({
      sub: "sub-eve",
      email: "eve@civic.test",
    }));
    const overrideStart = await json(
      await app.request("/api/auth/oidc/start?format=json&login_hint=sub-eve"),
    );
    // Non-mock start points at external authorize URL — synthesize callback
    // with the pending state from JSON (start still returns state).
    const overrideState = (overrideStart.body as { state: string }).state;
    const overrideAuthUrl = (overrideStart.body as { authorization_url: string })
      .authorization_url;
    if (!overrideAuthUrl.includes("/authorize")) {
      throw new Error(`expected external authorize URL, got ${overrideAuthUrl}`);
    }
    const overrideCb = await json(
      await app.request(
        `/api/auth/oidc/callback?code=synthetic-code&state=${encodeURIComponent(
          overrideState,
        )}&format=json`,
        { headers: { Accept: "application/json" } },
      ),
    );
    if (
      overrideCb.status !== 200 ||
      (overrideCb.body as { user_id?: string }).user_id !== "user-eve"
    ) {
      throw new Error(
        `token exchange override failed: ${JSON.stringify(overrideCb)}`,
      );
    }

    console.log("smoke-oidc: OK");
  } finally {
    setOidcTokenExchangeForTests(null);
    clearOidcPendingForTests();
    clearOidcEnv();
    clearAllSessionsForTests();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
