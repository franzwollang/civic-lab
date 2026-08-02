/**
 * In-memory session store + cookie helpers for prototype IdP-lite.
 * No external OAuth secrets — login validates seed prototype users.
 */
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { randomBytes } from "crypto";
import { getPrototypeUser } from "../../src/app/lib/prototype-users";
import {
  SESSION_AUTH_MODE,
  SESSION_COOKIE_NAME,
  type SessionAuthMe,
} from "../../src/lib/sessionAuth";

type SessionRecord = {
  user_id: string;
  created_at: number;
};

const sessions = new Map<string, SessionRecord>();

const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 14; // 14 days

export function clearAllSessionsForTests(): void {
  sessions.clear();
}

export function createSession(userId: string): string {
  const user = getPrototypeUser(userId);
  if (!user) {
    throw new Error(`unknown prototype user: ${userId}`);
  }
  const sessionId = randomBytes(24).toString("hex");
  sessions.set(sessionId, { user_id: user.id, created_at: Date.now() });
  return sessionId;
}

export function destroySession(sessionId: string | undefined): void {
  if (sessionId) sessions.delete(sessionId);
}

export function getSessionUserId(
  sessionId: string | undefined | null,
): string | null {
  if (!sessionId) return null;
  return sessions.get(sessionId)?.user_id ?? null;
}

export function readSessionId(c: Context): string | undefined {
  return getCookie(c, SESSION_COOKIE_NAME) ?? undefined;
}

export function setSessionCookie(c: Context, sessionId: string): void {
  setCookie(c, SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    path: "/",
    sameSite: "Lax",
    maxAge: COOKIE_MAX_AGE_SEC,
  });
}

export function clearSessionCookie(c: Context): void {
  deleteCookie(c, SESSION_COOKIE_NAME, { path: "/" });
}

/** Resolve acting user from session cookie (null if anonymous). */
export function resolveSessionActor(c: Context): string | null {
  return getSessionUserId(readSessionId(c));
}

export function sessionMePayload(userId: string): SessionAuthMe {
  return {
    user_id: userId,
    auth_mode: SESSION_AUTH_MODE,
    provider: "prototype",
  };
}

/**
 * Require a logged-in session actor. Returns user_id or a JSON 401 Response.
 */
export function requireSessionActor(
  c: Context,
): string | Response {
  const actor = resolveSessionActor(c);
  if (!actor) {
    return c.json(
      {
        error: {
          code: "unauthorized",
          message: "Session required — POST /api/auth/login (prototype IdP-lite)",
        },
      },
      401,
    );
  }
  return actor;
}

export function isUnknownPrototypeUser(userId: string): boolean {
  return getPrototypeUser(userId) == null;
}
