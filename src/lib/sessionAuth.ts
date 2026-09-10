/**
 * Prototype IdP-lite: bind a server session to a seed user (impersonation login).
 * Real OIDC plugs in later without changing mutation actor resolution.
 */

export const SESSION_COOKIE_NAME = "civic_lab_session";

/** Auth mode after session→actor binding (replaces body actor_id trust). */
export const SESSION_AUTH_MODE = "session_with_identity_hooks" as const;

export type SessionAuthMe = {
  user_id: string;
  auth_mode: typeof SESSION_AUTH_MODE;
  provider: "prototype";
};
