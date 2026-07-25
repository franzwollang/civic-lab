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

type PageRow = {
  page_id: string;
  title: string;
  slug: string;
  current_revision_id: string | null;
  created_at: string;
};

type RevisionRow = {
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
    await prisma.pageRevision.deleteMany();
    await prisma.page.deleteMany();
    await prisma.termsRegistry.deleteMany();
    await prisma.attributionsRegistry.deleteMany();
    await prisma.seedMeta.deleteMany();
  }

  const pages = await readSeedJson<PageRow[]>("pages.json");
  const revisions = await readSeedJson<RevisionRow[]>("page_revisions.json");
  const terms = await readSeedJson<RegistryFile>("terms.json");
  const attributions = await readSeedJson<RegistryFile>("attributions.json");

  await prisma.$transaction(async (tx) => {
    for (const page of pages) {
      await tx.page.create({
        data: {
          pageId: page.page_id,
          title: page.title,
          slug: page.slug,
          currentRevisionId: page.current_revision_id,
          createdAt: new Date(page.created_at),
        },
      });
    }

    for (const rev of revisions) {
      await tx.pageRevision.create({
        data: {
          revisionId: rev.revision_id,
          pageId: rev.page_id,
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
