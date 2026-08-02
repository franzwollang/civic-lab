/**
 * Shared helpers for HTTP smokes that need prototype IdP-lite session cookies.
 */
import { app } from "../server/index";
import { SESSION_COOKIE_NAME } from "../src/lib/sessionAuth";

export function cookieHeaderFromResponse(res: Response): string {
  const anyHeaders = res.headers as Headers & {
    getSetCookie?: () => string[];
  };
  const setCookies =
    typeof anyHeaders.getSetCookie === "function"
      ? anyHeaders.getSetCookie()
      : [];
  if (setCookies.length > 0) {
    return setCookies
      .map((line) => line.split(";")[0]?.trim())
      .filter(Boolean)
      .join("; ");
  }
  const single = res.headers.get("set-cookie");
  if (!single) return "";
  return single.split(";")[0]?.trim() ?? "";
}

export async function loginAs(userId: string): Promise<string> {
  const res = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  });
  if (res.status !== 200) {
    const text = await res.text();
    throw new Error(`loginAs(${userId}) failed: ${res.status} ${text}`);
  }
  const cookie = cookieHeaderFromResponse(res);
  if (!cookie.includes(SESSION_COOKIE_NAME)) {
    throw new Error(`loginAs(${userId}) missing session cookie`);
  }
  return cookie;
}

export function withSession(
  cookie: string,
  init: RequestInit = {},
): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("Cookie", cookie);
  return { ...init, headers };
}
