import type { PrismaClient } from "@prisma/client";
import { clearRoleOverrides } from "../../src/lib/effectiveUsers";

let prisma: PrismaClient | null = null;
let reloadRoleOverridesFn: (() => Promise<void>) | null = null;

/** Avoid cycle: moderationDb imports getPrisma; wire reload after modules load. */
export function bindRoleOverrideReloader(fn: () => Promise<void>): void {
  reloadRoleOverridesFn = fn;
}

export function setPrisma(client: PrismaClient) {
  prisma = client;
  // Best-effort; smokes call reloadRoleOverrides after seed.
  if (reloadRoleOverridesFn) {
    void reloadRoleOverridesFn().catch(() => {
      clearRoleOverrides();
    });
  }
}

export function getPrisma(): PrismaClient {
  if (!prisma) {
    throw new Error("Prisma client not initialized — call bootstrapDatabase first");
  }
  return prisma;
}
