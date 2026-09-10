/**
 * Smoke: FAQ as living owner_merge_only Canon artifact.
 * Run: DATABASE_URL="file:./smoke-faq.db" pnpm exec tsx scripts/smoke-faq.ts
 */
import { promises as fs } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { execFile } from "child_process";
import { promisify } from "util";
import { seedIfEmpty } from "../prisma/seed";
import { setPrisma, getArtifact, listArtifactRevisions } from "../server/db";
import {
  FAQ_ARTIFACT_ID,
  FAQ_DOSSIER_ID,
  FAQ_CONTENT_MARKERS,
  FAQ_SECTION_IDS,
  faqArtifactPath,
  missingFaqMarkers,
} from "../src/lib/faq";
import { getPrototypeUser } from "../src/app/lib/prototype-users";
import { userHasCapability } from "../src/app/lib/role-affordances";
import { app } from "../server/index";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "prisma", "smoke-faq.db");

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
  process.env.DATABASE_URL = "file:./smoke-faq.db";
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
      where: { dossierId: FAQ_DOSSIER_ID },
    });
    if (!dossier || dossier.collectionId !== "collection-canon") {
      throw new Error("canon-governance-1 missing under Canon");
    }

    const artifact = await getArtifact(FAQ_ARTIFACT_ID);
    if (!artifact) throw new Error("canon-faq missing");

    const revisions = await listArtifactRevisions(FAQ_ARTIFACT_ID);
    const current = revisions.find(
      (r) => r.revision_id === artifact.current_revision_id,
    );
    if (!current) throw new Error("faq current revision missing");

    const content_text = flattenText(current.content_json);
    const missing = missingFaqMarkers({
      artifact_id: artifact.artifact_id,
      dossier_id: artifact.dossier_id,
      owner_merge_only: Boolean(artifact.owner_merge_only),
      title: artifact.title,
      content_text,
    });
    if (missing.length > 0) {
      throw new Error(`FAQ markers missing: ${missing.join(" | ")}`);
    }
    if (FAQ_CONTENT_MARKERS.length < 5) {
      throw new Error("expected ≥5 content markers");
    }

    // Section ids for legacy /faq#… deep links must be present on headings.
    const blocks = Array.isArray(current.content_json)
      ? (current.content_json as Array<{ type?: string; id?: string }>)
      : [];
    for (const sectionId of FAQ_SECTION_IDS) {
      const hit = blocks.find(
        (b) =>
          (b.type === "h2" || b.type === "h3") && b.id === sectionId,
      );
      if (!hit) {
        throw new Error(`missing FAQ section heading id=${sectionId}`);
      }
    }

    const productPath = faqArtifactPath();
    if (
      productPath !==
      `/dossier/${FAQ_DOSSIER_ID}/artifact/${FAQ_ARTIFACT_ID}`
    ) {
      throw new Error(`bad faq path: ${productPath}`);
    }

    const res = await app.request(`/api/artifacts/${FAQ_ARTIFACT_ID}`);
    if (res.status !== 200) {
      throw new Error(`GET faq artifact expected 200, got ${res.status}`);
    }
    const body = (await res.json()) as { artifact_id?: string };
    if (body.artifact_id !== FAQ_ARTIFACT_ID) {
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

    console.log("smoke-faq: OK");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
