/**
 * Smoke: R0 About as living owner_merge_only Canon artifact.
 * Run: DATABASE_URL="file:./smoke-about.db" pnpm exec tsx scripts/smoke-about.ts
 */
import { promises as fs } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { execFile } from "child_process";
import { promisify } from "util";
import { seedIfEmpty } from "../prisma/seed";
import { setPrisma, getArtifact, listArtifactRevisions } from "../server/db";
import { extractSectionsFromContent } from "../src/doc/sections";
import {
  ABOUT_ARTIFACT_ID,
  ABOUT_DOSSIER_ID,
  ABOUT_REVISION_ID,
  ABOUT_SECTION_IDS,
  aboutArtifactPath,
  missingAboutSeedChecks,
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
    if (artifact.current_revision_id !== ABOUT_REVISION_ID) {
      throw new Error(
        `expected current_revision_id ${ABOUT_REVISION_ID}, got ${artifact.current_revision_id}`,
      );
    }

    const revisions = await listArtifactRevisions(ABOUT_ARTIFACT_ID);
    const current = revisions.find(
      (r) => r.revision_id === artifact.current_revision_id,
    );
    if (!current) throw new Error("about current revision missing");

    const sections = extractSectionsFromContent(current.content_json);
    const section_ids = sections.map((s) => s.stable_key);
    const content_text = flattenText(current.content_json);
    const missing = missingAboutSeedChecks({
      artifact_id: artifact.artifact_id,
      dossier_id: artifact.dossier_id,
      owner_merge_only: Boolean(artifact.owner_merge_only),
      slug: artifact.slug,
      title: artifact.title,
      content_text,
      section_ids,
    });
    if (missing.length > 0) {
      throw new Error(`About seed checks failed: ${missing.join(" | ")}`);
    }
    for (const id of ABOUT_SECTION_IDS) {
      if (!section_ids.includes(id)) {
        throw new Error(`section id ${id} not extracted`);
      }
    }

    const productPath = aboutArtifactPath();
    if (
      productPath !==
      `/dossier/${ABOUT_DOSSIER_ID}/artifact/${ABOUT_ARTIFACT_ID}`
    ) {
      throw new Error(`bad about path: ${productPath}`);
    }

    // Route helper: /about thin redirect module must point at artifact path.
    const aboutSrc = await fs.readFile(
      path.join(ROOT, "src/app/pages/about.tsx"),
      "utf8",
    );
    if (!aboutSrc.includes("aboutArtifactPath") || !aboutSrc.includes("Navigate")) {
      throw new Error("/about must Navigate via aboutArtifactPath");
    }
    if (!aboutSrc.includes("hash")) {
      throw new Error("/about redirect must preserve location hash");
    }

    // DocumentReader emits heading DOM ids for deep links.
    const readerSrc = await fs.readFile(
      path.join(ROOT, "src/doc/DocumentReader.tsx"),
      "utf8",
    );
    if (!readerSrc.includes("headingDomId")) {
      throw new Error("DocumentReader should emit heading DOM ids");
    }

    // HTTP: artifact is reachable via API.
    const res = await app.request(`/api/artifacts/${ABOUT_ARTIFACT_ID}`);
    if (!res.ok) {
      throw new Error(`GET /api/artifacts/canon-about → ${res.status}`);
    }
    const body = (await res.json()) as { artifact_id?: string; slug?: string };
    if (body.artifact_id !== ABOUT_ARTIFACT_ID || body.slug !== "about") {
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
    await fs.rm(DB_PATH, { force: true });
    await fs.rm(`${DB_PATH}-journal`, { force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
