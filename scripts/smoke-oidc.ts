/**
 * Smoke: external OIDC swap-in for session login (mock mode, no network secrets).
 * Also covers JWKS id_token verify with a local RSA key (no live IdP).
 * Run: DATABASE_URL="file:./smoke-oidc.db" pnpm exec tsx scripts/smoke-oidc.ts
 */
import { promises as fs } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { execFile } from "child_process";
import { promisify } from "util";
import * as jose from "jose";
import { seedIfEmpty } from "../prisma/seed";
import { setPrisma } from "../server/db";
import { app } from "../server/index";
import { clearAllSessionsForTests } from "../server/auth/session";
import {
  clearOidcPendingForTests,
  peekOidcPendingNonceForTests,
  setOidcTokenEndpointForTests,
  setOidcTokenExchangeForTests,
} from "../server/auth/oidc";
import { setOidcJwksHooksForTests } from "../server/auth/oidcJwks";
import { SESSION_AUTH_MODE } from "../src/lib/sessionAuth";
import {
  DEFAULT_OIDC_SCOPES,
  OIDC_AUTH_PROVIDER,
  OIDC_ENV,
} from "../src/lib/oidcAuth";
import {
  assertOidcIdTokenClaims,
  audienceIncludes,
} from "../src/lib/oidcJwks";
import { cookieHeaderFromResponse, withSession } from "./session-smoke-helper";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "prisma", "smoke-oidc.db");
const SMOKE_JWKS_URI =
  "https://oidc.test/realms/civic/protocol/openid-connect/certs";
const SMOKE_ISSUER = "https://oidc.test/realms/civic";
const SMOKE_CLIENT_ID = "civic-lab-smoke";
const SMOKE_KID = "smoke-rsa-1";

async function json(res: Response) {
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text) as unknown };
  } catch {
    return { status: res.status, body: text };
  }
}

function applyOidcEnv(): void {
  process.env[OIDC_ENV.issuer] = SMOKE_ISSUER;
  process.env[OIDC_ENV.clientId] = SMOKE_CLIENT_ID;
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
  delete process.env[OIDC_ENV.jwksUri];
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
  setOidcTokenEndpointForTests(null);
  setOidcJwksHooksForTests(null);
  clearOidcEnv();

  try {
    const seeded = await seedIfEmpty(prisma);
    if (seeded !== "seeded") throw new Error(`expected seeded, got ${seeded}`);
    setPrisma(prisma);

    // --- Claim helper unit checks (no network) ---
    if (!audienceIncludes("civic-lab-smoke", "civic-lab-smoke")) {
      throw new Error("audienceIncludes string failed");
    }
    if (!audienceIncludes(["a", "civic-lab-smoke"], "civic-lab-smoke")) {
      throw new Error("audienceIncludes array failed");
    }
    try {
      assertOidcIdTokenClaims({
        payload: {
          sub: "x",
          iss: SMOKE_ISSUER,
          aud: "wrong",
          exp: Math.floor(Date.now() / 1000) + 60,
        },
        issuer: SMOKE_ISSUER,
        client_id: SMOKE_CLIENT_ID,
      });
      throw new Error("expected aud mismatch to throw");
    } catch (err) {
      if (!(err instanceof Error) || !err.message.includes("aud mismatch")) {
        throw err;
      }
    }

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
      jwks_uri?: string | null;
    };
    if (
      status.status !== 200 ||
      !statusBody.enabled ||
      !statusBody.mock ||
      statusBody.client_id !== "civic-lab-smoke" ||
      !statusBody.issuer?.includes("oidc.test") ||
      statusBody.jwks_uri != null
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
    const aliceCookie = cookieHeaderFromResponse(callback);
    if (!aliceCookie) throw new Error("OIDC callback missing session cookie");

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
    const eveCookie = cookieHeaderFromResponse(eveCb);
    if (!eveCookie) throw new Error("Eve OIDC callback missing session cookie");
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

    // --- JWKS production path (local RSA key; no live IdP) ---
    setOidcTokenExchangeForTests(null);
    clearOidcPendingForTests();
    const { privateKey, publicKey } = await jose.generateKeyPair("RS256");
    const publicJwk = await jose.exportJWK(publicKey);
    publicJwk.kid = SMOKE_KID;
    publicJwk.alg = "RS256";
    publicJwk.use = "sig";
    const jwksDoc = { keys: [publicJwk] };

    process.env[OIDC_ENV.jwksUri] = SMOKE_JWKS_URI;
    setOidcJwksHooksForTests({
      fetchJwks: async (uri) => {
        if (uri !== SMOKE_JWKS_URI) {
          throw new Error(`unexpected jwks uri ${uri}`);
        }
        return jwksDoc;
      },
    });

    const jwksStatus = await json(await app.request("/api/auth/oidc/status"));
    if (
      (jwksStatus.body as { jwks_uri?: string | null }).jwks_uri !==
      SMOKE_JWKS_URI
    ) {
      throw new Error(
        `status should expose OIDC_JWKS_URI: ${JSON.stringify(jwksStatus)}`,
      );
    }

    const jwksStart = await json(
      await app.request("/api/auth/oidc/start?format=json&login_hint=sub-eve"),
    );
    const jwksState = (jwksStart.body as { state: string }).state;
    const nonce = peekOidcPendingNonceForTests(jwksState);
    if (!nonce) throw new Error("pending nonce missing for JWKS smoke");

    setOidcTokenEndpointForTests(async () => {
      const id_token = await new jose.SignJWT({
        sub: "sub-eve",
        email: "eve@civic.test",
        nonce,
      })
        .setProtectedHeader({ alg: "RS256", kid: SMOKE_KID })
        .setIssuer(SMOKE_ISSUER)
        .setAudience(SMOKE_CLIENT_ID)
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(privateKey);
      return { id_token };
    });

    const jwksCb = await json(
      await app.request(
        `/api/auth/oidc/callback?code=auth-code-jwks&state=${encodeURIComponent(
          jwksState,
        )}&format=json`,
        { headers: { Accept: "application/json" } },
      ),
    );
    if (
      jwksCb.status !== 200 ||
      (jwksCb.body as { user_id?: string }).user_id !== "user-eve" ||
      (jwksCb.body as { provider?: string }).provider !== OIDC_AUTH_PROVIDER
    ) {
      throw new Error(`JWKS verify login failed: ${JSON.stringify(jwksCb)}`);
    }

    // Bad signature (different key) must fail.
    clearOidcPendingForTests();
    const { privateKey: otherKey } = await jose.generateKeyPair("RS256");
    const badStart2 = await json(
      await app.request("/api/auth/oidc/start?format=json&login_hint=sub-eve"),
    );
    const badState2 = (badStart2.body as { state: string }).state;
    const badNonce = peekOidcPendingNonceForTests(badState2)!;
    setOidcTokenEndpointForTests(async () => {
      const id_token = await new jose.SignJWT({
        sub: "sub-eve",
        nonce: badNonce,
      })
        .setProtectedHeader({ alg: "RS256", kid: SMOKE_KID })
        .setIssuer(SMOKE_ISSUER)
        .setAudience(SMOKE_CLIENT_ID)
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(otherKey);
      return { id_token };
    });
    const badSig = await json(
      await app.request(
        `/api/auth/oidc/callback?code=bad-sig&state=${encodeURIComponent(
          badState2,
        )}&format=json`,
        { headers: { Accept: "application/json" } },
      ),
    );
    if (badSig.status !== 400) {
      throw new Error(
        `bad JWKS signature expected 400, got ${badSig.status}: ${JSON.stringify(badSig)}`,
      );
    }
    const badMsg = JSON.stringify(badSig.body);
    if (
      !badMsg.includes("JWKS") &&
      !badMsg.includes("signature") &&
      !badMsg.includes("verify")
    ) {
      throw new Error(
        `bad signature error should mention JWKS/verify: ${badMsg}`,
      );
    }

    // Nonce mismatch must fail.
    clearOidcPendingForTests();
    const nonceStart = await json(
      await app.request("/api/auth/oidc/start?format=json&login_hint=sub-eve"),
    );
    const nonceState = (nonceStart.body as { state: string }).state;
    setOidcTokenEndpointForTests(async () => {
      const id_token = await new jose.SignJWT({
        sub: "sub-eve",
        nonce: "not-the-pending-nonce",
      })
        .setProtectedHeader({ alg: "RS256", kid: SMOKE_KID })
        .setIssuer(SMOKE_ISSUER)
        .setAudience(SMOKE_CLIENT_ID)
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(privateKey);
      return { id_token };
    });
    const nonceCb = await json(
      await app.request(
        `/api/auth/oidc/callback?code=bad-nonce&state=${encodeURIComponent(
          nonceState,
        )}&format=json`,
        { headers: { Accept: "application/json" } },
      ),
    );
    if (nonceCb.status !== 400) {
      throw new Error(
        `nonce mismatch expected 400, got ${nonceCb.status}: ${JSON.stringify(nonceCb)}`,
      );
    }
    if (!JSON.stringify(nonceCb.body).includes("nonce")) {
      throw new Error(
        `nonce mismatch should mention nonce: ${JSON.stringify(nonceCb)}`,
      );
    }

    console.log("smoke-oidc: OK");
  } finally {
    setOidcTokenExchangeForTests(null);
    setOidcTokenEndpointForTests(null);
    setOidcJwksHooksForTests(null);
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
