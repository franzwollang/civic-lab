/**
 * Smoke: Fumadocs unpin after Tailwind ≥4.3.2 (resolves `-inset-s-4`).
 * Static + installed-package checks — no DB required.
 *
 * Run: pnpm exec tsx scripts/smoke-fumadocs.ts
 */
import { promises as fs } from "fs";
import path from "path";
import { createRequire } from "module";

const ROOT = process.cwd();
const require = createRequire(path.join(ROOT, "package.json"));

function parseSemver(v: string): [number, number, number] {
  const cleaned = v.replace(/^[^0-9]*/, "").split(".").map((p) => parseInt(p, 10));
  return [cleaned[0] || 0, cleaned[1] || 0, cleaned[2] || 0];
}

function gte(a: string, b: string): boolean {
  const [a0, a1, a2] = parseSemver(a);
  const [b0, b1, b2] = parseSemver(b);
  if (a0 !== b0) return a0 > b0;
  if (a1 !== b1) return a1 > b1;
  return a2 >= b2;
}

async function main() {
  const pkg = JSON.parse(
    await fs.readFile(path.join(ROOT, "package.json"), "utf8"),
  ) as {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };

  const twDecl =
    pkg.devDependencies.tailwindcss || pkg.dependencies.tailwindcss;
  const twViteDecl =
    pkg.devDependencies["@tailwindcss/vite"] ||
    pkg.dependencies["@tailwindcss/vite"];
  const uiDecl = pkg.dependencies["fumadocs-ui"];
  const coreDecl = pkg.dependencies["fumadocs-core"];
  const mdxDecl = pkg.dependencies["fumadocs-mdx"];

  if (!twDecl || !gte(twDecl, "4.3.2")) {
    throw new Error(`tailwindcss must be ≥4.3.2 (got ${twDecl})`);
  }
  if (!twViteDecl || !gte(twViteDecl, "4.3.2")) {
    throw new Error(`@tailwindcss/vite must be ≥4.3.2 (got ${twViteDecl})`);
  }
  if (!uiDecl || !gte(uiDecl, "16.12.0")) {
    throw new Error(
      `fumadocs-ui must be ≥16.12.0 (unpinned from 16.5.4; got ${uiDecl})`,
    );
  }
  if (!coreDecl || !gte(coreDecl, "16.12.0")) {
    throw new Error(`fumadocs-core must be ≥16.12.0 (got ${coreDecl})`);
  }
  if (!mdxDecl) {
    throw new Error("fumadocs-mdx must remain declared (Vite MDX pipeline)");
  }

  const twInstalled = require("tailwindcss/package.json") as { version: string };
  const uiInstalled = require("fumadocs-ui/package.json") as { version: string };
  const coreInstalled = require("fumadocs-core/package.json") as {
    version: string;
  };
  if (!gte(twInstalled.version, "4.3.2")) {
    throw new Error(`installed tailwindcss ${twInstalled.version} < 4.3.2`);
  }
  if (!gte(uiInstalled.version, "16.12.0")) {
    throw new Error(`installed fumadocs-ui ${uiInstalled.version} < 16.12.0`);
  }
  if (!gte(coreInstalled.version, "16.12.0")) {
    throw new Error(
      `installed fumadocs-core ${coreInstalled.version} < 16.12.0`,
    );
  }

  // The historical Vite break: fumadocs CSS uses Tailwind logical inset utilities.
  const baseCss = await fs.readFile(
    path.join(ROOT, "node_modules/fumadocs-ui/css/lib/base.css"),
    "utf8",
  );
  if (!baseCss.includes("-inset-s-4") && !baseCss.includes("inset-s-4")) {
    throw new Error(
      "fumadocs-ui base.css missing inset-s-4 (expected after 16.12+)",
    );
  }

  const styles = await fs.readFile(
    path.join(ROOT, "src/styles/index.css"),
    "utf8",
  );
  for (const marker of [
    "fumadocs-ui/css/neutral.css",
    "fumadocs-ui/css/preset.css",
  ]) {
    if (!styles.includes(marker)) {
      throw new Error(`src/styles/index.css missing @import ${marker}`);
    }
  }

  const docsPage = await fs.readFile(
    path.join(ROOT, "src/app/pages/docs.tsx"),
    "utf8",
  );
  for (const marker of [
    'from "fumadocs-ui/layouts/docs"',
    'from "fumadocs-ui/layouts/docs/page"',
    'from "fumadocs-ui/mdx"',
  ]) {
    if (!docsPage.includes(marker)) {
      throw new Error(`docs.tsx missing import ${marker}`);
    }
  }

  const provider = await fs.readFile(
    path.join(ROOT, "src/app/DocsProviders.tsx"),
    "utf8",
  );
  if (!provider.includes("fumadocs-ui/provider/react-router")) {
    throw new Error("DocsProviders must use fumadocs-ui/provider/react-router");
  }

  const indexDoc = path.join(ROOT, "content/docs/index.mdx");
  await fs.access(indexDoc);

  // If a fresh vite build exists, confirm logical inset utilities landed in CSS.
  const distAssets = path.join(ROOT, "dist/assets");
  try {
    const files = await fs.readdir(distAssets);
    const cssFiles = files.filter((f) => f.endsWith(".css"));
    if (cssFiles.length > 0) {
      let found = false;
      for (const f of cssFiles) {
        const css = await fs.readFile(path.join(distAssets, f), "utf8");
        if (css.includes("inset-s-4") || css.includes("-inset-s-4")) {
          found = true;
          break;
        }
      }
      if (!found) {
        throw new Error(
          "dist CSS missing inset-s-4 — rebuild after Tailwind ≥4.3.2",
        );
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("inset-s-4")) throw err;
    // No dist yet — package/CSS checks above are enough for this smoke.
  }

  console.log(
    `smoke-fumadocs: OK (tailwind ${twInstalled.version}, fumadocs-ui ${uiInstalled.version})`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
