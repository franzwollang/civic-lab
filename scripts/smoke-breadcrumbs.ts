/**
 * Smoke: M8 breadcrumbs nav helpers + dossier/thread nav context fields.
 * Run: DATABASE_URL="file:./smoke-breadcrumbs.db" pnpm exec tsx scripts/smoke-breadcrumbs.ts
 */
import { promises as fs } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { execFile } from "child_process";
import { promisify } from "util";
import { seedIfEmpty } from "../prisma/seed";
import { setPrisma, getDossier, getThread } from "../server/db";
import {
  areaHref,
  areaKindFromCollection,
  areaLabel,
  buildHierarchyCrumbs,
  collectionHref,
} from "../src/app/lib/object-nav";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "prisma", "smoke-breadcrumbs.db");

async function main() {
  process.env.DATABASE_URL = "file:./smoke-breadcrumbs.db";
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

    if (areaHref("canon") !== "/canon") throw new Error("areaHref canon");
    if (areaHref("manuals") !== "/manuals") throw new Error("areaHref manuals");
    if (areaLabel("manuals") !== "Manuals") throw new Error("areaLabel");
    if (collectionHref("collection-us") !== "/collection/collection-us") {
      throw new Error("collectionHref");
    }

    const usDossier = await getDossier("us-voting-1");
    if (!usDossier) throw new Error("us-voting-1 missing");
    if (usDossier.area_kind !== "manuals") {
      throw new Error(`US dossier area_kind=${usDossier.area_kind}`);
    }
    if (usDossier.area_id !== "area-manuals") {
      throw new Error(`US dossier area_id=${usDossier.area_id}`);
    }
    if (!usDossier.collection_title) {
      throw new Error("US dossier missing collection_title");
    }
    if (areaKindFromCollection(usDossier) !== "manuals") {
      throw new Error("areaKindFromCollection US");
    }

    const crumbs = buildHierarchyCrumbs({
      area_kind: usDossier.area_kind!,
      collection_id: usDossier.collection_id,
      collection_title: usDossier.collection_title,
      dossier_id: usDossier.dossier_id,
      dossier_title: usDossier.title,
      leaf: [{ label: "Sample artifact" }],
    });
    if (crumbs.length !== 4) {
      throw new Error(`expected 4 crumbs, got ${crumbs.length}`);
    }
    if (crumbs[0].href !== "/manuals" || crumbs[0].label !== "Manuals") {
      throw new Error(`area crumb: ${JSON.stringify(crumbs[0])}`);
    }
    if (crumbs[1].href !== `/collection/${usDossier.collection_id}`) {
      throw new Error(`collection crumb: ${JSON.stringify(crumbs[1])}`);
    }
    if (crumbs[2].href !== `/dossier/${usDossier.dossier_id}`) {
      throw new Error(`dossier crumb: ${JSON.stringify(crumbs[2])}`);
    }
    if (crumbs[3].href !== undefined || crumbs[3].label !== "Sample artifact") {
      throw new Error(`leaf current: ${JSON.stringify(crumbs[3])}`);
    }

    const canonDossier = await getDossier("electoral-1");
    if (!canonDossier || canonDossier.area_kind !== "canon") {
      throw new Error("electoral-1 should be Canon area");
    }

    const thread = await getThread("thread-us-provisional-open");
    if (!thread) throw new Error("seed open thread missing");
    if (thread.home_dossier_title !== usDossier.title) {
      throw new Error(
        `thread home_dossier_title=${thread.home_dossier_title}`,
      );
    }
    if (thread.collection_id !== usDossier.collection_id) {
      throw new Error(`thread collection_id=${thread.collection_id}`);
    }
    if (thread.area_kind !== "manuals") {
      throw new Error(`thread area_kind=${thread.area_kind}`);
    }
    if (!thread.collection_title) {
      throw new Error("thread missing collection_title");
    }

    const rfc = await getThread("thread-us-voter-reg-rfc");
    if (!rfc?.collection_id || rfc.area_kind !== "manuals") {
      throw new Error("RFC thread missing nav context");
    }

    console.log("smoke-breadcrumbs: OK");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
