/**
 * Smoke: M9 Charter as living owner_merge_only Canon artifact (CONCEPT §9.3).
 * Run: DATABASE_URL="file:./smoke-charter.db" pnpm exec tsx scripts/smoke-charter.ts
 */
import { promises as fs } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { execFile } from "child_process";
import { promisify } from "util";
import { seedIfEmpty } from "../prisma/seed";
import { setPrisma, getArtifact, listArtifactRevisions } from "../server/db";
import {
  CHARTER_ARTIFACT_ID,
  CHARTER_DOSSIER_ID,
  CHARTER_MINIMUM_PREMISES,
  charterArtifactPath,
  missingCharterPremises,
} from "../src/lib/charter";
import { getPrototypeUser } from "../src/app/lib/prototype-users";
import { userHasCapability } from "../src/app/lib/role-affordances";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "prisma", "smoke-charter.db");

function flattenText(nodes: unknown): string {
  if (nodes == null) return "";
  if (typeof nodes === "string") return nodes;
  if (Array.isArray(nodes)) return nodes.map(flattenText).join(" ");
  if (typeof nodes === "object") {
    const o = nodes as Record<string, unknown>;
    if (typeof o.text === "string") return o.text;
    if (Array.isArray(o.children)) return flattenText(o.children);
  }
  return "";
}

async function main() {
  process.env.DATABASE_URL = "file:./smoke-charter.db";
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

    const dossier = await prisma.dossier.findUnique({
      where: { dossierId: CHARTER_DOSSIER_ID },
    });
    if (!dossier || dossier.collectionId !== "collection-canon") {
      throw new Error("canon-governance-1 missing under Canon");
    }

    const artifact = await getArtifact(CHARTER_ARTIFACT_ID);
    if (!artifact) throw new Error("canon-charter missing");

    const revisions = await listArtifactRevisions(CHARTER_ARTIFACT_ID);
    const current = revisions.find(
      (r) => r.revision_id === artifact.current_revision_id,
    );
    if (!current) throw new Error("charter current revision missing");

    const content_text = flattenText(current.content_json);
    const missing = missingCharterPremises({
      artifact_id: artifact.artifact_id,
      dossier_id: artifact.dossier_id,
      owner_merge_only: Boolean(artifact.owner_merge_only),
      title: artifact.title,
      content_text,
    });
    if (missing.length > 0) {
      throw new Error(`Charter premises missing: ${missing.join(" | ")}`);
    }
    if (CHARTER_MINIMUM_PREMISES.length < 4) {
      throw new Error("expected ≥4 minimum premises");
    }

    const path = charterArtifactPath();
    if (path !== `/dossier/${CHARTER_DOSSIER_ID}/artifact/${CHARTER_ARTIFACT_ID}`) {
      throw new Error(`bad charter path: ${path}`);
    }

    // Role gate: only Owner may edit restricted Canon in product chrome.
    const eve = getPrototypeUser("user-eve")!;
    const carol = getPrototypeUser("user-carol")!;
    if (!userHasCapability(eve, "merge_canon_restricted")) {
      throw new Error("Owner must have merge_canon_restricted");
    }
    if (userHasCapability(carol, "merge_canon_restricted")) {
      throw new Error("Editor must not have merge_canon_restricted");
    }

    console.log("smoke-charter: OK");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
