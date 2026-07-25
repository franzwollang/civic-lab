/**
 * Smoke: M8 first-cut corpus search (dossiers / artifacts / threads / claims).
 * Run: DATABASE_URL="file:./smoke-search.db" pnpm exec tsx scripts/smoke-search.ts
 */
import { promises as fs } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { execFile } from "child_process";
import { promisify } from "util";
import { seedIfEmpty } from "../prisma/seed";
import { setPrisma, searchCorpus } from "../server/db";
import {
  clampSearchLimit,
  normalizeSearchQuery,
  scoreMatch,
  SEARCH_DEFAULT_LIMIT,
  SEARCH_MAX_LIMIT,
  threadHref,
} from "../src/lib/search";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "prisma", "smoke-search.db");

async function main() {
  // Unit checks (no DB)
  if (normalizeSearchQuery("  voter   reg ") !== "voter reg") {
    throw new Error("normalizeSearchQuery collapse");
  }
  if (clampSearchLimit(0) !== 1 || clampSearchLimit(999) !== SEARCH_MAX_LIMIT) {
    throw new Error("clampSearchLimit bounds");
  }
  if (clampSearchLimit(undefined) !== SEARCH_DEFAULT_LIMIT) {
    throw new Error("clampSearchLimit default");
  }
  if (scoreMatch("voting", { title: "Voting Systems" }) < 60) {
    throw new Error("scoreMatch title contains");
  }
  if (scoreMatch("xyz", { title: "Voting Systems" }) !== 0) {
    throw new Error("scoreMatch miss");
  }
  if (threadHref("t1", "rfc") !== "/thread/t1/rfc") {
    throw new Error("threadHref rfc");
  }
  if (threadHref("t1", "open") !== "/thread/t1") {
    throw new Error("threadHref open");
  }

  process.env.DATABASE_URL = "file:./smoke-search.db";
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

    const empty = await searchCorpus("   ");
    if (empty.hits.length !== 0 || empty.query !== "") {
      throw new Error("empty query must yield no hits");
    }

    const voting = await searchCorpus("voting");
    if (voting.query !== "voting") {
      throw new Error(`query normalize: ${voting.query}`);
    }
    const kinds = new Set(voting.hits.map((h) => h.kind));
    if (!kinds.has("dossier")) {
      throw new Error("expected dossier hit for 'voting'");
    }
    if (!kinds.has("artifact")) {
      throw new Error("expected artifact hit for 'voting'");
    }
    const dossierHit = voting.hits.find((h) => h.kind === "dossier");
    if (!dossierHit?.href.startsWith("/dossier/")) {
      throw new Error(`bad dossier href: ${dossierHit?.href}`);
    }

    const provisional = await searchCorpus("provisional");
    const threadHit = provisional.hits.find((h) => h.kind === "thread");
    if (!threadHit) {
      throw new Error("expected thread hit for 'provisional'");
    }
    if (!threadHit.href.includes("/thread/")) {
      throw new Error(`bad thread href: ${threadHit.href}`);
    }

    const turnout = await searchCorpus("OECD");
    const claimHit = turnout.hits.find((h) => h.kind === "claim");
    if (!claimHit) {
      throw new Error("expected claim hit for 'OECD'");
    }
    if (!claimHit.href.includes("/artifact/") || !claimHit.href.includes("#claim-")) {
      throw new Error(`bad claim href: ${claimHit.href}`);
    }

    const limited = await searchCorpus("e", 3);
    if (limited.hits.length > 3) {
      throw new Error(`limit ignored: ${limited.hits.length}`);
    }

    // Rank: exact/prefix title should beat body-only when both match.
    const ranked = await searchCorpus("Voter Registration");
    if (ranked.hits.length < 1) {
      throw new Error("expected hits for Voter Registration");
    }
    if (ranked.hits[0]!.score < ranked.hits.at(-1)!.score) {
      throw new Error("hits not sorted by score desc");
    }

    console.log("smoke-search: ok", {
      voting: voting.hits.length,
      provisional: provisional.hits.length,
      oecd: turnout.hits.length,
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
