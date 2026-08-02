import {
  AUTH_MODE,
  defaultIdentityRecord,
  evaluateStewardEligibility,
  isVerificationStatus,
  normalizeCountryCode,
  validateIdentityAttestation,
  validateIdentityRequest,
  type AttestationKind,
  type IdentityRecord,
  type VerificationStatus,
} from "../../src/lib/identityPolicy";
import { appendAuditLog, type AuditLogRow } from "./moderationDb";
import { getPrisma } from "./prisma";

function parseCountryCodes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c): c is string => typeof c === "string")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
}

function mapUserIdentity(row: {
  userId: string;
  verificationStatus: string;
  countryCodes: unknown;
  longTermTiesNote: string | null;
  attestationKind: string;
  verifiedBy: string | null;
  verifiedAt: Date | null;
  providerStub: string | null;
  updatedAt: Date;
}): IdentityRecord {
  return {
    user_id: row.userId,
    verification_status: isVerificationStatus(row.verificationStatus)
      ? row.verificationStatus
      : "unverified",
    country_codes: parseCountryCodes(row.countryCodes),
    long_term_ties_note: row.longTermTiesNote,
    attestation_kind: (row.attestationKind as AttestationKind) || "none",
    verified_by: row.verifiedBy,
    verified_at: row.verifiedAt ? row.verifiedAt.toISOString() : null,
    provider_stub: row.providerStub,
    updated_at: row.updatedAt.toISOString(),
  };
}

export async function listUserIdentities(): Promise<IdentityRecord[]> {
  const rows = await getPrisma().userIdentity.findMany({
    orderBy: { userId: "asc" },
  });
  return rows.map(mapUserIdentity);
}

export async function getUserIdentity(
  userId: string,
): Promise<IdentityRecord | null> {
  const row = await getPrisma().userIdentity.findUnique({
    where: { userId },
  });
  return row ? mapUserIdentity(row) : null;
}

/** Resolve identity or a default unverified stub for policy checks. */
export async function resolveUserIdentity(
  userId: string,
): Promise<IdentityRecord> {
  return (await getUserIdentity(userId)) ?? defaultIdentityRecord(userId);
}

export type IdentityMutationError =
  | { code: "not_owner"; message: string }
  | { code: "unknown_user"; message: string }
  | { code: "invalid_status"; message: string }
  | { code: "invalid_input"; message: string }
  | { code: "cannot_self_verify"; message: string };

export async function requestIdentityVerification(input: {
  actor_id: string;
  subject_user_id: string;
}): Promise<
  | { ok: true; identity: IdentityRecord; audit: AuditLogRow }
  | { ok: false; error: IdentityMutationError }
> {
  const check = validateIdentityRequest({
    actor_id: input.actor_id,
    subject_user_id: input.subject_user_id,
  });
  if (!check.ok) {
    return { ok: false, error: { code: check.code, message: check.message } };
  }

  const now = new Date();
  const existing = await getPrisma().userIdentity.findUnique({
    where: { userId: input.subject_user_id },
  });

  const row = existing
    ? await getPrisma().userIdentity.update({
        where: { userId: input.subject_user_id },
        data: {
          verificationStatus: "pending",
          attestationKind: "self_asserted",
          providerStub: existing.providerStub ?? "prototype",
          updatedAt: now,
        },
      })
    : await getPrisma().userIdentity.create({
        data: {
          userId: input.subject_user_id,
          verificationStatus: "pending",
          countryCodes: [],
          longTermTiesNote: null,
          attestationKind: "self_asserted",
          verifiedBy: null,
          verifiedAt: null,
          providerStub: "prototype",
          updatedAt: now,
        },
      });

  const identity = mapUserIdentity(row);
  const audit = await appendAuditLog({
    action: "identity_request",
    actor_id: input.actor_id,
    subject_id: input.subject_user_id,
    payload: { verification_status: "pending", auth_mode: AUTH_MODE },
  });
  return { ok: true, identity, audit };
}

export async function attestUserIdentity(input: {
  actor_id: string;
  subject_user_id: string;
  verification_status: VerificationStatus;
  country_codes?: string[];
  long_term_ties_note?: string | null;
  provider_stub?: string | null;
}): Promise<
  | { ok: true; identity: IdentityRecord; audit: AuditLogRow }
  | { ok: false; error: IdentityMutationError }
> {
  const check = validateIdentityAttestation({
    actor_id: input.actor_id,
    subject_user_id: input.subject_user_id,
    verification_status: input.verification_status,
  });
  if (!check.ok) {
    return { ok: false, error: { code: check.code, message: check.message } };
  }

  const countries = (input.country_codes ?? [])
    .map((c) => normalizeCountryCode(c))
    .filter((c): c is string => Boolean(c));
  const ties = input.long_term_ties_note?.trim() || null;

  const now = new Date();
  const verified =
    input.verification_status === "verified"
      ? { verifiedBy: input.actor_id, verifiedAt: now }
      : { verifiedBy: null as string | null, verifiedAt: null as Date | null };

  const existing = await getPrisma().userIdentity.findUnique({
    where: { userId: input.subject_user_id },
  });

  const row = existing
    ? await getPrisma().userIdentity.update({
        where: { userId: input.subject_user_id },
        data: {
          verificationStatus: input.verification_status,
          countryCodes: countries,
          longTermTiesNote: ties,
          attestationKind: "owner_attested",
          verifiedBy: verified.verifiedBy,
          verifiedAt: verified.verifiedAt,
          providerStub:
            input.provider_stub ?? existing.providerStub ?? "prototype",
          updatedAt: now,
        },
      })
    : await getPrisma().userIdentity.create({
        data: {
          userId: input.subject_user_id,
          verificationStatus: input.verification_status,
          countryCodes: countries,
          longTermTiesNote: ties,
          attestationKind: "owner_attested",
          verifiedBy: verified.verifiedBy,
          verifiedAt: verified.verifiedAt,
          providerStub: input.provider_stub ?? "prototype",
          updatedAt: now,
        },
      });

  const identity = mapUserIdentity(row);
  const audit = await appendAuditLog({
    action: "identity_attest",
    actor_id: input.actor_id,
    subject_id: input.subject_user_id,
    payload: {
      verification_status: identity.verification_status,
      country_codes: identity.country_codes,
      long_term_ties_note: identity.long_term_ties_note,
      auth_mode: AUTH_MODE,
    },
  });
  return { ok: true, identity, audit };
}

export async function getStewardEligibilityForUser(input: {
  user_id: string;
  country_code: string | null;
}): Promise<{
  auth_mode: typeof AUTH_MODE;
  identity: IdentityRecord;
  eligibility: ReturnType<typeof evaluateStewardEligibility>;
}> {
  const identity = await resolveUserIdentity(input.user_id);
  const eligibility = evaluateStewardEligibility({
    actor_id: input.user_id,
    country_code: input.country_code,
    identity,
    require_manual_country: true,
  });
  return { auth_mode: AUTH_MODE, identity, eligibility };
}
