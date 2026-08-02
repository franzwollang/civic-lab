/**
 * Prisma-backed data access for the Hono API.
 * Domain models are Artifact / ArtifactRevision; SQLite tables remain
 * `pages` / `page_revisions` via Prisma @@map. Wire JSON dual-emits
 * `artifact_id` (preferred) and legacy `page_id` (same value).
 *
 * Corpus IA / Collection dashboard live in `server/db/corpusDb.ts`.
 * Artifact CRUD / revisions / sections live in `server/db/artifactsDb.ts`.
 * Thread / RFC / RevSet / decide live in `server/db/threadsDb.ts`.
 * createAcceptedRisk stays here — imports resolveMergeAuthorityForArtifact
 * from threadsDb (avoids findings↔threads cycle).
 */
import { randomUUID } from "crypto";
import { getPrisma } from "./db/prisma";
import { appendAuditLog } from "./db/moderationDb";
import { getUserIdentity } from "./db/identities";
import { evaluateStewardEligibility } from "../src/lib/identityPolicy";
import { actorMaySignAcceptedRisk } from "../src/lib/acceptedRisk";
import {
  listOpenCriticalFindingsForMerge,
  mapAcceptedRisk,
  type AcceptedRiskRow,
} from "./db/findingsDb";
import { resolveMergeAuthorityForArtifact } from "./db/threadsDb";

export type CreateAcceptedRiskInput = {
  accepted_risk_id?: string;
  thread_id: string;
  description: string;
  rationale: string;
  evidence_considered?: string | null;
  reopen_triggers?: string | null;
  signer_id: string;
  signed_at?: string;
};

export type CreateAcceptedRiskError =
  | { code: "not_found"; message: string }
  | { code: "not_leaf"; message: string }
  | { code: "not_decidable"; message: string; state: string }
  | { code: "already_exists"; message: string }
  | { code: "forbidden"; message: string }
  | { code: "authority_context_missing"; message: string }
  | {
      code:
        | "identity_unverified"
        | "identity_pending"
        | "identity_rejected"
        | "steward_country_mismatch";
      message: string;
    };

/**
 * CONCEPT §7.6 — sign Accepted Risk on a leaf RFC.
 * Marks open Critical Findings that would block this merge as `accepted_risk`.
 */
export async function createAcceptedRisk(
  input: CreateAcceptedRiskInput,
): Promise<
  | { ok: true; accepted_risk: AcceptedRiskRow; findings_updated: string[] }
  | { ok: false; error: CreateAcceptedRiskError }
> {
  const prisma = getPrisma();
  const thread = await prisma.thread.findUnique({
    where: { threadId: input.thread_id },
  });
  if (!thread) {
    return {
      ok: false,
      error: { code: "not_found", message: "Thread not found" },
    };
  }
  if (!thread.mergeArtifactId) {
    return {
      ok: false,
      error: {
        code: "not_leaf",
        message: "Accepted Risk attaches only to merging (leaf) RFCs",
      },
    };
  }
  if (thread.state !== "rfc" && thread.state !== "review") {
    return {
      ok: false,
      error: {
        code: "not_decidable",
        message: "Accepted Risk only on open leaf RFCs",
        state: thread.state,
      },
    };
  }

  const existing = await prisma.acceptedRisk.findUnique({
    where: { threadId: input.thread_id },
  });
  if (existing) {
    return {
      ok: false,
      error: {
        code: "already_exists",
        message: "Accepted Risk already signed for this leaf RFC",
      },
    };
  }

  const authority = await resolveMergeAuthorityForArtifact(
    thread.mergeArtifactId,
    { threadId: input.thread_id },
  );
  if (!authority) {
    return {
      ok: false,
      error: {
        code: "authority_context_missing",
        message: "Could not resolve Collection for merge artifact",
      },
    };
  }
  if (!actorMaySignAcceptedRisk(input.signer_id, authority.area_kind)) {
    return {
      ok: false,
      error: {
        code: "forbidden",
        message:
          authority.area_kind === "manuals"
            ? "Only Collection stewards (or Owner) may sign Accepted Risk on Manual RFCs"
            : "Only Owner may sign Accepted Risk on Canon RFCs",
      },
    };
  }

  if (authority.area_kind === "manuals") {
    const identity = await getUserIdentity(input.signer_id);
    const eligibility = evaluateStewardEligibility({
      actor_id: input.signer_id,
      country_code: authority.country_code,
      identity,
      require_manual_country: true,
    });
    if (!eligibility.ok) {
      const code =
        eligibility.code === "not_steward_role" ||
        eligibility.code === "unknown_user"
          ? "identity_unverified"
          : eligibility.code;
      return {
        ok: false,
        error: { code, message: eligibility.message },
      };
    }
  }

  const blockers = await listOpenCriticalFindingsForMerge({
    threadId: input.thread_id,
    mergeArtifactId: thread.mergeArtifactId,
  });

  // Only flip Findings whose context is this leaf RFC (originating thread or
  // explicit thread target). Artifact-targeted Criticals stay open so other
  // leaves merging the same artifact still need their own Accepted Risk.
  const findingsToAccept = blockers.filter(
    (f) =>
      f.thread_id === input.thread_id ||
      f.targets.some(
        (t) => t.target_kind === "thread" && t.target_id === input.thread_id,
      ),
  );

  const acceptedRiskId =
    input.accepted_risk_id?.trim() || `ar-${randomUUID()}`;
  const signedAt = input.signed_at ? new Date(input.signed_at) : new Date();

  const findingIds = findingsToAccept.map((f) => f.finding_id);

  await prisma.$transaction(async (tx) => {
    await tx.acceptedRisk.create({
      data: {
        acceptedRiskId,
        threadId: input.thread_id,
        description: input.description.trim(),
        rationale: input.rationale.trim(),
        evidenceConsidered: input.evidence_considered?.trim() || null,
        reopenTriggers: input.reopen_triggers?.trim() || null,
        signerId: input.signer_id,
        signedAt,
      },
    });
    if (findingIds.length > 0) {
      await tx.finding.updateMany({
        where: { findingId: { in: findingIds } },
        data: { status: "accepted_risk" },
      });
    }
    await tx.threadPost.create({
      data: {
        postId: randomUUID(),
        threadId: input.thread_id,
        authorId: input.signer_id,
        type: "comment",
        body: `Accepted Risk signed by ${input.signer_id}.${
          findingIds.length > 0
            ? ` Critical Finding(s) marked accepted_risk: ${findingIds.join(", ")}.`
            : ""
        } ${input.description.trim()}`,
        createdAt: signedAt,
      },
    });
  });

  const row = await prisma.acceptedRisk.findUniqueOrThrow({
    where: { acceptedRiskId },
  });
  const accepted_risk = mapAcceptedRisk(row);
  await appendAuditLog({
    action: "accepted_risk",
    actor_id: input.signer_id,
    subject_id: input.thread_id,
    payload: {
      accepted_risk_id: acceptedRiskId,
      merge_artifact_id: thread.mergeArtifactId,
      findings_updated: findingIds,
      description: input.description.trim(),
    },
  });
  return {
    ok: true,
    accepted_risk,
    findings_updated: findingIds,
  };
}

export {
  listAreas,
  getArea,
  getAreaByKind,
  listCollections,
  getCollection,
  getCollectionDashboard,
  listDossiers,
  getDossier,
  type AreaRow,
  type CollectionRow,
  type DossierRow,
  type CollectionDashboardDossier,
  type CollectionEmpiricalQuality,
  type CollectionForecastAccuracy,
  type RequirementSatisfactionSnapshot,
  type ReputationSignalCounts,
  type ReputationContributorRow,
  type CollectionReputationBoard,
  type CollectionDashboard,
} from "./db/corpusDb";
export {
  listFindings,
  getFinding,
  createFinding,
  listOpenCriticalFindingsForMerge,
  getAcceptedRiskForThread,
  listCandidateFindings,
  getCandidateFinding,
  flagCandidateFinding,
  promoteCandidateFinding,
  mapAcceptedRisk,
  type FindingTargetRow,
  type FindingRow,
  type CandidateFindingRow,
  type AcceptedRiskRow,
  type CreateFindingInput,
  type CreateFindingError,
  type FlagCandidateInput,
  type FlagCandidateError,
  type PromoteCandidateInput,
  type PromoteCandidateError,
} from "./db/findingsDb";
export {
  resolveClaimOwnerContext,
  listClaims,
  getClaim,
  createClaim,
  requestClaimAdjudication,
  adjudicateClaim,
  listAdjudicationQueue,
  type ClaimRow,
  type CreateClaimError,
  type RequestAdjudicationError,
  type AdjudicateClaimError,
} from "./db/claimsDb";
export {
  resolveSoftLaneLabel,
  listArtifactsByDossier,
  listArtifacts,
  listPages,
  getArtifact,
  getPage,
  createArtifact,
  updateArtifact,
  updatePage,
  revertCanonArtifact,
  listArtifactRevisions,
  listRevisions,
  syncSectionsForArtifact,
  listSections,
  getSection,
  createArtifactRevision,
  createRevision,
  type ArtifactRow,
  type PageRow,
  type ArtifactRevisionRow,
  type RevisionRow,
  type SectionRow,
  type CreateArtifactError,
  type UpdateArtifactError,
  type RevertCanonArtifactError,
} from "./db/artifactsDb";
export {
  listThreads,
  getThread,
  resolveMergeAuthorityForArtifact,
  listRevSets,
  promoteThreadToRfc,
  createRevSet,
  createThreadPost,
  softDeleteThreadPost,
  decideThread,
  type ThreadTargetRow,
  type ThreadPostRow,
  type ThreadChildSummary,
  type ThreadRow,
  type RevSetRow,
  type PromoteThreadError,
  type CreateRevSetError,
  type CreateThreadPostError,
  type SoftDeletePostError,
  type DecisionOutcome,
  type DecideThreadError,
} from "./db/threadsDb";
export { setPrisma, getPrisma, reloadRoleOverrides } from "./db/prisma";
export {
  getAttributions,
  putAttributions,
  getTerms,
  putTerms,
  type RegistryPayload,
} from "./db/registries";
export { searchCorpus } from "./db/search";
export {
  appendAuditLog,
  listAuditLogs,
  listActiveBoardHides,
  listBoardHides,
  hideUserFromBoards,
  liftBoardHide,
  listEffectiveUsers,
  changeUserRoles,
  type AuditLogRow,
  type BoardHideRow,
  type BoardHideMutationError,
  type RoleChangeMutationError,
  type EffectiveUserRow,
} from "./db/moderationDb";
export {
  listUserIdentities,
  getUserIdentity,
  resolveUserIdentity,
  requestIdentityVerification,
  attestUserIdentity,
  getStewardEligibilityForUser,
  type IdentityMutationError,
} from "./db/identities";
