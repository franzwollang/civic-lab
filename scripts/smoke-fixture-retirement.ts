/**
 * Smoke: fixture retirement — demo pages gone; legacy routes redirect;
 * sidebar Red Team no longer hardcodes /red-team/1; artifact actions
 * no longer hardcode thread-1.
 *
 * Run: DATABASE_URL="file:./smoke-fixture-retirement.db" pnpm exec tsx scripts/smoke-fixture-retirement.ts
 */
import { promises as fs } from "fs";
import path from "path";

const ROOT = process.cwd();

async function assertMissing(rel: string) {
  try {
    await fs.access(path.join(ROOT, rel));
    throw new Error(`expected deleted: ${rel}`);
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code !== "ENOENT") throw err;
  }
}

async function main() {
  await assertMissing("src/app/pages/descriptive-artifact.tsx");
  await assertMissing("src/app/pages/red-team-review.tsx");

  const routes = await fs.readFile(
    path.join(ROOT, "src/app/routes.tsx"),
    "utf8",
  );
  if (
    /\bfrom\s+["'].*descriptive-artifact["']/.test(routes) ||
    /\bfrom\s+["'].*red-team-review["']/.test(routes) ||
    /\bDescriptiveArtifact\b/.test(routes) ||
    /\bRedTeamReview\b/.test(routes)
  ) {
    throw new Error("routes.tsx still imports demo pages");
  }
  if (!routes.includes("RedirectDescriptiveArtifact")) {
    throw new Error("missing RedirectDescriptiveArtifact");
  }
  if (!routes.includes("RedirectLegacyRedTeam")) {
    throw new Error("missing RedirectLegacyRedTeam");
  }

  const sidebar = await fs.readFile(
    path.join(ROOT, "src/app/components/sidebar-nav.tsx"),
    "utf8",
  );
  if (sidebar.includes("/red-team/1")) {
    throw new Error("sidebar still hardcodes /red-team/1");
  }
  if (!sidebar.includes("collectionId")) {
    throw new Error("sidebar should accept collectionId for live Red Team link");
  }

  const artifactPage = await fs.readFile(
    path.join(ROOT, "src/app/pages/artifact-page.tsx"),
    "utf8",
  );
  if (artifactPage.includes("/thread/thread-1")) {
    throw new Error("artifact-page still hardcodes thread-1");
  }
  if (!artifactPage.includes("getDossierThreads")) {
    throw new Error("artifact-page should load dossier threads for actions");
  }

  const threadPage = await fs.readFile(
    path.join(ROOT, "src/app/pages/thread-page.tsx"),
    "utf8",
  );
  const rfcPage = await fs.readFile(
    path.join(ROOT, "src/app/pages/rfc-thread-page.tsx"),
    "utf8",
  );
  if (
    threadPage.includes('"us-voting-1"') ||
    rfcPage.includes('"us-voting-1"')
  ) {
    throw new Error("thread/rfc pages still fall back to us-voting-1");
  }

  // No FIXTURE_* leftovers under product pages.
  const pagesDir = path.join(ROOT, "src/app/pages");
  const pageFiles = await fs.readdir(pagesDir);
  for (const f of pageFiles) {
    if (!f.endsWith(".tsx") && !f.endsWith(".ts")) continue;
    const body = await fs.readFile(path.join(pagesDir, f), "utf8");
    if (/\bFIXTURE_/.test(body) || /arrives with M7/.test(body)) {
      throw new Error(`fixture leftover in src/app/pages/${f}`);
    }
  }

  console.log("smoke-fixture-retirement: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
