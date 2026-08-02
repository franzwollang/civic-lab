import type { Hono } from "hono";
import { z } from "zod";
import {
  clearSessionCookie,
  createSession,
  destroySession,
  getSessionProvider,
  isUnknownPrototypeUser,
  readSessionId,
  requireSessionActor,
  resolveSessionActor,
  sessionMePayload,
  setSessionCookie,
} from "../auth/session";
import {
  beginOidcAuthorization,
  clearOidcPendingForTests,
  oidcPublicStatus,
  readOidcConfig,
  resolveOidcCallback,
} from "../auth/oidc";
import { SESSION_AUTH_MODE } from "../../src/lib/sessionAuth";
import {
  OIDC_AUTH_PROVIDER,
  PROTOTYPE_AUTH_PROVIDER,
} from "../../src/lib/oidcAuth";

const loginBodySchema = z.object({
  user_id: z.string().min(1),
});

/**
 * Auth routes: prototype IdP-lite + optional external OIDC swap-in.
 * `requireSessionActor` consumers are unchanged either way.
 */
export function registerAuthRoutes(app: Hono): void {
  app.get("/api/auth/me", async (c) => {
    const actor = resolveSessionActor(c);
    if (!actor) {
      return c.json(
        {
          user_id: null,
          auth_mode: SESSION_AUTH_MODE,
          provider: null,
          oidc: oidcPublicStatus(),
        },
        200,
      );
    }
    const provider =
      getSessionProvider(readSessionId(c)) ?? PROTOTYPE_AUTH_PROVIDER;
    return c.json({
      ...sessionMePayload(actor, provider),
      oidc: oidcPublicStatus(),
    });
  });

  app.post("/api/auth/login", async (c) => {
    const parsed = loginBodySchema.safeParse(
      (await c.req.json().catch(() => ({}))) ?? {},
    );
    if (!parsed.success) {
      return c.json({ error: "Invalid login payload (user_id required)" }, 400);
    }
    if (isUnknownPrototypeUser(parsed.data.user_id)) {
      return c.json(
        { error: { code: "unknown_user", message: "Unknown prototype user" } },
        404,
      );
    }
    // Rotate: drop prior session if present.
    destroySession(readSessionId(c));
    const sessionId = createSession(
      parsed.data.user_id,
      PROTOTYPE_AUTH_PROVIDER,
    );
    setSessionCookie(c, sessionId);
    return c.json(sessionMePayload(parsed.data.user_id, PROTOTYPE_AUTH_PROVIDER));
  });

  /** Alias for demos — same as login. */
  app.post("/api/auth/impersonate", async (c) => {
    const parsed = loginBodySchema.safeParse(
      (await c.req.json().catch(() => ({}))) ?? {},
    );
    if (!parsed.success) {
      return c.json(
        { error: "Invalid impersonate payload (user_id required)" },
        400,
      );
    }
    if (isUnknownPrototypeUser(parsed.data.user_id)) {
      return c.json(
        { error: { code: "unknown_user", message: "Unknown prototype user" } },
        404,
      );
    }
    destroySession(readSessionId(c));
    const sessionId = createSession(
      parsed.data.user_id,
      PROTOTYPE_AUTH_PROVIDER,
    );
    setSessionCookie(c, sessionId);
    return c.json(sessionMePayload(parsed.data.user_id, PROTOTYPE_AUTH_PROVIDER));
  });

  app.post("/api/auth/logout", async (c) => {
    destroySession(readSessionId(c));
    clearSessionCookie(c);
    return c.json({ ok: true, auth_mode: SESSION_AUTH_MODE });
  });

  /** Convenience: who-am-I with 401 when anonymous (stricter than /me). */
  app.get("/api/auth/session", async (c) => {
    const actor = requireSessionActor(c);
    if (actor instanceof Response) return actor;
    const provider =
      getSessionProvider(readSessionId(c)) ?? PROTOTYPE_AUTH_PROVIDER;
    return c.json(sessionMePayload(actor, provider));
  });

  /** Public OIDC config (no secrets). */
  app.get("/api/auth/oidc/status", async (c) => {
    return c.json(oidcPublicStatus());
  });

  /**
   * Begin OIDC authorization-code flow.
   * - Browser: 302 to authorization_url
   * - `?format=json` or Accept application/json: return URL for clients/smokes
   */
  app.get("/api/auth/oidc/start", async (c) => {
    if (!readOidcConfig()) {
      return c.json(
        {
          error: {
            code: "oidc_disabled",
            message:
              "OIDC not configured — set OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, OIDC_REDIRECT_URI",
          },
        },
        503,
      );
    }
    const loginHint = c.req.query("login_hint")?.trim() || undefined;
    let started: { state: string; authorization_url: string };
    try {
      started = beginOidcAuthorization(loginHint);
    } catch (err) {
      return c.json(
        {
          error: {
            code: "oidc_start_failed",
            message: err instanceof Error ? err.message : String(err),
          },
        },
        500,
      );
    }

    const wantJson =
      c.req.query("format") === "json" ||
      (c.req.header("accept") ?? "").includes("application/json");
    if (wantJson) {
      return c.json({
        authorization_url: started.authorization_url,
        state: started.state,
        provider: OIDC_AUTH_PROVIDER,
      });
    }
    return c.redirect(started.authorization_url, 302);
  });

  /** OIDC redirect_uri handler — binds session cookie on success. */
  app.get("/api/auth/oidc/callback", async (c) => {
    if (!readOidcConfig()) {
      return c.json(
        {
          error: {
            code: "oidc_disabled",
            message: "OIDC not configured",
          },
        },
        503,
      );
    }
    const err = c.req.query("error");
    if (err) {
      return c.json(
        {
          error: {
            code: "oidc_provider_error",
            message: c.req.query("error_description") || err,
          },
        },
        400,
      );
    }
    const code = c.req.query("code");
    const state = c.req.query("state");
    if (!code || !state) {
      return c.json(
        {
          error: {
            code: "oidc_callback_invalid",
            message: "code and state are required",
          },
        },
        400,
      );
    }

    try {
      const resolved = await resolveOidcCallback({ code, state });
      destroySession(readSessionId(c));
      const sessionId = createSession(resolved.user_id, OIDC_AUTH_PROVIDER);
      setSessionCookie(c, sessionId);

      const wantJson =
        c.req.query("format") === "json" ||
        (c.req.header("accept") ?? "").includes("application/json");
      if (wantJson) {
        return c.json(sessionMePayload(resolved.user_id, OIDC_AUTH_PROVIDER));
      }
      const cfg = readOidcConfig()!;
      return c.redirect(cfg.post_login_redirect, 302);
    } catch (e) {
      return c.json(
        {
          error: {
            code: "oidc_callback_failed",
            message: e instanceof Error ? e.message : String(e),
          },
        },
        400,
      );
    }
  });
}

/** Test-only re-export so smokes can reset pending OIDC state. */
export { clearOidcPendingForTests };
