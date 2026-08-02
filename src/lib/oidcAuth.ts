/**
 * External OIDC swap-in for `/api/auth/login` (Optional deferred).
 *
 * When env is configured, `/api/auth/oidc/*` can bind the same session cookie
 * that prototype IdP-lite uses. Mutation gates stay on `requireSessionActor`.
 * No client secrets are committed — configure via process env only.
 */

export const OIDC_AUTH_PROVIDER = "oidc" as const;
export const PROTOTYPE_AUTH_PROVIDER = "prototype" as const;

export type AuthProvider =
  | typeof OIDC_AUTH_PROVIDER
  | typeof PROTOTYPE_AUTH_PROVIDER;

/** Public status — never includes client_secret. */
export type OidcPublicStatus = {
  enabled: boolean;
  mock: boolean;
  issuer: string | null;
  client_id: string | null;
  redirect_uri: string | null;
  scopes: string;
  authorization_endpoint: string | null;
};

export const DEFAULT_OIDC_SCOPES = "openid profile email";

/** Env keys (server-side only). */
export const OIDC_ENV = {
  issuer: "OIDC_ISSUER",
  clientId: "OIDC_CLIENT_ID",
  clientSecret: "OIDC_CLIENT_SECRET",
  redirectUri: "OIDC_REDIRECT_URI",
  scopes: "OIDC_SCOPES",
  subjectMap: "OIDC_SUBJECT_MAP",
  mock: "OIDC_MOCK",
  postLoginRedirect: "OIDC_POST_LOGIN_REDIRECT",
} as const;
