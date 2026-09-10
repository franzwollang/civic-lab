/**
 * OIDC id_token claim checks shared by server JWKS verify + smokes.
 * Signature verification itself lives in `server/auth/oidcJwks.ts` (jose).
 */

export type OidcIdTokenPayload = {
  sub?: string;
  email?: string;
  preferred_username?: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  nonce?: string;
  [key: string]: unknown;
};

export type OidcClaimCheckInput = {
  payload: OidcIdTokenPayload;
  issuer: string;
  client_id: string;
  expected_nonce?: string;
  /** Override "now" for tests (unix seconds). */
  now_seconds?: number;
  /** Clock skew tolerance in seconds (default 60). */
  clock_tolerance_seconds?: number;
};

export function audienceIncludes(
  aud: string | string[] | undefined,
  clientId: string,
): boolean {
  if (aud == null) return false;
  if (typeof aud === "string") return aud === clientId;
  return Array.isArray(aud) && aud.includes(clientId);
}

/**
 * Validate standard OIDC id_token claims after signature verify (or in unit tests).
 * Throws Error with a stable message prefix for route mapping.
 */
export function assertOidcIdTokenClaims(input: OidcClaimCheckInput): {
  sub: string;
  email?: string;
  preferred_username?: string;
} {
  const {
    payload,
    issuer,
    client_id,
    expected_nonce,
    now_seconds = Math.floor(Date.now() / 1000),
    clock_tolerance_seconds = 60,
  } = input;

  if (!payload.sub || typeof payload.sub !== "string") {
    throw new Error("OIDC id_token missing sub");
  }

  const expectedIss = issuer.replace(/\/+$/, "");
  const actualIss =
    typeof payload.iss === "string" ? payload.iss.replace(/\/+$/, "") : "";
  if (!actualIss || actualIss !== expectedIss) {
    throw new Error(
      `OIDC id_token iss mismatch (expected ${expectedIss}, got ${payload.iss ?? "missing"})`,
    );
  }

  if (!audienceIncludes(payload.aud, client_id)) {
    throw new Error(
      `OIDC id_token aud mismatch (expected client_id ${client_id})`,
    );
  }

  if (typeof payload.exp !== "number") {
    throw new Error("OIDC id_token missing exp");
  }
  if (payload.exp < now_seconds - clock_tolerance_seconds) {
    throw new Error("OIDC id_token expired");
  }

  if (
    typeof payload.nbf === "number" &&
    payload.nbf > now_seconds + clock_tolerance_seconds
  ) {
    throw new Error("OIDC id_token not yet valid (nbf)");
  }

  if (expected_nonce) {
    if (payload.nonce !== expected_nonce) {
      throw new Error("OIDC id_token nonce mismatch");
    }
  }

  return {
    sub: payload.sub,
    email: typeof payload.email === "string" ? payload.email : undefined,
    preferred_username:
      typeof payload.preferred_username === "string"
        ? payload.preferred_username
        : undefined,
  };
}
