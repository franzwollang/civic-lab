/**
 * Smoke: Vite build output (`dist/`) must stay untracked.
 * Run: pnpm exec tsx scripts/smoke-dist-gitignore.ts
 */
import { promises as fs } from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();

async function main() {
  const gitignorePath = path.join(ROOT, ".gitignore");
  const gitignore = await fs.readFile(gitignorePath, "utf8");
  const lines = gitignore.split(/\r?\n/).map((l) => l.trim());
  const ignoresDist = lines.some(
    (l) => l === "dist" || l === "dist/" || l === "/dist" || l === "/dist/",
  );
  if (!ignoresDist) {
    throw new Error(".gitignore must ignore dist/ (build output)");
  }

  // In a git worktree, tracked dist files would defeat the ignore.
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["ls-files", "--", "dist", "dist/"],
      { cwd: ROOT, maxBuffer: 2 * 1024 * 1024 },
    );
    const tracked = stdout
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (tracked.length > 0) {
      throw new Error(
        `dist/ still tracked by git (${tracked.length} paths); run: git rm -r --cached dist`,
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("still tracked")) throw err;
    // Not a git checkout — ignore-file check alone is enough.
    if (!/not a git repository/i.test(msg)) {
      // Unexpected git failure: surface it.
      throw err;
    }
  }

  console.log("smoke-dist-gitignore: OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
