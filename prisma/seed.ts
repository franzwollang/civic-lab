/**
 * Seed Civic Lab SQLite from JSON under prisma/seed/.
 * Invoked by startup when SeedMeta is missing (empty DB), or via `pnpm db:seed`.
 */
import { PrismaClient } from "@prisma/client";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  extractSectionsFromContent,
  sectionIdFor,
} from "../src/doc/sections";

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

type ThreadTargetSeed = {
  target_kind: string;
  target_id: string;
};

type ThreadPostSeed = {
  post_id: string;
  author_id: string;
  type: string;
  body: string;
  created_at: string;
};

type ThreadSeedRow = {
  thread_id: string;
  home_dossier_id: string;
  title: string;
  state: string;
  decision_outcome?: string | null;
  is_redteam?: boolean;
  parent_thread_id?: string | null;
  merge_artifact_id?: string | null;
  created_at: string;
  targets?: ThreadTargetSeed[];
  posts?: ThreadPostSeed[];
};

type RevSetSeedRow = {
  revset_id: string;
  thread_id: string;
  version: number;
  artifact_revision_id: string;
  author_id: string;
  created_at: string;
  summary?: string | null;
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
    await prisma.revSet.deleteMany();
    await prisma.threadTarget.deleteMany();
    await prisma.threadPost.deleteMany();
    await prisma.thread.deleteMany();
    await prisma.section.deleteMany();
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
  const threads = await readSeedJson<ThreadSeedRow[]>("threads.json");
  const revsets = await readSeedJson<RevSetSeedRow[]>("revsets.json");
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

    // Sync Section rows from each artifact's current revision (heading ids).
    for (const page of pages) {
      const currentId = page.current_revision_id;
      if (!currentId) continue;
      const rev = revisions.find((r) => r.revision_id === currentId);
      if (!rev) continue;
      const drafts = extractSectionsFromContent(rev.content_json);
      for (const draft of drafts) {
        await tx.section.create({
          data: {
            sectionId: sectionIdFor(page.page_id, draft.stable_key),
            artifactId: page.page_id,
            stableKey: draft.stable_key,
            title: draft.title,
            level: draft.level,
            order: draft.order,
          },
        });
      }
    }

    // Parent threads first (null parent_thread_id), then children.
    const sortedThreads = [...threads].sort((a, b) => {
      const ap = a.parent_thread_id ? 1 : 0;
      const bp = b.parent_thread_id ? 1 : 0;
      return ap - bp;
    });
    for (const th of sortedThreads) {
      await tx.thread.create({
        data: {
          threadId: th.thread_id,
          homeDossierId: th.home_dossier_id,
          title: th.title,
          state: th.state,
          decisionOutcome: th.decision_outcome ?? null,
          isRedteam: th.is_redteam ?? false,
          parentThreadId: th.parent_thread_id ?? null,
          mergeArtifactId: th.merge_artifact_id ?? null,
          createdAt: new Date(th.created_at),
        },
      });
      for (const target of th.targets ?? []) {
        await tx.threadTarget.create({
          data: {
            threadId: th.thread_id,
            targetKind: target.target_kind,
            targetId: target.target_id,
          },
        });
      }
      for (const post of th.posts ?? []) {
        await tx.threadPost.create({
          data: {
            postId: post.post_id,
            threadId: th.thread_id,
            authorId: post.author_id,
            type: post.type,
            body: post.body,
            createdAt: new Date(post.created_at),
          },
        });
      }
    }

    // Leaf RFC RevSets (proposed revisions already in page_revisions.json).
    for (const rs of revsets) {
      await tx.revSet.create({
        data: {
          revsetId: rs.revset_id,
          threadId: rs.thread_id,
          version: rs.version,
          artifactRevisionId: rs.artifact_revision_id,
          authorId: rs.author_id,
          createdAt: new Date(rs.created_at),
          summary: rs.summary ?? null,
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
