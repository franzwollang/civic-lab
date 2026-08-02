/**
 * Session→actor binding for mutations. Prototype IdP-lite login remains the
 * default demo path; external OIDC (`/api/auth/oidc/*`) can bind the same
 * cookie when configured — mutation gates stay on `requireSessionActor`.
 */

import type { AuthProvider } from "./oidcAuth";
import { PROTOTYPE_AUTH_PROVIDER } from "./oidcAuth";

export const SESSION_COOKIE_NAME = "civic_lab_session";

/** Auth mode after session→actor binding (replaces body actor_id trust). */
export const SESSION_AUTH_MODE = "session_with_identity_hooks" as const;

export type SessionAuthMe = {
  user_id: string;
  auth_mode: typeof SESSION_AUTH_MODE;
  provider: AuthProvider;
};

export { PROTOTYPE_AUTH_PROVIDER };
