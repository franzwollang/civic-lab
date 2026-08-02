/**
 * Smoke: home preamble live exemplar links (OPEN_ISSUES §5).
 * Static checks — no DB required.
 *
 * Run: pnpm exec tsx scripts/smoke-home-preamble.ts
 */
import { promises as fs } from "fs";
import path from "path";
import {
  HOME_EXEMPLAR_REQUIRED_HREFS,
  HOME_EXEMPLARS,
} from "../src/lib/homeExemplars";

const ROOT = process.cwd();

async function main() {
  if (HOME_EXEMPLARS.length < 4) {
    throw new Error("expected at least four home exemplars");
  }

  for (const required of HOME_EXEMPLAR_REQUIRED_HREFS) {
    const hit = HOME_EXEMPLARS.some((ex) => ex.href.includes(required));
    if (!hit) {
      throw new Error(`HOME_EXEMPLARS missing href fragment: ${required}`);
    }
  }

  const home = await fs.readFile(
    path.join(ROOT, "src/app/pages/home.tsx"),
    "utf8",
  );
  if (!home.includes('id="what-is-this"')) {
    throw new Error('home.tsx missing id="what-is-this" section');
  }
  if (!home.includes("HOME_EXEMPLARS")) {
    throw new Error("home.tsx must render HOME_EXEMPLARS");
  }
  if (!home.includes("/#what-is-this")) {
    throw new Error("hero CTA should deep-link to /#what-is-this");
  }

  const markers = [
    "Canon",
    "Country Manuals",
    "lane hygiene",
    "Threads are primary",
    "Red Team",
    "Adjudicators",
    "Scorable claims",
  ];
  for (const m of markers) {
    if (!home.includes(m)) {
      throw new Error(`home preamble missing CONCEPT marker: ${m}`);
    }
  }

  const seeds = {
    collections: await fs.readFile(
      path.join(ROOT, "prisma/seed/collections.json"),
      "utf8",
    ),
    dossiers: await fs.readFile(
      path.join(ROOT, "prisma/seed/dossiers.json"),
      "utf8",
    ),
    threads: await fs.readFile(
      path.join(ROOT, "prisma/seed/threads.json"),
      "utf8",
    ),
    findings: await fs.readFile(
      path.join(ROOT, "prisma/seed/findings.json"),
      "utf8",
    ),
  };

  if (!seeds.collections.includes('"collection_id": "collection-us"')) {
    throw new Error("seed missing collection-us");
  }
  if (!seeds.collections.includes('"collection_id": "collection-canon"')) {
    throw new Error("seed missing collection-canon");
  }
  if (!seeds.dossiers.includes('"dossier_id": "us-voting-1"')) {
    throw new Error("seed missing us-voting-1");
  }
  if (!seeds.threads.includes('"thread_id": "thread-us-voter-reg-rfc"')) {
    throw new Error("seed missing live RFC thread-us-voter-reg-rfc");
  }
  if (!seeds.threads.includes('"thread_id": "thread-us-provisional-open"')) {
    throw new Error("seed missing open thread-us-provisional-open");
  }
  if (
    !seeds.findings.includes(
      '"finding_id": "finding-us-voter-reg-critical"',
    )
  ) {
    throw new Error("seed missing finding-us-voter-reg-critical");
  }

  console.log("smoke-home-preamble: OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
