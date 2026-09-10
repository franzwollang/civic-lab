/**
 * Effective prototype users = seed catalog + optional DB role overrides.
 * Server loads overrides into the in-memory map after bootstrap / role change
 * so sync gates (merge authority, Owner checks) see appointments.
 *
 * Client still uses seed via getPrototypeUser unless it fetches GET /api/users.
 */

import {
  PROTOTYPE_USERS,
  getPrototypeUser,
  type PrototypeRole,
  type PrototypeUser,
} from "../app/lib/prototype-users";

let roleOverrides = new Map<string, readonly PrototypeRole[]>();

export function setRoleOverrides(
  entries: Iterable<readonly [string, readonly PrototypeRole[]]>,
): void {
  roleOverrides = new Map(
    [...entries].map(([id, roles]) => [id, [...roles] as PrototypeRole[]]),
  );
}

export function clearRoleOverrides(): void {
  roleOverrides = new Map();
}

export function getRoleOverride(
  userId: string,
): readonly PrototypeRole[] | undefined {
  return roleOverrides.get(userId);
}

export function getEffectivePrototypeUser(
  id: string,
): PrototypeUser | undefined {
  const seed = getPrototypeUser(id);
  if (!seed) return undefined;
  const roles = roleOverrides.get(id);
  if (!roles) return seed;
  return { ...seed, roles: [...roles] };
}

export function listEffectivePrototypeUsers(): PrototypeUser[] {
  return PROTOTYPE_USERS.map(
    (u) => getEffectivePrototypeUser(u.id) ?? { ...u, roles: [...u.roles] },
  );
}

export function countEffectiveOwners(): number {
  return listEffectivePrototypeUsers().filter((u) =>
    u.roles.includes("owner"),
  ).length;
}
