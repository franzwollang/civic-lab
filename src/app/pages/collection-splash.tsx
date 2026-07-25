import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import {
  FolderOpen,
  GitPullRequest,
  LineChart,
  ShieldAlert,
  Layers,
} from "lucide-react";
import { Header } from "../components/header";
import { DossierCard } from "../components/cards";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { getCollectionDashboard } from "../../api/client";
import type { CollectionDashboard } from "../../doc/types";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; dashboard: CollectionDashboard };

function DeferredNote({ milestone, label }: { milestone: string; label: string }) {
  return (
    <p className="mt-3 text-xs text-neutral-500">
      {label} arrives with{" "}
      <span className="font-medium text-neutral-700">{milestone}</span>.
    </p>
  );
}

/**
 * Shared Collection splash/dashboard chrome (CONCEPT §11 / M4).
 * Used for Canon singleton and each country Manual.
 */
export function CollectionSplash({
  collectionId: collectionIdProp,
}: {
  collectionId?: string;
}) {
  const { collectionId: paramId } = useParams();
  const collectionId = collectionIdProp || paramId || "";
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!collectionId) {
        setState({ status: "error", message: "Missing collection id" });
        return;
      }
      try {
        const dashboard = await getCollectionDashboard(collectionId);
        if (!cancelled) {
          setState({ status: "ready", dashboard });
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            status: "error",
            message: err instanceof Error ? err.message : "Failed to load",
          });
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [collectionId]);

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />
      <main className="mx-auto max-w-[1200px] px-8 py-10">
        {state.status === "loading" && (
          <p className="text-sm text-neutral-500">Loading collection…</p>
        )}
        {state.status === "error" && (
          <Card className="border border-neutral-200 p-6">
            <h1 className="mb-2 text-xl font-semibold text-neutral-900">
              Collection not found
            </h1>
            <p className="text-sm text-neutral-600">{state.message}</p>
            <Link
              to="/"
              className="mt-4 inline-block text-sm text-neutral-900 underline"
            >
              Back home
            </Link>
          </Card>
        )}
        {state.status === "ready" && (
          <CollectionDashboardView dashboard={state.dashboard} />
        )}
      </main>
    </div>
  );
}

function CollectionDashboardView({
  dashboard,
}: {
  dashboard: CollectionDashboard;
}) {
  const { collection, stats, dossiers } = dashboard;
  const isManual = Boolean(collection.country_code);

  return (
    <>
      <div className="mb-8">
        <p className="mb-2 text-sm uppercase tracking-wider text-neutral-500">
          {isManual
            ? `Manual · ${collection.country_code}`
            : "Canon Collection"}
        </p>
        <h1 className="mb-3 text-3xl font-bold text-neutral-900">
          {collection.title}
        </h1>
        {collection.summary && (
          <p className="max-w-2xl text-neutral-600">{collection.summary}</p>
        )}
      </div>

      {/* §11 summary strip — real counts from store */}
      <div className="mb-10 grid gap-3 sm:grid-cols-3">
        <Card className="border border-neutral-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wider text-neutral-500">
            Dossiers
          </p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900">
            {stats.dossier_count}
          </p>
        </Card>
        <Card className="border border-neutral-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wider text-neutral-500">
            Artifacts
          </p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900">
            {stats.artifact_count}
          </p>
        </Card>
        <Card className="border border-neutral-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wider text-neutral-500">
            Empty dossiers
          </p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900">
            {stats.empty_dossier_count}
          </p>
        </Card>
      </div>

      {/* Dossier index / health */}
      <section className="mb-12">
        <div className="mb-4 flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-neutral-600" />
          <h2 className="text-sm font-medium uppercase tracking-wider text-neutral-500">
            Dossier index / health
          </h2>
        </div>
        {dossiers.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No dossiers in this collection yet.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {dossiers.map((d) => (
              <div key={d.dossier_id} className="relative">
                <DossierCard
                  id={d.dossier_id}
                  title={d.title}
                  description={d.summary || ""}
                  lane={d.lane_hint}
                  steward={collection.title}
                  lastUpdated="seed"
                  artifactCount={d.artifact_count ?? 0}
                  threadCount={0}
                />
                <Badge
                  className={
                    d.health === "seeded"
                      ? "absolute right-3 top-3 bg-emerald-50 text-emerald-800"
                      : "absolute right-3 top-3 bg-amber-50 text-amber-800"
                  }
                  variant="secondary"
                >
                  {d.health === "seeded" ? "Seeded" : "Empty"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Shared deferred panels — chrome parity across Collections */}
      <div className="mb-12 grid gap-4 lg:grid-cols-2">
        <Card className="border border-neutral-200 bg-white p-6">
          <div className="mb-2 flex items-center gap-2">
            <GitPullRequest className="h-4 w-4 text-neutral-600" />
            <h2 className="text-sm font-medium uppercase tracking-wider text-neutral-500">
              Open threads & RFCs
            </h2>
          </div>
          <p className="text-sm text-neutral-700">
            {dashboard.open_threads.count} open ·{" "}
            {dashboard.open_threads.critical_findings} Critical findings
          </p>
          <DeferredNote
            milestone={dashboard.open_threads.deferred}
            label="Critical findings count"
          />
        </Card>

        <Card className="border border-neutral-200 bg-white p-6">
          <div className="mb-2 flex items-center gap-2">
            <LineChart className="h-4 w-4 text-neutral-600" />
            <h2 className="text-sm font-medium uppercase tracking-wider text-neutral-500">
              Empirical claim quality
            </h2>
          </div>
          <ClaimMetricsPanel claims={dashboard.claims} />
        </Card>

        <Card className="border border-neutral-200 bg-white p-6">
          <div className="mb-2 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-neutral-600" />
            <h2 className="text-sm font-medium uppercase tracking-wider text-neutral-500">
              Recent Red Team activity
            </h2>
          </div>
          <p className="text-sm text-neutral-700">
            {dashboard.red_team.recent_count} recent findings in this Collection
          </p>
          <DeferredNote
            milestone={dashboard.red_team.deferred}
            label="Findings feed"
          />
        </Card>

        {/* Manuals-only panels keep chrome slot even when deferred */}
        {isManual && dashboard.lane_coverage && (
          <Card className="border border-neutral-200 bg-white p-6">
            <div className="mb-2 flex items-center gap-2">
              <Layers className="h-4 w-4 text-neutral-600" />
              <h2 className="text-sm font-medium uppercase tracking-wider text-neutral-500">
                Lane coverage
              </h2>
            </div>
            <ul className="space-y-1 text-sm text-neutral-700">
              {(
                ["Descriptive", "Prescriptive", "Alignment"] as const
              ).map((lane) => (
                <li key={lane} className="flex justify-between">
                  <span>{lane}</span>
                  <span className="font-medium">
                    {dashboard.lane_coverage![lane]}
                  </span>
                </li>
              ))}
            </ul>
            {dashboard.requirement_satisfaction && (
              <div className="mt-3 space-y-1 text-sm text-neutral-700">
                <div className="flex justify-between">
                  <span>Requirement claims</span>
                  <span className="font-medium">
                    {dashboard.requirement_satisfaction.open} open /{" "}
                    {dashboard.requirement_satisfaction.total}
                  </span>
                </div>
                <RequirementSnapshotList
                  snapshot={dashboard.requirement_satisfaction.snapshot}
                />
              </div>
            )}
          </Card>
        )}
      </div>
    </>
  );
}

function fmtRate(rate: number | null): string {
  if (rate === null) return "—";
  return `${Math.round(rate * 1000) / 10}%`;
}

function fmtNum(n: number | null, digits = 3): string {
  if (n === null) return "—";
  return n.toFixed(digits);
}

function ClaimMetricsPanel({
  claims,
}: {
  claims: CollectionDashboard["claims"];
}) {
  const q = claims.empirical_quality;
  const f = claims.forecast_accuracy;

  if (q.total === 0) {
    return (
      <p className="text-sm text-neutral-500">
        No empirical claims in this Collection yet.
      </p>
    );
  }

  return (
    <div className="space-y-4 text-sm text-neutral-700">
      <ul className="space-y-1">
        <li className="flex justify-between">
          <span>Empirical claims</span>
          <span className="font-medium">
            {q.total} ({q.open} open · {q.resolved} resolved)
          </span>
        </li>
        <li className="flex justify-between">
          <span>Invalidated rate</span>
          <span className="font-medium">{fmtRate(q.invalidated_rate)}</span>
        </li>
        <li className="flex justify-between">
          <span>Ambiguity / conflict rate</span>
          <span className="font-medium">{fmtRate(q.ambiguity_rate)}</span>
        </li>
        <li className="flex justify-between">
          <span>Mean citation density</span>
          <span className="font-medium">
            {fmtNum(q.mean_citation_density, 2)}
          </span>
        </li>
        <li className="flex justify-between">
          <span>Mean days to resolution</span>
          <span className="font-medium">
            {fmtNum(q.mean_days_to_resolution, 1)}
          </span>
        </li>
      </ul>

      <div className="border-t border-neutral-100 pt-3">
        <p className="mb-2 text-xs uppercase tracking-wider text-neutral-500">
          Forecast accuracy
        </p>
        {f.n === 0 ? (
          <p className="text-neutral-500">
            No resolved scored forecasts yet.
          </p>
        ) : (
          <ul className="space-y-1">
            <li className="flex justify-between">
              <span>Scored forecasts (n)</span>
              <span className="font-medium">{f.n}</span>
            </li>
            <li className="flex justify-between">
              <span>Mean Brier</span>
              <span className="font-medium">{fmtNum(f.mean_brier)}</span>
            </li>
            <li className="flex justify-between">
              <span>Mean log score</span>
              <span className="font-medium">{fmtNum(f.mean_log_score)}</span>
            </li>
            <li className="flex justify-between">
              <span>Skill vs baseline</span>
              <span className="font-medium">
                {fmtNum(f.mean_skill_vs_baseline)}
              </span>
            </li>
            <li className="text-xs text-neutral-500">
              Baseline: {f.baseline_label}
              {f.public_board_eligible
                ? " · public board eligible"
                : ` · public boards need n ≥ 20 (have ${f.n})`}
            </li>
          </ul>
        )}
      </div>
    </div>
  );
}

function RequirementSnapshotList({
  snapshot,
}: {
  snapshot: NonNullable<
    CollectionDashboard["requirement_satisfaction"]
  >["snapshot"];
}) {
  const rows: { label: string; value: number }[] = [
    { label: "Satisfied", value: snapshot.satisfied },
    { label: "Accepted", value: snapshot.accepted },
    { label: "Failed", value: snapshot.failed },
    { label: "Disputed", value: snapshot.disputed },
    { label: "Invalidated", value: snapshot.invalidated },
    { label: "Superseded", value: snapshot.superseded },
  ].filter((r) => r.value > 0);

  if (rows.length === 0) {
    return (
      <p className="mt-2 text-xs text-neutral-500">
        No adjudicated requirement outcomes yet.
      </p>
    );
  }

  return (
    <ul className="mt-2 space-y-1 border-t border-neutral-100 pt-2 text-xs text-neutral-600">
      {rows.map((r) => (
        <li key={r.label} className="flex justify-between">
          <span>{r.label}</span>
          <span className="font-medium text-neutral-800">{r.value}</span>
        </li>
      ))}
    </ul>
  );
}

/** Canon Area entry → singleton Collection splash. */
export function CanonIndex() {
  return <CollectionSplash collectionId="collection-canon" />;
}
