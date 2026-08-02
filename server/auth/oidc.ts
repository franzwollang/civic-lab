/**
 * External OIDC authorization-code swap-in (prototype-friendly).
 *
 * - Disabled unless issuer + client_id + client_secret + redirect_uri are set.
 * - `OIDC_MOCK=1` skips network token exchange (smoke / local demos).
 * - `OIDC_SUBJECT_MAP` JSON maps OIDC `sub` or email → prototype user_id.
 */
import { createHash, randomBytes } from "crypto";
import {
  DEFAULT_OIDC_SCOPES,
  OIDC_ENV,
  type OidcPublicStatus,
} from "../../src/lib/oidcAuth";
import { getPrototypeUser } from "../../src/app/lib/prototype-users";

export type OidcConfig = {
  issuer: string;
  client_id: string;
  client_secret: string;
  redirect_uri: string;
  scopes: string;
  mock: boolean;
  subject_map: Record<string, string>;
  post_login_redirect: string;
  authorization_endpoint: string;
  token_endpoint: string;
};

type PendingAuth = {
  nonce: string;
  code_verifier: string;
  created_at: number;
  login_hint?: string;
};

const pendingByState = new Map<string, PendingAuth>();
const PENDING_TTL_MS = 10 * 60 * 1000;

/** Test hook: replace token exchange / discovery without hitting the network. */
export type OidcTokenExchange = (input: {
  config: OidcConfig;
  code: string;
  code_verifier: string;
}) => Promise<{ sub: string; email?: string; preferred_username?: string }>;

let tokenExchangeOverride: OidcTokenExchange | null = null;

export function setOidcTokenExchangeForTests(
  fn: OidcTokenExchange | null,
): void {
  tokenExchangeOverride = fn;
}

export function clearOidcPendingForTests(): void {
  pendingByState.clear();
}

function trimEnv(name: string): string | undefined {
  const v = process.env[name];
  if (v == null) return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

function parseSubjectMap(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string" && v.trim()) out[k.trim()] = v.trim();
    }
    return out;
  } catch {
    return {};
  }
}

function base64Url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function pkceChallenge(verifier: string): string {
  return base64Url(createHash("sha256").update(verifier).digest());
}

function prunePending(): void {
  const now = Date.now();
  for (const [state, rec] of pendingByState) {
    if (now - rec.created_at > PENDING_TTL_MS) pendingByState.delete(state);
  }
}

/** Read live config from env (re-read each call so smokes can toggle). */
export function readOidcConfig(): OidcConfig | null {
  const issuer = trimEnv(OIDC_ENV.issuer);
  const client_id = trimEnv(OIDC_ENV.clientId);
  const client_secret = trimEnv(OIDC_ENV.clientSecret);
  const redirect_uri = trimEnv(OIDC_ENV.redirectUri);
  if (!issuer || !client_id || !client_secret || !redirect_uri) return null;

  const mock =
    trimEnv(OIDC_ENV.mock) === "1" ||
    trimEnv(OIDC_ENV.mock)?.toLowerCase() === "true";
  const scopes = trimEnv(OIDC_ENV.scopes) ?? DEFAULT_OIDC_SCOPES;
  const subject_map = parseSubjectMap(trimEnv(OIDC_ENV.subjectMap));
  const post_login_redirect =
    trimEnv(OIDC_ENV.postLoginRedirect) ?? "http://localhost:5173/";

  const issuerBase = issuer.replace(/\/+$/, "");
  return {
    issuer: issuerBase,
    client_id,
    client_secret,
    redirect_uri,
    scopes,
    mock,
    subject_map,
    post_login_redirect,
    authorization_endpoint: `${issuerBase}/authorize`,
    token_endpoint: `${issuerBase}/token`,
  };
}

export function oidcPublicStatus(): OidcPublicStatus {
  const cfg = readOidcConfig();
  if (!cfg) {
    return {
      enabled: false,
      mock: false,
      issuer: null,
      client_id: null,
      redirect_uri: null,
      scopes: DEFAULT_OIDC_SCOPES,
      authorization_endpoint: null,
    };
  }
  return {
    enabled: true,
    mock: cfg.mock,
    issuer: cfg.issuer,
    client_id: cfg.client_id,
    redirect_uri: cfg.redirect_uri,
    scopes: cfg.scopes,
    authorization_endpoint: cfg.authorization_endpoint,
  };
}

export function beginOidcAuthorization(loginHint?: string): {
  state: string;
  authorization_url: string;
} {
  const cfg = readOidcConfig();
  if (!cfg) {
    throw new Error("OIDC is not configured");
  }
  prunePending();
  const state = base64Url(randomBytes(24));
  const nonce = base64Url(randomBytes(16));
  const code_verifier = base64Url(randomBytes(32));
  pendingByState.set(state, {
    nonce,
    code_verifier,
    created_at: Date.now(),
    login_hint: loginHint,
  });

  if (cfg.mock) {
    // Loop back to our callback — no external IdP round-trip.
    // Prefer the login_hint as the mock subject (even when unmapped) so
    // callback can exercise subject-map failures; otherwise first map key.
    const subject =
      loginHint?.trim() ||
      Object.keys(cfg.subject_map)[0] ||
      "oidc-smoke-sub";
    const url = new URL(cfg.redirect_uri);
    url.searchParams.set("code", `mock:${subject}`);
    url.searchParams.set("state", state);
    return { state, authorization_url: url.toString() };
  }

  const url = new URL(cfg.authorization_endpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", cfg.client_id);
  url.searchParams.set("redirect_uri", cfg.redirect_uri);
  url.searchParams.set("scope", cfg.scopes);
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge", pkceChallenge(code_verifier));
  url.searchParams.set("code_challenge_method", "S256");
  if (loginHint) url.searchParams.set("login_hint", loginHint);
  return { state, authorization_url: url.toString() };
}

export function takePendingAuth(state: string): PendingAuth | null {
  prunePending();
  const pending = pendingByState.get(state) ?? null;
  if (pending) pendingByState.delete(state);
  return pending;
}

async function defaultTokenExchange(input: {
  config: OidcConfig;
  code: string;
  code_verifier: string;
}): Promise<{ sub: string; email?: string; preferred_username?: string }> {
  const { config, code, code_verifier } = input;
  if (config.mock || code.startsWith("mock:")) {
    const subject = code.startsWith("mock:") ? code.slice("mock:".length) : code;
    if (!subject) throw new Error("mock OIDC code missing subject");
    return { sub: subject, email: subject.includes("@") ? subject : undefined };
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirect_uri,
    client_id: config.client_id,
    client_secret: config.client_secret,
    code_verifier,
  });
  const res = await fetch(config.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OIDC token exchange failed (${res.status}): ${text}`);
  }
  const json = (await res.json()) as {
    id_token?: string;
    access_token?: string;
  };
  if (!json.id_token) {
    throw new Error("OIDC token response missing id_token");
  }
  // Prototype: decode JWT payload without signature verify (real deploy must
  // verify against JWKS). Documented limitation until a JWKS client is wired.
  const parts = json.id_token.split(".");
  if (parts.length < 2) throw new Error("malformed id_token");
  const payloadJson = Buffer.from(
    parts[1].replace(/-/g, "+").replace(/_/g, "/"),
    "base64",
  ).toString("utf8");
  const payload = JSON.parse(payloadJson) as {
    sub?: string;
    email?: string;
    preferred_username?: string;
  };
  if (!payload.sub) throw new Error("id_token missing sub");
  return {
    sub: payload.sub,
    email: payload.email,
    preferred_username: payload.preferred_username,
  };
}

export async function resolveOidcCallback(input: {
  code: string;
  state: string;
}): Promise<{ user_id: string; claims: { sub: string; email?: string } }> {
  const cfg = readOidcConfig();
  if (!cfg) throw new Error("OIDC is not configured");

  const pending = takePendingAuth(input.state);
  if (!pending) {
    throw new Error("invalid or expired OIDC state");
  }

  const exchange = tokenExchangeOverride ?? defaultTokenExchange;
  const claims = await exchange({
    config: cfg,
    code: input.code,
    code_verifier: pending.code_verifier,
  });

  const user_id = mapOidcSubjectToUserId(cfg, claims);
  if (!user_id) {
    throw new Error(
      `OIDC subject not mapped to a prototype user (sub=${claims.sub})`,
    );
  }
  if (!getPrototypeUser(user_id)) {
    throw new Error(`mapped user_id unknown: ${user_id}`);
  }
  return { user_id, claims: { sub: claims.sub, email: claims.email } };
}

export function mapOidcSubjectToUserId(
  cfg: OidcConfig,
  claims: { sub: string; email?: string; preferred_username?: string },
): string | null {
  const candidates = [
    claims.sub,
    claims.email,
    claims.preferred_username,
  ].filter((x): x is string => Boolean(x && x.trim()));
  for (const key of candidates) {
    const mapped = cfg.subject_map[key];
    if (mapped) return mapped;
  }
  // Allow direct prototype user id as mock subject for smoke convenience.
  if (getPrototypeUser(claims.sub)) return claims.sub;
  return null;
}
