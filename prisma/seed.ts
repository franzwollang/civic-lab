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
  /** CONCEPT §3.4 restricted Canon — Owner-only merge. */
  owner_merge_only?: boolean;
  /** CONCEPT §4 Manual lane; null on Canon. */
  lane?: string | null;
};

type RevisionSeedRow = {
  revision_id: string;
  page_id: string;
  parent_revision_id: string | null;
  created_at: string;
  author: string;
  content_json: unknown;
};

type ClaimSeedRow = {
  claim_id: string;
  artifact_id: string;
  section_id?: string | null;
  profile: string;
  text: string;
  status?: string;
  empirical_type?: string | null;
  scope?: string | null;
  region_code?: string | null;
  region_label?: string | null;
  probability?: number | null;
  as_of?: string | null;
  deadline?: string | null;
  resolution_criteria?: string | null;
  preferred_sources?: string[];
  adjudication_rule?: string | null;
  canon_citations?: string[];
  links?: unknown[];
  created_at: string;
  author_id?: string | null;
  adjudication_requested_at?: string | null;
  adjudication_requested_by?: string | null;
  adjudication_request_note?: string | null;
  adjudication_rationale?: string | null;
  adjudicated_by?: string | null;
  adjudicated_at?: string | null;
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

type FindingTargetSeed = {
  target_kind: string;
  target_id: string;
};

type FindingSeedRow = {
  finding_id: string;
  thread_id: string;
  title: string;
  severity: string;
  likelihood?: string | null;
  status?: string;
  evidence?: string | null;
  attack_path?: string | null;
  author_id: string;
  created_at: string;
  targets?: FindingTargetSeed[];
  source_post_id?: string | null;
  source_candidate_id?: string | null;
};

type CandidateSeedRow = {
  candidate_id: string;
  thread_id: string;
  post_id: string;
  flagger_id: string;
  note?: string | null;
  status?: string;
  promoted_finding_id?: string | null;
  created_at: string;
};

type IdentitySeedRow = {
  user_id: string;
  verification_status: string;
  country_codes: string[];
  long_term_ties_note?: string | null;
  attestation_kind: string;
  verified_by?: string | null;
  verified_at?: string | null;
  provider_stub?: string | null;
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
    await prisma.candidateFinding.deleteMany();
    await prisma.acceptedRisk.deleteMany();
    await prisma.findingTarget.deleteMany();
    await prisma.finding.deleteMany();
    await prisma.claim.deleteMany();
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
    await prisma.boardHide.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.userIdentity.deleteMany();
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
  const claims = await readSeedJson<ClaimSeedRow[]>("claims.json");
  const findings = await readSeedJson<FindingSeedRow[]>("findings.json");
  const candidates = await readSeedJson<CandidateSeedRow[]>("candidates.json");
  const identities = await readSeedJson<IdentitySeedRow[]>("identities.json");
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
          ownerMergeOnly: page.owner_merge_only ?? false,
          lane: page.lane ?? null,
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

    // CONCEPT §5 claims (after artifacts/sections exist).
    for (const c of claims) {
      await tx.claim.create({
        data: {
          claimId: c.claim_id,
          artifactId: c.artifact_id,
          sectionId: c.section_id ?? null,
          profile: c.profile,
          text: c.text,
          status: c.status ?? "open",
          empiricalType: c.empirical_type ?? null,
          scope: c.scope ?? null,
          regionCode: c.region_code ?? null,
          regionLabel: c.region_label ?? null,
          probability: c.probability ?? null,
          asOf: c.as_of ? new Date(c.as_of) : null,
          deadline: c.deadline ? new Date(c.deadline) : null,
          resolutionCriteria: c.resolution_criteria ?? null,
          preferredSources: c.preferred_sources ?? [],
          adjudicationRule: c.adjudication_rule ?? null,
          canonCitations: c.canon_citations ?? [],
          links: c.links ?? [],
          createdAt: new Date(c.created_at),
          authorId: c.author_id ?? null,
          adjudicationRequestedAt: c.adjudication_requested_at
            ? new Date(c.adjudication_requested_at)
            : null,
          adjudicationRequestedBy: c.adjudication_requested_by ?? null,
          adjudicationRequestNote: c.adjudication_request_note ?? null,
          adjudicationRationale: c.adjudication_rationale ?? null,
          adjudicatedBy: c.adjudicated_by ?? null,
          adjudicatedAt: c.adjudicated_at
            ? new Date(c.adjudicated_at)
            : null,
        },
      });
    }

    // CONCEPT §7.3 Findings (after threads exist).
    for (const f of findings) {
      await tx.finding.create({
        data: {
          findingId: f.finding_id,
          threadId: f.thread_id,
          title: f.title,
          severity: f.severity,
          likelihood: f.likelihood ?? null,
          status: f.status ?? "open",
          evidence: f.evidence ?? null,
          attackPath: f.attack_path ?? null,
          authorId: f.author_id,
          createdAt: new Date(f.created_at),
          sourcePostId: f.source_post_id ?? null,
          sourceCandidateId: f.source_candidate_id ?? null,
        },
      });
      for (const target of f.targets ?? []) {
        await tx.findingTarget.create({
          data: {
            findingId: f.finding_id,
            targetKind: target.target_kind,
            targetId: target.target_id,
          },
        });
      }
    }

    // CONCEPT §7.4 Candidate Findings (after posts exist).
    for (const c of candidates) {
      await tx.candidateFinding.create({
        data: {
          candidateId: c.candidate_id,
          threadId: c.thread_id,
          postId: c.post_id,
          flaggerId: c.flagger_id,
          note: c.note ?? null,
          status: c.status ?? "open",
          promotedFindingId: c.promoted_finding_id ?? null,
          createdAt: new Date(c.created_at),
        },
      });
    }

    for (const idn of identities) {
      await tx.userIdentity.create({
        data: {
          userId: idn.user_id,
          verificationStatus: idn.verification_status,
          countryCodes: idn.country_codes,
          longTermTiesNote: idn.long_term_ties_note ?? null,
          attestationKind: idn.attestation_kind,
          verifiedBy: idn.verified_by ?? null,
          verifiedAt: idn.verified_at ? new Date(idn.verified_at) : null,
          providerStub: idn.provider_stub ?? null,
          updatedAt: new Date(idn.verified_at ?? "2026-07-20T12:00:00.000Z"),
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
