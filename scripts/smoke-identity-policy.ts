/**
 * Smoke: M9 real-identity policy hooks (CONCEPT §8.6).
 * Run: DATABASE_URL="file:./smoke-identity-policy.db" pnpm exec tsx scripts/smoke-identity-policy.ts
 */
import { promises as fs } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { execFile } from "child_process";
import { promisify } from "util";
import { seedIfEmpty } from "../prisma/seed";
import {
  setPrisma,
  getUserIdentity,
  listUserIdentities,
  requestIdentityVerification,
  attestUserIdentity,
  getStewardEligibilityForUser,
  decideThread,
  promoteThreadToRfc,
  createRevSet,
  listAuditLogs,
} from "../server/db";
import {
  AUTH_MODE,
  actorIsOwner,
  evaluateStewardEligibility,
  validateIdentityAttestation,
  validateIdentityRequest,
  defaultIdentityRecord,
} from "../src/lib/identityPolicy";
import { userHasCapability } from "../src/app/lib/role-affordances";
import { getPrototypeUser } from "../src/app/lib/prototype-users";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "prisma", "smoke-identity-policy.db");

async function main() {
  if (AUTH_MODE !== "session_with_identity_hooks") {
    throw new Error("AUTH_MODE mismatch");
  }
  if (!actorIsOwner("user-eve")) throw new Error("Eve should be owner");
  if (actorIsOwner("user-alice")) throw new Error("Alice is not owner");

  const denyStewardAttest = validateIdentityAttestation({
    actor_id: "user-alice",
    subject_user_id: "user-bob",
    verification_status: "verified",
  });
  if (denyStewardAttest.ok || denyStewardAttest.code !== "not_owner") {
    throw new Error("only Owner may attest");
  }

  const selfRequest = validateIdentityRequest({
    actor_id: "user-bob",
    subject_user_id: "user-bob",
  });
  if (!selfRequest.ok) throw new Error("subject may request verification");

  const aliceVerified = evaluateStewardEligibility({
    actor_id: "user-alice",
    country_code: "US",
    identity: {
      ...defaultIdentityRecord("user-alice"),
      verification_status: "verified",
      country_codes: ["US"],
      attestation_kind: "owner_attested",
    },
  });
  if (!aliceVerified.ok || aliceVerified.reason !== "verified_country") {
    throw new Error(`alice US eligibility: ${JSON.stringify(aliceVerified)}`);
  }

  const aliceWrongCountry = evaluateStewardEligibility({
    actor_id: "user-alice",
    country_code: "CA",
    identity: {
      ...defaultIdentityRecord("user-alice"),
      verification_status: "verified",
      country_codes: ["US"],
      attestation_kind: "owner_attested",
    },
  });
  if (
    aliceWrongCountry.ok ||
    aliceWrongCountry.code !== "steward_country_mismatch"
  ) {
    throw new Error("alice should fail CA without ties");
  }

  const tiesOk = evaluateStewardEligibility({
    actor_id: "user-alice",
    country_code: "CA",
    identity: {
      ...defaultIdentityRecord("user-alice"),
      verification_status: "verified",
      country_codes: [],
      long_term_ties_note: "Lived in Canada 12 years",
      attestation_kind: "owner_attested",
    },
  });
  if (!tiesOk.ok || tiesOk.reason !== "verified_long_term_ties") {
    throw new Error("long-term ties should pass");
  }

  const unverified = evaluateStewardEligibility({
    actor_id: "user-alice",
    country_code: "US",
    identity: defaultIdentityRecord("user-alice"),
  });
  if (unverified.ok || unverified.code !== "identity_unverified") {
    throw new Error("unverified steward blocked");
  }

  if (!userHasCapability(getPrototypeUser("user-eve"), "attest_identity")) {
    throw new Error("Owner needs attest_identity");
  }
  if (userHasCapability(getPrototypeUser("user-alice"), "attest_identity")) {
    throw new Error("Steward must not attest_identity");
  }

  process.env.DATABASE_URL = "file:./smoke-identity-policy.db";
  await fs.rm(DB_PATH, { force: true });
  await fs.rm(`${DB_PATH}-journal`, { force: true });

  const prismaCli = path.join(ROOT, "node_modules", "prisma", "build", "index.js");
  await execFileAsync(
    process.execPath,
    [prismaCli, "db", "push", "--skip-generate"],
    { cwd: ROOT, env: { ...process.env }, maxBuffer: 10 * 1024 * 1024 },
  );

  const prisma = new PrismaClient();
  setPrisma(prisma);
  try {
    const seeded = await seedIfEmpty(prisma);
    if (seeded !== "seeded") {
      throw new Error(`expected seeded, got ${seeded}`);
    }

    const all = await listUserIdentities();
    if (all.length < 6) {
      throw new Error(`expected seeded identities, got ${all.length}`);
    }
    const alice = await getUserIdentity("user-alice");
    if (!alice || alice.verification_status !== "verified") {
      throw new Error("Alice should be verified in seed");
    }
    if (!alice.country_codes.includes("US")) {
      throw new Error("Alice should be attested for US");
    }

    const elig = await getStewardEligibilityForUser({
      user_id: "user-alice",
      country_code: "US",
    });
    if (!elig.eligibility.ok) {
      throw new Error(`seed Alice US eligibility failed: ${JSON.stringify(elig)}`);
    }
    if (elig.auth_mode !== AUTH_MODE) {
      throw new Error("auth_mode missing on eligibility");
    }

    const bobElig = await getStewardEligibilityForUser({
      user_id: "user-bob",
      country_code: "US",
    });
    if (bobElig.eligibility.ok) {
      throw new Error("Bob contributor must not be steward-eligible");
    }

    // Owner attests Bob as steward-capable via long-term ties (still needs steward role —
    // attest alone does not grant role; check identity path for a steward without country).
    const req = await requestIdentityVerification({
      actor_id: "user-dave",
      subject_user_id: "user-dave",
    });
    if (!req.ok) throw new Error(`request failed: ${JSON.stringify(req)}`);
    if (req.identity.verification_status !== "pending") {
      throw new Error("request should set pending");
    }

    const denyBobAttest = await attestUserIdentity({
      actor_id: "user-bob",
      subject_user_id: "user-dave",
      verification_status: "verified",
      country_codes: ["US"],
    });
    if (denyBobAttest.ok || denyBobAttest.error.code !== "not_owner") {
      throw new Error("Bob must not attest");
    }

    const attestDave = await attestUserIdentity({
      actor_id: "user-eve",
      subject_user_id: "user-dave",
      verification_status: "verified",
      country_codes: ["US"],
    });
    if (!attestDave.ok) {
      throw new Error(`Owner attest failed: ${JSON.stringify(attestDave)}`);
    }
    if (attestDave.identity.verification_status !== "verified") {
      throw new Error("Dave should be verified after Owner attest");
    }

    const audits = await listAuditLogs({ action: "identity_attest", limit: 5 });
    if (audits.length < 1) {
      throw new Error("identity_attest audit missing");
    }

    // Unverified steward cannot decide Manual — strip Alice, promote open US thread.
    await prisma.userIdentity.update({
      where: { userId: "user-alice" },
      data: { verificationStatus: "unverified", countryCodes: [] },
    });

    const promoted = await promoteThreadToRfc({
      thread_id: "thread-us-provisional-open",
      author_id: "user-alice",
    });
    if (!promoted.ok) {
      throw new Error(`promote failed: ${JSON.stringify(promoted)}`);
    }
    const leafId = promoted.thread.thread_id;
    const rev = await createRevSet({
      thread_id: leafId,
      author_id: "user-bob",
      summary: "identity gate proposal",
      content_json: [
        {
          type: "p",
          id: "id-gate-p1",
          children: [{ text: "identity gate body" }],
        },
      ],
    });
    if (!rev.ok) throw new Error(`revset failed: ${JSON.stringify(rev)}`);

    const blocked = await decideThread({
      thread_id: leafId,
      outcome: "parked",
      author_id: "user-alice",
    });
    if (
      blocked.ok ||
      !("code" in blocked.error) ||
      blocked.error.code !== "identity_unverified"
    ) {
      throw new Error(
        `expected identity_unverified on decide, got ${JSON.stringify(blocked)}`,
      );
    }

    // Owner bypasses identity gate (CONCEPT §8.6 meta).
    const ownerOk = await decideThread({
      thread_id: leafId,
      outcome: "parked",
      author_id: "user-eve",
    });
    if (!ownerOk.ok) {
      throw new Error(
        `Owner should park despite Alice unverified: ${JSON.stringify(ownerOk)}`,
      );
    }

    console.log("smoke-identity-policy: OK");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
