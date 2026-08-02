/**
 * Smoke: About as living owner_merge_only Canon artifact.
 * Run: DATABASE_URL="file:./smoke-about.db" pnpm exec tsx scripts/smoke-about.ts
 */
import { promises as fs } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { execFile } from "child_process";
import { promisify } from "util";
import { seedIfEmpty } from "../prisma/seed";
import { setPrisma, getArtifact, listArtifactRevisions } from "../server/db";
import {
  ABOUT_ARTIFACT_ID,
  ABOUT_DOSSIER_ID,
  ABOUT_CONTENT_MARKERS,
  aboutArtifactPath,
  missingAboutMarkers,
} from "../src/lib/about";
import { getPrototypeUser } from "../src/app/lib/prototype-users";
import { userHasCapability } from "../src/app/lib/role-affordances";
import { app } from "../server/index";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "prisma", "smoke-about.db");

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
  process.env.DATABASE_URL = "file:./smoke-about.db";
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
      where: { dossierId: ABOUT_DOSSIER_ID },
    });
    if (!dossier || dossier.collectionId !== "collection-canon") {
      throw new Error("canon-governance-1 missing under Canon");
    }

    const artifact = await getArtifact(ABOUT_ARTIFACT_ID);
    if (!artifact) throw new Error("canon-about missing");

    const revisions = await listArtifactRevisions(ABOUT_ARTIFACT_ID);
    const current = revisions.find(
      (r) => r.revision_id === artifact.current_revision_id,
    );
    if (!current) throw new Error("about current revision missing");

    const content_text = flattenText(current.content_json);
    const missing = missingAboutMarkers({
      artifact_id: artifact.artifact_id,
      dossier_id: artifact.dossier_id,
      owner_merge_only: Boolean(artifact.owner_merge_only),
      title: artifact.title,
      content_text,
    });
    if (missing.length > 0) {
      throw new Error(`About markers missing: ${missing.join(" | ")}`);
    }
    if (ABOUT_CONTENT_MARKERS.length < 5) {
      throw new Error("expected ≥5 content markers");
    }

    // Section ids for legacy /about#… deep links must be present on headings.
    const blocks = Array.isArray(current.content_json)
      ? (current.content_json as Array<{ type?: string; id?: string }>)
      : [];
    for (const sectionId of ["two-channels", "workflow", "get-involved"]) {
      const hit = blocks.find((b) => b.type === "h2" && b.id === sectionId);
      if (!hit) {
        throw new Error(`missing About section heading id=${sectionId}`);
      }
    }

    const productPath = aboutArtifactPath();
    if (
      productPath !==
      `/dossier/${ABOUT_DOSSIER_ID}/artifact/${ABOUT_ARTIFACT_ID}`
    ) {
      throw new Error(`bad about path: ${productPath}`);
    }

    // API: artifact is fetchable (route used by DocumentReader / artifact page).
    const res = await app.request(`/api/artifacts/${ABOUT_ARTIFACT_ID}`);
    if (res.status !== 200) {
      throw new Error(`GET about artifact expected 200, got ${res.status}`);
    }
    const body = (await res.json()) as { artifact_id?: string };
    if (body.artifact_id !== ABOUT_ARTIFACT_ID) {
      throw new Error(`unexpected artifact payload: ${JSON.stringify(body)}`);
    }

    const eve = getPrototypeUser("user-eve")!;
    const carol = getPrototypeUser("user-carol")!;
    if (!userHasCapability(eve, "merge_canon_restricted")) {
      throw new Error("Owner must have merge_canon_restricted");
    }
    if (userHasCapability(carol, "merge_canon_restricted")) {
      throw new Error("Editor must not have merge_canon_restricted");
    }

    console.log("smoke-about: OK");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
