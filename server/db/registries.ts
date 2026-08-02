import { getPrisma } from "./prisma";

export type RegistryPayload = {
  version: number;
  items: unknown[];
};

export async function getAttributions(): Promise<RegistryPayload> {
  const row = await getPrisma().attributionsRegistry.findUnique({
    where: { id: 1 },
  });
  if (!row) {
    return { version: 0, items: [] };
  }
  return {
    version: row.version,
    items: row.items as unknown[],
  };
}

export async function putAttributions(
  next: RegistryPayload,
): Promise<RegistryPayload> {
  const row = await getPrisma().attributionsRegistry.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      version: next.version,
      items: next.items as object,
    },
    update: {
      version: next.version,
      items: next.items as object,
    },
  });
  return {
    version: row.version,
    items: row.items as unknown[],
  };
}

export async function getTerms(): Promise<RegistryPayload> {
  const row = await getPrisma().termsRegistry.findUnique({ where: { id: 1 } });
  if (!row) {
    return { version: 0, items: [] };
  }
  return {
    version: row.version,
    items: row.items as unknown[],
  };
}

export async function putTerms(next: RegistryPayload): Promise<RegistryPayload> {
  const row = await getPrisma().termsRegistry.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      version: next.version,
      items: next.items as object,
    },
    update: {
      version: next.version,
      items: next.items as object,
    },
  });
  return {
    version: row.version,
    items: row.items as unknown[],
  };
}
