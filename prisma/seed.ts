/**
 * Seed Civic Lab SQLite from JSON under prisma/seed/.
 * Invoked by startup when SeedMeta is missing (empty DB), or via `pnpm db:seed`.
 */
import { PrismaClient } from "@prisma/client";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const SEED_ID = "default";
const SEED_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "seed",
);

type AreaSeedRow = {
  area_id: string;
  kind: string;
  title: string;
};

type CollectionSeedRow = {
  collection_id: string;
  area_id: string;
  title: string;
  country_code: string | null;
  summary?: string | null;
};

type DossierSeedRow = {
  dossier_id: string;
  collection_id: string;
  title: string;
  summary?: string | null;
  tags?: string[];
};

type ArtifactSeedRow = {
  page_id: string;
  title: string;
  slug: string;
  current_revision_id: string | null;
  created_at: string;
  dossier_id?: string | null;
};

type RevisionSeedRow = {
  revision_id: string;
  page_id: string;
  parent_revision_id: string | null;
  created_at: string;
  author: string;
  content_json: unknown;
};

type RegistryFile = {
  version: number;
  items: unknown[];
};

async function readSeedJson<T>(name: string): Promise<T> {
  const raw = await fs.readFile(path.join(SEED_DIR, name), "utf-8");
  return JSON.parse(raw) as T;
}

export async function seedIfEmpty(
  prisma: PrismaClient = new PrismaClient(),
  options: { force?: boolean } = {},
): Promise<"skipped" | "seeded"> {
  const existing = await prisma.seedMeta.findUnique({ where: { id: SEED_ID } });
  if (existing && !options.force) {
    return "skipped";
  }

  if (options.force) {
    await prisma.artifactRevision.deleteMany();
    await prisma.artifact.deleteMany();
    await prisma.dossier.deleteMany();
    await prisma.collection.deleteMany();
    await prisma.area.deleteMany();
    await prisma.termsRegistry.deleteMany();
    await prisma.attributionsRegistry.deleteMany();
    await prisma.seedMeta.deleteMany();
  }

  const areas = await readSeedJson<AreaSeedRow[]>("areas.json");
  const collections = await readSeedJson<CollectionSeedRow[]>("collections.json");
  const dossiers = await readSeedJson<DossierSeedRow[]>("dossiers.json");
  const pages = await readSeedJson<ArtifactSeedRow[]>("pages.json");
  const revisions = await readSeedJson<RevisionSeedRow[]>("page_revisions.json");
  const terms = await readSeedJson<RegistryFile>("terms.json");
  const attributions = await readSeedJson<RegistryFile>("attributions.json");

  await prisma.$transaction(async (tx) => {
    for (const area of areas) {
      await tx.area.create({
        data: {
          areaId: area.area_id,
          kind: area.kind,
          title: area.title,
        },
      });
    }

    for (const col of collections) {
      await tx.collection.create({
        data: {
          collectionId: col.collection_id,
          areaId: col.area_id,
          title: col.title,
          countryCode: col.country_code,
          summary: col.summary ?? null,
        },
      });
    }

    for (const d of dossiers) {
      await tx.dossier.create({
        data: {
          dossierId: d.dossier_id,
          collectionId: d.collection_id,
          title: d.title,
          summary: d.summary ?? null,
          tags: d.tags ?? [],
        },
      });
    }

    for (const page of pages) {
      await tx.artifact.create({
        data: {
          artifactId: page.page_id,
          title: page.title,
          slug: page.slug,
          currentRevisionId: page.current_revision_id,
          createdAt: new Date(page.created_at),
          dossierId: page.dossier_id ?? null,
        },
      });
    }

    for (const rev of revisions) {
      await tx.artifactRevision.create({
        data: {
          revisionId: rev.revision_id,
          artifactId: rev.page_id,
          parentRevisionId: rev.parent_revision_id,
          createdAt: new Date(rev.created_at),
          author: rev.author,
          contentJson: rev.content_json as object,
        },
      });
    }

    await tx.termsRegistry.create({
      data: {
        id: 1,
        version: terms.version,
        items: terms.items as object,
      },
    });

    await tx.attributionsRegistry.create({
      data: {
        id: 1,
        version: attributions.version,
        items: attributions.items as object,
      },
    });

    await tx.seedMeta.create({
      data: {
        id: SEED_ID,
        appliedAt: new Date(),
        source: "prisma/seed",
      },
    });
  });

  return "seeded";
}

async function main() {
  const force = process.argv.includes("--force");
  const prisma = new PrismaClient();
  try {
    const result = await seedIfEmpty(prisma, { force });
    console.log(
      result === "seeded"
        ? force
          ? "Database re-seeded from prisma/seed/"
          : "Database seeded from prisma/seed/"
        : "Seed skipped (SeedMeta present; pass --force to reset)",
    );
  } finally {
    await prisma.$disconnect();
  }
}

const isDirect =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirect) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
