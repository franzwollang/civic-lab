import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import {
  FolderOpen,
  GitPullRequest,
  LineChart,
  ShieldAlert,
  Layers,
  TrendingUp,
  EyeOff,
  ScrollText,
  UserCog,
} from "lucide-react";
import { Header } from "../components/header";
import { DossierCard } from "../components/cards";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  changeUserRoles,
  getAuditLogs,
  getCollectionDashboard,
  getUsers,
  hideUserFromBoards,
  liftBoardHide,
  type EffectiveUserRow,
} from "../../api/client";
import type { AuditLogRow, CollectionDashboard } from "../../doc/types";
import { ObjectBreadcrumbs } from "../components/object-breadcrumbs";
import {
  areaKindFromCollection,
  buildHierarchyCrumbs,
} from "../lib/object-nav";
import { useActingUserOptional } from "../lib/acting-user";
import { roleShortLabel, userHasCapability } from "../lib/role-affordances";
import {
  PROTOTYPE_USERS,
  type PrototypeRole,
} from "../lib/prototype-users";
import { PROTOTYPE_ROLE_VALUES } from "../../lib/roleChange";
import { ActingAsHint } from "../components/acting-as-hint";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; dashboard: CollectionDashboard };

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
  const [reloadToken, setReloadToken] = useState(0);

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
  }, [collectionId, reloadToken]);

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
          <CollectionDashboardView
            dashboard={state.dashboard}
            onRefresh={() => setReloadToken((n) => n + 1)}
          />
        )}
      </main>
    </div>
  );
}

function CollectionDashboardView({
  dashboard,
  onRefresh,
}: {
  dashboard: CollectionDashboard;
  onRefresh: () => void;
}) {
  const { collection, stats, dossiers } = dashboard;
  const isManual = Boolean(collection.country_code);
  const area_kind = areaKindFromCollection(collection);

  return (
    <>
      <div className="mb-8">
        <ObjectBreadcrumbs
          crumbs={buildHierarchyCrumbs({
            area_kind,
            collection_id: collection.collection_id,
            collection_title: collection.title,
          })}
        />
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

      {/* Shared Collection panels (CONCEPT §11) */}
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
          {dashboard.red_team.recent_count === 0 ? (
            <p className="mt-3 text-xs text-neutral-500">
              No Findings filed against threads in this Collection yet.
            </p>
          ) : null}
        </Card>

        <Card className="border border-neutral-200 bg-white p-6 lg:col-span-2">
          <div className="mb-2 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-neutral-600" />
            <h2 className="text-sm font-medium uppercase tracking-wider text-neutral-500">
              Advisory reputation
            </h2>
          </div>
          <ReputationPanel
            board={dashboard.reputation}
            boardHides={dashboard.board_hides}
            onRefresh={onRefresh}
          />
        </Card>

        <Card className="border border-neutral-200 bg-white p-6 lg:col-span-2">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ScrollText className="h-4 w-4 text-neutral-600" />
              <h2 className="text-sm font-medium uppercase tracking-wider text-neutral-500">
                Audit log
              </h2>
            </div>
            <Link
              to={`/mod?collection=${encodeURIComponent(dashboard.collection.collection_id)}`}
              className="text-xs font-medium text-neutral-700 underline"
              data-testid="mod-queue-from-audit"
            >
              Full moderation queue →
            </Link>
          </div>
          <AuditLogPanel />
        </Card>

        <Card className="border border-neutral-200 bg-white p-6 lg:col-span-2">
          <div className="mb-2 flex items-center gap-2">
            <UserCog className="h-4 w-4 text-neutral-600" />
            <h2 className="text-sm font-medium uppercase tracking-wider text-neutral-500">
              Role appointment
            </h2>
          </div>
          <RoleAppointmentPanel />
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

function AuditLogPanel() {
  const acting = useActingUserOptional();
  const canView = userHasCapability(acting.user, "view_audit");
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!canView) {
      setLogs([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getAuditLogs({ limit: 12, actor_id: acting.userId })
      .then((rows) => {
        if (!cancelled) {
          setLogs(rows);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load audit");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canView, acting.userId]);

  if (!canView) {
    return (
      <div className="space-y-2">
        <ActingAsHint
          requireCapability="view_audit"
          capabilityLabel="view the append-only audit log"
        />
        <p className="text-sm text-neutral-500">
          Steward / Owner only — merges, adjudications, Accepted Risk, board-hide,
          role changes, and soft-deletes (CONCEPT §9.4).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="audit-log-panel">
      <ActingAsHint
        requireCapability="view_audit"
        capabilityLabel="view the append-only audit log"
      />
      <p className="text-xs text-neutral-500">
        Append-only site audit (CONCEPT §9.4). Soft-deleted posts stay in the DB;
        Findings / Claims / Accepted Risk / merged RevSets are never hard-deleted.
      </p>
      {loading ? (
        <p className="text-sm text-neutral-500">Loading audit…</p>
      ) : null}
      {error ? (
        <p className="text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {!loading && logs.length === 0 ? (
        <p className="text-sm text-neutral-500">No audit rows yet.</p>
      ) : (
        <ul className="divide-y divide-neutral-100 border border-neutral-100 rounded">
          {logs.map((row) => (
            <li
              key={row.audit_id}
              className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2 text-xs"
            >
              <span>
                <span className="font-medium text-neutral-900">{row.action}</span>
                <span className="ml-2 text-neutral-600">by {row.actor_id}</span>
                {row.subject_id ? (
                  <span className="ml-2 text-neutral-500">
                    · {row.subject_id}
                  </span>
                ) : null}
              </span>
              <span className="text-neutral-400">
                {new Date(row.created_at).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RoleAppointmentPanel() {
  const acting = useActingUserOptional();
  const canAppoint = userHasCapability(acting.user, "appoint_roles");
  const [users, setUsers] = useState<EffectiveUserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [subjectId, setSubjectId] = useState("");
  const [roles, setRoles] = useState<PrototypeRole[]>([]);
  const [rationale, setRationale] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!canAppoint) return;
    let cancelled = false;
    setLoading(true);
    void getUsers()
      .then((rows) => {
        if (!cancelled) setUsers(rows);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load users");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canAppoint, reloadToken]);

  useEffect(() => {
    if (!subjectId) {
      setRoles([]);
      return;
    }
    const row = users.find((u) => u.user_id === subjectId);
    setRoles(row ? ([...row.roles] as PrototypeRole[]) : []);
  }, [subjectId, users]);

  function toggleRole(role: PrototypeRole) {
    setRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  }

  async function onSubmit() {
    if (!acting.userId || !subjectId || roles.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await changeUserRoles(subjectId, {
        actor_id: acting.userId,
        roles,
        rationale: rationale.trim() || null,
      });
      setRationale("");
      setReloadToken((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Role change failed");
    } finally {
      setBusy(false);
    }
  }

  if (!canAppoint) {
    return (
      <div className="space-y-2">
        <ActingAsHint
          requireCapability="appoint_roles"
          capabilityLabel="appoint and change roles"
        />
        <p className="text-sm text-neutral-500">
          Owner only — appoint stewards, editors, Red Team, and adjudicators
          (CONCEPT §9.1). Changes are append-only audited.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="role-appointment-panel">
      <ActingAsHint
        requireCapability="appoint_roles"
        capabilityLabel="appoint and change roles"
      />
      <p className="text-xs text-neutral-500">
        Owner role appointment (CONCEPT §9.1 / §9.4). Seed catalog stays the user
        directory; appointments persist as overrides and feed server gates.
      </p>
      {loading ? (
        <p className="text-sm text-neutral-500">Loading users…</p>
      ) : null}
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-neutral-600">
          Account
          <select
            className="mt-1 block rounded border border-neutral-300 bg-white px-2 py-1 text-sm"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            data-testid="role-change-subject"
          >
            <option value="">Select…</option>
            {users.map((u) => (
              <option key={u.user_id} value={u.user_id}>
                {u.display_name} ({u.roles.map((r) => roleShortLabel(r as PrototypeRole)).join(", ")})
                {u.roles_source === "override" ? " · override" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[12rem] flex-1 text-xs text-neutral-600">
          Rationale (optional)
          <input
            className="mt-1 block w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm"
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            placeholder="Appoint / demote note"
            data-testid="role-change-rationale"
          />
        </label>
      </div>
      {subjectId ? (
        <fieldset className="space-y-1">
          <legend className="text-xs text-neutral-600">Roles</legend>
          <div className="flex flex-wrap gap-2">
            {PROTOTYPE_ROLE_VALUES.map((role) => (
              <label
                key={role}
                className="inline-flex items-center gap-1.5 rounded border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs"
              >
                <input
                  type="checkbox"
                  checked={roles.includes(role)}
                  onChange={() => toggleRole(role)}
                  data-testid={`role-change-${role}`}
                />
                {roleShortLabel(role)}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      <button
        type="button"
        disabled={busy || !subjectId || roles.length === 0}
        onClick={() => void onSubmit()}
        className="rounded bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        data-testid="role-change-submit"
      >
        Save roles
      </button>
      {error ? (
        <p className="text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ReputationPanel({
  board,
  boardHides,
  onRefresh,
}: {
  board: CollectionDashboard["reputation"];
  boardHides: CollectionDashboard["board_hides"];
  onRefresh: () => void;
}) {
  const acting = useActingUserOptional();
  const canHide = userHasCapability(acting.user, "board_hide");
  const [subjectId, setSubjectId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hideableUsers = PROTOTYPE_USERS.filter(
    (u) =>
      u.id !== acting.userId &&
      !boardHides.some((h) => h.subject_user_id === u.id),
  );

  async function onHide() {
    if (!acting.userId || !subjectId || !reason.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await hideUserFromBoards({
        actor_id: acting.userId,
        subject_user_id: subjectId,
        reason: reason.trim(),
      });
      setSubjectId("");
      setReason("");
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hide failed");
    } finally {
      setBusy(false);
    }
  }

  async function onLift(subject_user_id: string) {
    if (!acting.userId) return;
    setBusy(true);
    setError(null);
    try {
      await liftBoardHide({
        actor_id: acting.userId,
        subject_user_id,
        note: "Lifted from Collection dashboard",
      });
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lift failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 text-sm text-neutral-700">
      {board.n === 0 || board.contributors.length === 0 ? (
        <p className="text-neutral-500">
          No non-scorable contribution signals in this Collection yet
          {board.hidden_user_ids.length > 0
            ? " (some accounts are Owner-hidden)."
            : "."}
        </p>
      ) : (
        <>
          <p className="text-xs text-neutral-500">{board.note}</p>
          <ul className="space-y-2">
            {board.contributors.slice(0, 8).map((c) => (
              <li
                key={c.user_id}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-neutral-100 pb-2 last:border-0"
              >
                <div>
                  <span className="font-medium text-neutral-900">
                    {c.display_name ?? c.user_id}
                  </span>
                  <span className="ml-2 text-xs text-neutral-500">
                    score {c.advisory_score} · {c.signal_event_count} signals
                  </span>
                </div>
                <span className="text-xs text-neutral-600">
                  {[
                    c.signals.merged_revsets
                      ? `${c.signals.merged_revsets} merged RevSet`
                      : null,
                    c.signals.review_labor
                      ? `${c.signals.review_labor} review`
                      : null,
                    c.signals.red_team_findings
                      ? `${c.signals.red_team_findings} finding`
                      : null,
                    c.signals.adjudications
                      ? `${c.signals.adjudications} adjudication`
                      : null,
                    c.signals.accepted_risk_signs
                      ? `${c.signals.accepted_risk_signs} AR sign`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
          {!board.public_board_eligible ? (
            <p className="text-xs text-neutral-500">
              Public leaderboard chrome stays preview-only until n ≥ 20
              (anti-gaming).
            </p>
          ) : null}
        </>
      )}

      {boardHides.length > 0 ? (
        <div className="border-t border-neutral-100 pt-3">
          <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-neutral-500">
            <EyeOff className="h-3.5 w-3.5" />
            Hidden from boards
          </div>
          <ul className="space-y-2">
            {boardHides.map((h) => (
              <li
                key={h.hide_id}
                className="flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <span>
                  <span className="font-medium text-neutral-800">
                    {h.subject_display_name ?? h.subject_user_id}
                  </span>
                  <span className="ml-2 text-neutral-500">— {h.reason}</span>
                </span>
                {canHide ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onLift(h.subject_user_id)}
                    className="underline text-neutral-700 disabled:opacity-50"
                  >
                    Lift hide
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {canHide ? (
        <div className="space-y-2 border-t border-neutral-100 pt-3">
          <ActingAsHint
            requireCapability="board_hide"
            capabilityLabel="hide accounts from boards"
          />
          <p className="text-xs text-neutral-500">
            Owner board-hide (CONCEPT §5.9) — audit-logged; does not change
            permissions.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-neutral-600">
              Account
              <select
                className="mt-1 block rounded border border-neutral-300 bg-white px-2 py-1 text-sm"
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                data-testid="board-hide-subject"
              >
                <option value="">Select…</option>
                {hideableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.display_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-[12rem] flex-1 text-xs text-neutral-600">
              Reason
              <input
                className="mt-1 block w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Abuse / gaming"
                data-testid="board-hide-reason"
              />
            </label>
            <button
              type="button"
              disabled={busy || !subjectId || !reason.trim()}
              onClick={() => void onHide()}
              className="rounded bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              data-testid="board-hide-submit"
            >
              Hide from boards
            </button>
          </div>
          {error ? (
            <p className="text-xs text-red-700" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
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
