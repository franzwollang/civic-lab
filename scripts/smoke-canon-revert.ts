/**
 * Smoke: CONCEPT §9.3 / §9.4 Owner Canon revert (audit-logged).
 * Run: DATABASE_URL="file:./smoke-canon-revert.db" pnpm exec tsx scripts/smoke-canon-revert.ts
 */
import { promises as fs } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { execFile } from "child_process";
import { promisify } from "util";
import { seedIfEmpty } from "../prisma/seed";
import {
  setPrisma,
  createArtifactRevision,
  updateArtifact,
  getArtifact,
  revertCanonArtifact,
  listAuditLogs,
} from "../server/db";
import { validateCanonRevert } from "../src/lib/canonRevert";
import { userHasCapability } from "../src/app/lib/role-affordances";
import { getPrototypeUser } from "../src/app/lib/prototype-users";
import { ABOUT_ARTIFACT_ID } from "../src/lib/about";
import { app } from "../server/index";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "prisma", "smoke-canon-revert.db");

async function main() {
  // Unit gates
  const ownerCanon = validateCanonRevert({
    actor_id: "user-eve",
    context: { area_kind: "canon" },
  });
  if (!ownerCanon.ok) throw new Error("Owner should pass Canon revert gate");

  const editorCanon = validateCanonRevert({
    actor_id: "user-carol",
    context: { area_kind: "canon" },
  });
  if (editorCanon.ok || editorCanon.code !== "not_owner") {
    throw new Error("Editor must fail Canon revert gate");
  }

  const ownerManual = validateCanonRevert({
    actor_id: "user-eve",
    context: { area_kind: "manuals" },
  });
  if (ownerManual.ok || ownerManual.code !== "not_canon") {
    throw new Error("Owner Manual revert must be not_canon");
  }

  const eve = getPrototypeUser("user-eve")!;
  const carol = getPrototypeUser("user-carol")!;
  if (!userHasCapability(eve, "revert_canon")) {
    throw new Error("Owner must have revert_canon");
  }
  if (userHasCapability(carol, "revert_canon")) {
    throw new Error("Editor must not have revert_canon");
  }

  process.env.DATABASE_URL = "file:./smoke-canon-revert.db";
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

    const about = await getArtifact(ABOUT_ARTIFACT_ID);
    if (!about?.current_revision_id) {
      throw new Error("canon-about missing current revision");
    }
    const baseRev = about.current_revision_id;
    const childRev = "rev-canon-about-smoke-child";

    await createArtifactRevision({
      revision_id: childRev,
      artifact_id: ABOUT_ARTIFACT_ID,
      parent_revision_id: baseRev,
      author: "smoke",
      content_json: [
        {
          type: "h2",
          id: "about-smoke-child",
          children: [{ text: "About (smoke child revision)" }],
        },
        {
          type: "p",
          id: "about-smoke-p",
          children: [{ text: "Temporary tip revision for revert smoke." }],
        },
      ],
    });
    const tip = await updateArtifact(ABOUT_ARTIFACT_ID, {
      current_revision_id: childRev,
    });
    if (!tip.ok || tip.artifact.current_revision_id !== childRev) {
      throw new Error("failed to advance canon-about tip");
    }

    const forbidden = await revertCanonArtifact({
      artifact_id: ABOUT_ARTIFACT_ID,
      actor_id: "user-carol",
    });
    if (forbidden.ok || forbidden.error.code !== "not_owner") {
      throw new Error("Carol must not revert Canon");
    }

    // Manual artifact — Owner still blocked (Canon-only)
    const manual = await prisma.artifact.findFirst({
      where: {
        dossier: { collection: { area: { kind: "manuals" } } },
      },
    });
    if (!manual) throw new Error("expected a Manual artifact in seed");
    const manualAttempt = await revertCanonArtifact({
      artifact_id: manual.artifactId,
      actor_id: "user-eve",
    });
    if (manualAttempt.ok || manualAttempt.error.code !== "not_canon") {
      throw new Error("Owner must not revert Manual via Canon revert API");
    }

    const ok = await revertCanonArtifact({
      artifact_id: ABOUT_ARTIFACT_ID,
      actor_id: "user-eve",
    });
    if (!ok.ok) {
      throw new Error(`Owner revert failed: ${ok.error.code}`);
    }
    if (ok.from_revision_id !== childRev || ok.to_revision_id !== baseRev) {
      throw new Error(
        `bad revert lineage: ${ok.from_revision_id} → ${ok.to_revision_id}`,
      );
    }
    if (ok.artifact.current_revision_id !== baseRev) {
      throw new Error("artifact tip not restored");
    }
    if (ok.audit.action !== "revert") {
      throw new Error("audit action must be revert");
    }

    const audits = await listAuditLogs({ action: "revert", limit: 10 });
    if (!audits.some((a) => a.subject_id === ABOUT_ARTIFACT_ID)) {
      throw new Error("revert audit missing from list");
    }

    // Re-advance tip, then HTTP Owner revert + editor 403 (session-bound)
    await updateArtifact(ABOUT_ARTIFACT_ID, { current_revision_id: childRev });
    const { loginAs, withSession } = await import("./session-smoke-helper");
    const eveCookie = await loginAs("user-eve");
    const carolCookie = await loginAs("user-carol");

    const httpOk = await app.request(
      `/api/artifacts/${ABOUT_ARTIFACT_ID}/revert`,
      withSession(eveCookie, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    if (httpOk.status !== 200) {
      throw new Error(`HTTP Owner revert expected 200, got ${httpOk.status}`);
    }
    const httpBody = (await httpOk.json()) as {
      to_revision_id?: string;
      audit?: { action?: string };
    };
    if (httpBody.to_revision_id !== baseRev || httpBody.audit?.action !== "revert") {
      throw new Error("HTTP revert body missing lineage/audit");
    }

    const httpForbidden = await app.request(
      `/api/artifacts/${ABOUT_ARTIFACT_ID}/revert`,
      withSession(carolCookie, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor_id: "user-eve" }),
      }),
    );
    if (httpForbidden.status !== 403) {
      throw new Error(
        `HTTP editor revert expected 403, got ${httpForbidden.status}`,
      );
    }

    // nothing_to_revert when at root
    const root = await revertCanonArtifact({
      artifact_id: ABOUT_ARTIFACT_ID,
      actor_id: "user-eve",
    });
    if (root.ok || root.error.code !== "nothing_to_revert") {
      throw new Error("root revision should be nothing_to_revert");
    }

    console.log("smoke-canon-revert: OK");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
