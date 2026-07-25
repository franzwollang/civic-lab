/**
 * Run all scripts/smoke-*.ts sequentially. Exit 1 if any fail.
 * Usage: pnpm test:smoke
 */
import { promises as fs } from "fs";
import path from "path";
import { spawn } from "child_process";

const ROOT = process.cwd();
const SCRIPTS = path.join(ROOT, "scripts");

function run(file: string): Promise<number> {
  const name = path.basename(file, ".ts");
  const db = `file:./${name}.db`;
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [path.join(ROOT, "node_modules", "tsx", "dist", "cli.mjs"), file],
      {
        cwd: ROOT,
        env: { ...process.env, DATABASE_URL: db },
        stdio: "inherit",
      },
    );
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

async function main() {
  const entries = (await fs.readdir(SCRIPTS))
    .filter((f) => f.startsWith("smoke-") && f.endsWith(".ts"))
    .sort();
  let failed = 0;
  for (const f of entries) {
    const full = path.join(SCRIPTS, f);
    process.stdout.write(`\n=== ${f} ===\n`);
    const code = await run(full);
    if (code !== 0) {
      failed += 1;
      console.error(`FAIL ${f} (exit ${code})`);
    } else {
      console.log(`PASS ${f}`);
    }
  }
  console.log(`\nSUMMARY: ${entries.length - failed}/${entries.length} passed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
