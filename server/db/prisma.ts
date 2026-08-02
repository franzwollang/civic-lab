import type { PrismaClient } from "@prisma/client";
import type { PrototypeRole } from "../../src/app/lib/prototype-users";
import {
  clearRoleOverrides,
  setRoleOverrides,
} from "../../src/lib/effectiveUsers";

let prisma: PrismaClient | null = null;

export function setPrisma(client: PrismaClient) {
  prisma = client;
  // Best-effort; smokes call reloadRoleOverrides after seed.
  void reloadRoleOverrides().catch(() => {
    clearRoleOverrides();
  });
}

/** Load DB role appointments into the effective-user cache. */
export async function reloadRoleOverrides(): Promise<void> {
  const rows = await getPrisma().userRoleAssignment.findMany();
  const entries: Array<[string, PrototypeRole[]]> = [];
  for (const row of rows) {
    const roles = parseRoleList(row.roles);
    if (roles) entries.push([row.userId, roles]);
  }
  setRoleOverrides(entries);
}

function parseRoleList(raw: unknown): PrototypeRole[] | null {
  if (!Array.isArray(raw)) return null;
  const out: PrototypeRole[] = [];
  for (const item of raw) {
    if (typeof item !== "string") return null;
    out.push(item as PrototypeRole);
  }
  return out;
}

export function getPrisma(): PrismaClient {
  if (!prisma) {
    throw new Error("Prisma client not initialized — call bootstrapDatabase first");
  }
  return prisma;
}
