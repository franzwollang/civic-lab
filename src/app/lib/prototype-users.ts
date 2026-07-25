/**
 * Seed prototype identities for impersonation (CONCEPT Appendix A User sketch).
 * Reply composer + merge authority use these; full role-gated chrome is M8.
 *
 * Roles (CONCEPT §8 / §3.4):
 * - owner — Eve (restricted Canon / meta-veto)
 * - editor — Carol (routine Canon merge)
 * - steward — Alice (Manual Collection merge)
 * - red_team — Dave (findings; no merge)
 * - contributor — Bob (discuss / RevSets; no merge)
 */

export type PrototypeRole =
  | "owner"
  | "editor"
  | "steward"
  | "red_team"
  | "adjudicator"
  | "contributor"
  | "observer";

export type PrototypeUser = {
  id: string;
  display_name: string;
  roles: PrototypeRole[];
};

export const PROTOTYPE_USERS: readonly PrototypeUser[] = [
  {
    id: "user-alice",
    display_name: "Alice Chen",
    roles: ["steward", "contributor"],
  },
  {
    id: "user-bob",
    display_name: "Bob Okonkwo",
    roles: ["contributor"],
  },
  {
    id: "user-carol",
    display_name: "Carol Nguyen",
    roles: ["editor", "contributor"],
  },
  {
    id: "user-dave",
    display_name: "Dave Rivera",
    roles: ["red_team", "contributor"],
  },
  {
    id: "user-eve",
    display_name: "Eve Okada",
    roles: ["owner"],
  },
] as const;

export const DEFAULT_PROTOTYPE_USER_ID = PROTOTYPE_USERS[0].id;

const STORAGE_KEY = "civic-lab.acting-user-id";

export function getPrototypeUser(id: string): PrototypeUser | undefined {
  return PROTOTYPE_USERS.find((u) => u.id === id);
}

export function readActingUserId(): string {
  if (typeof window === "undefined") return DEFAULT_PROTOTYPE_USER_ID;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && getPrototypeUser(stored)) return stored;
  } catch {
    // ignore quota / private mode
  }
  return DEFAULT_PROTOTYPE_USER_ID;
}

export function writeActingUserId(id: string): void {
  if (typeof window === "undefined") return;
  if (!getPrototypeUser(id)) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // ignore
  }
}

export function formatUserLabel(user: PrototypeUser): string {
  const role = user.roles[0]?.replace("_", " ") ?? "contributor";
  return `${user.display_name} (${role})`;
}
