/**
 * Smoke: CONCEPT §5.2 model→forecast implication links (MVP).
 * Run: DATABASE_URL="file:./smoke-claim-implications.db" pnpm exec tsx scripts/smoke-claim-implications.ts
 */
import { promises as fs } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { execFile } from "child_process";
import { promisify } from "util";
import { seedIfEmpty } from "../prisma/seed";
import { setPrisma, createClaim, getClaim } from "../server/db";
import { app } from "../server/index";
import {
  IMPLIES_FORECAST_KIND,
  buildImpliesForecastLink,
  forecastIdsFromImpliesLinks,
  mergeImpliesForecastLinks,
  validateModelImplicationLinks,
} from "../src/lib/claimImplications";
import { loginAs, withSession } from "./session-smoke-helper";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "prisma", "smoke-claim-implications.db");

async function json(res: Response) {
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text) as unknown };
  } catch {
    return { status: res.status, body: text };
  }
}

async function main() {
  process.env.DATABASE_URL = "file:./smoke-claim-implications.db";
  await fs.rm(DB_PATH, { force: true });
  await fs.rm(`${DB_PATH}-journal`, { force: true });

  const prismaCli = path.join(
    ROOT,
    "node_modules",
    "prisma",
    "build",
    "index.js",
  );
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

    // Pure helpers
    const link = buildImpliesForecastLink("claim-canon-turnout-trend");
    if (link.kind !== IMPLIES_FORECAST_KIND) {
      throw new Error("buildImpliesForecastLink kind mismatch");
    }
    const merged = mergeImpliesForecastLinks({
      existingLinks: [{ artifact_id: "page-001" }],
      forecastClaimIds: ["claim-canon-turnout-trend", " claim-canon-turnout-trend "],
    });
    if (merged.length !== 2) {
      throw new Error(`expected preserved + one implies link, got ${merged.length}`);
    }
    const ids = forecastIdsFromImpliesLinks(merged);
    if (ids.join() !== "claim-canon-turnout-trend") {
      throw new Error(`dedupe failed: ${ids.join()}`);
    }

    const badType = validateModelImplicationLinks({
      empirical_type: "forecast",
      links: [link],
      resolveForecast: () => ({
        claim_id: "claim-canon-turnout-trend",
        profile: "empirical",
        empirical_type: "forecast",
      }),
    });
    if (badType.ok || badType.error.code !== "implies_requires_model") {
      throw new Error("forecast claim must reject implies_forecast links");
    }

    // Seeded model claim
    const seededModel = await getClaim("claim-canon-enp-model");
    if (!seededModel || seededModel.empirical_type !== "model") {
      throw new Error("missing seeded claim-canon-enp-model");
    }
    const seededImplies = forecastIdsFromImpliesLinks(seededModel.links);
    if (
      !seededImplies.includes("claim-canon-pr-enp-resolved") ||
      !seededImplies.includes("claim-canon-turnout-trend")
    ) {
      throw new Error(
        `seeded model missing implies edges: ${seededImplies.join(",")}`,
      );
    }

    // DB create: happy path
    const ok = await createClaim({
      claim_id: "claim-smoke-model-1",
      artifact_id: "page-001",
      profile: "empirical",
      text: "Smoke model: PR party fragmentation implies OECD turnout band stability.",
      empirical_type: "model",
      scope: "global",
      resolution_criteria: "Linked forecasts retain published criteria.",
      preferred_sources: ["ParlGov"],
      links: [
        buildImpliesForecastLink("claim-canon-turnout-trend"),
        buildImpliesForecastLink("claim-canon-pr-enp-resolved"),
      ],
      author_id: "user-carol",
    });
    if (!ok.ok) {
      throw new Error(`create model failed: ${JSON.stringify(ok.error)}`);
    }
    if (
      forecastIdsFromImpliesLinks(ok.claim.links).join(",") !==
      "claim-canon-turnout-trend,claim-canon-pr-enp-resolved"
    ) {
      throw new Error("created model links not returned");
    }

    // Reject implies on fact
    const badFact = await createClaim({
      claim_id: "claim-smoke-fact-implies",
      artifact_id: "page-001",
      profile: "empirical",
      text: "Fact should not carry implies_forecast.",
      empirical_type: "fact",
      scope: "global",
      as_of: "2024-01-01T00:00:00.000Z",
      links: [buildImpliesForecastLink("claim-canon-turnout-trend")],
      author_id: "user-carol",
    });
    if (badFact.ok || badFact.error.code !== "implies_requires_model") {
      throw new Error("fact+implies should be rejected");
    }

    // Reject missing target
    const missing = await createClaim({
      claim_id: "claim-smoke-model-missing",
      artifact_id: "page-001",
      profile: "empirical",
      text: "Model with missing forecast target.",
      empirical_type: "model",
      scope: "global",
      links: [buildImpliesForecastLink("claim-does-not-exist")],
      author_id: "user-carol",
    });
    if (missing.ok || missing.error.code !== "implies_target_not_found") {
      throw new Error("missing forecast target should 422");
    }

    // Reject non-forecast target (requirement claim)
    const notForecast = await createClaim({
      claim_id: "claim-smoke-model-req",
      artifact_id: "page-001",
      profile: "empirical",
      text: "Model pointing at a requirement claim.",
      empirical_type: "model",
      scope: "global",
      links: [buildImpliesForecastLink("claim-us-align-canon-criteria")],
      author_id: "user-carol",
    });
    if (
      notForecast.ok ||
      notForecast.error.code !== "implies_target_not_forecast"
    ) {
      throw new Error("requirement target should be rejected");
    }

    // HTTP create + list (session-bound)
    const carol = await loginAs("user-carol");
    const httpCreate = await json(
      await app.request(
        "/api/claims",
        withSession(carol, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            claim_id: "claim-smoke-model-http",
            artifact_id: "page-001",
            profile: "empirical",
            text: "HTTP model implies seeded turnout forecast.",
            empirical_type: "model",
            scope: "global",
            links: [buildImpliesForecastLink("claim-canon-turnout-trend")],
            author_id: "user-eve",
          }),
        }),
      ),
    );
    if (httpCreate.status !== 201) {
      throw new Error(
        `HTTP create expected 201, got ${httpCreate.status} ${JSON.stringify(httpCreate.body)}`,
      );
    }
    const body = httpCreate.body as {
      author_id?: string;
      empirical_type?: string;
      links?: unknown[];
    };
    if (body.author_id !== "user-carol") {
      throw new Error("HTTP create must use session actor, not body author_id");
    }
    if (body.empirical_type !== "model") {
      throw new Error("HTTP create missing model type");
    }
    if (
      forecastIdsFromImpliesLinks(body.links).join() !==
      "claim-canon-turnout-trend"
    ) {
      throw new Error("HTTP create missing implies link");
    }

    const listed = await json(
      await app.request("/api/claims?artifact_id=page-001"),
    );
    if (listed.status !== 200 || !Array.isArray(listed.body)) {
      throw new Error("list claims failed");
    }
    const found = (listed.body as Array<{ claim_id: string }>).find(
      (c) => c.claim_id === "claim-smoke-model-http",
    );
    if (!found) throw new Error("HTTP model not listed for artifact");

    // Source markers for composer / list UI
    const composer = await fs.readFile(
      path.join(ROOT, "src/app/components/claim-composer.tsx"),
      "utf8",
    );
    if (
      !composer.includes("Implies forecasts") ||
      !composer.includes("mergeImpliesForecastLinks")
    ) {
      throw new Error("composer missing model implication affordance");
    }
    const listItem = await fs.readFile(
      path.join(ROOT, "src/app/components/claim-list-item.tsx"),
      "utf8",
    );
    if (
      !listItem.includes("Implies forecasts") ||
      !listItem.includes("forecastIdsFromImpliesLinks")
    ) {
      throw new Error("claim list missing implication display");
    }

    console.log("smoke-claim-implications: ok");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
