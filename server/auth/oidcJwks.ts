/**
 * JWKS-backed OIDC id_token signature verification (jose).
 *
 * Production path: discover `jwks_uri` (or use `OIDC_JWKS_URI`) → verify RS/ES
 * JWT → claim checks in `src/lib/oidcJwks.ts`. Mock OIDC never reaches here.
 */
import * as jose from "jose";
import {
  assertOidcIdTokenClaims,
  type OidcIdTokenPayload,
} from "../../src/lib/oidcJwks";
import { OIDC_ENV } from "../../src/lib/oidcAuth";

/** Minimal config surface needed for JWKS verify (avoids import cycle with oidc.ts). */
export type OidcJwksConfig = {
  issuer: string;
  client_id: string;
  jwks_uri?: string;
};

export type VerifiedOidcClaims = {
  sub: string;
  email?: string;
  preferred_username?: string;
};

/** Optional injectables for smokes (no live IdP). */
export type OidcJwksTestHooks = {
  /** Return discovery JSON or throw. */
  fetchDiscovery?: (issuer: string) => Promise<{ jwks_uri: string }>;
  /** Return a JWKS document for the given URI. */
  fetchJwks?: (jwksUri: string) => Promise<jose.JSONWebKeySet>;
  /** Fixed unix-seconds "now" for claim checks. */
  now_seconds?: number;
};

let hooks: OidcJwksTestHooks = {};

export function setOidcJwksHooksForTests(next: OidcJwksTestHooks | null): void {
  hooks = next ?? {};
}

function trimEnv(name: string): string | undefined {
  const v = process.env[name];
  if (v == null) return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

export function resolveConfiguredJwksUri(): string | undefined {
  return trimEnv(OIDC_ENV.jwksUri);
}

async function resolveJwksUri(config: OidcJwksConfig): Promise<string> {
  const fromEnv = resolveConfiguredJwksUri();
  if (fromEnv) return fromEnv;
  if (config.jwks_uri) return config.jwks_uri;

  if (hooks.fetchDiscovery) {
    const doc = await hooks.fetchDiscovery(config.issuer);
    if (!doc?.jwks_uri) throw new Error("OIDC discovery missing jwks_uri");
    return doc.jwks_uri;
  }

  const discoveryUrl = `${config.issuer.replace(/\/+$/, "")}/.well-known/openid-configuration`;
  const res = await fetch(discoveryUrl, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `OIDC discovery failed (${res.status}) at ${discoveryUrl}: ${text}`,
    );
  }
  const json = (await res.json()) as { jwks_uri?: string };
  if (!json.jwks_uri || typeof json.jwks_uri !== "string") {
    throw new Error("OIDC discovery missing jwks_uri");
  }
  return json.jwks_uri;
}

async function loadKeySet(jwksUri: string): Promise<jose.JWTVerifyGetKey> {
  if (hooks.fetchJwks) {
    const jwks = await hooks.fetchJwks(jwksUri);
    return jose.createLocalJWKSet(jwks);
  }
  return jose.createRemoteJWKSet(new URL(jwksUri));
}

/**
 * Verify id_token signature via JWKS and validate iss/aud/exp/nonce.
 */
export async function verifyOidcIdToken(input: {
  id_token: string;
  config: OidcJwksConfig;
  expected_nonce?: string;
}): Promise<VerifiedOidcClaims> {
  const { id_token, config, expected_nonce } = input;
  const jwksUri = await resolveJwksUri(config);
  const getKey = await loadKeySet(jwksUri);

  let payload: jose.JWTPayload;
  try {
    const verified = await jose.jwtVerify(id_token, getKey, {
      issuer: config.issuer.replace(/\/+$/, ""),
      audience: config.client_id,
      clockTolerance: 60,
    });
    payload = verified.payload;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`OIDC id_token JWKS verify failed: ${msg}`);
  }

  return assertOidcIdTokenClaims({
    payload: payload as OidcIdTokenPayload,
    issuer: config.issuer,
    client_id: config.client_id,
    expected_nonce,
    now_seconds: hooks.now_seconds,
  });
}
