/**
 * CONCEPT §9.4 / §8.3 — Steward/Owner + Adjudicator moderation queue.
 * Soft-deleted posts (audit feed), open findings, and claim adjudication.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Header } from "../components/header";
import { ActingAsHint } from "../components/acting-as-hint";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  adjudicateClaim,
  getAdjudicationQueue,
  getArtifact,
  getAuditLogs,
  getFindings,
  getThread,
} from "../../api/client";
import type {
  AuditLogRow,
  ClaimRow,
  FindingRow,
  ThreadPostRow,
} from "../../doc/types";
import { useActingUserOptional } from "../lib/acting-user";
import { userHasCapability } from "../lib/role-affordances";
import {
  adjudicationOutcomesForProfile,
} from "../../lib/claimAdjudication";
import {
  canAccessModQueue,
  defaultModQueueTab,
  filterSoftDeleteAuditsForActor,
  findingThreadHref,
  modQueueTabsForUser,
  parseSoftDeletePayload,
  softDeleteThreadHref,
  type ModQueueTab,
} from "../../lib/modQueue";

function severityBadgeClass(severity: string): string {
  if (severity === "critical") return "bg-red-100 text-red-900 border-red-200";
  if (severity === "high") return "bg-orange-100 text-orange-900 border-orange-200";
  if (severity === "med") return "bg-amber-100 text-amber-900 border-amber-200";
  return "bg-neutral-100 text-neutral-700 border-neutral-200";
}

function DeletedPostsTab({
  actorId,
  canView,
}: {
  actorId: string;
  canView: boolean;
}) {
  const acting = useActingUserOptional();
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tombstone, setTombstone] = useState<ThreadPostRow | null>(null);
  const [tombstoneError, setTombstoneError] = useState<string | null>(null);

  useEffect(() => {
    if (!canView) {
      setRows([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getAuditLogs({
      actor_id: actorId,
      action: "post_soft_delete",
      limit: 50,
    })
      .then((all) => {
        if (cancelled) return;
        setRows(filterSoftDeleteAuditsForActor(all, acting.user));
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canView, actorId, acting.user]);

  async function previewTombstone(row: AuditLogRow) {
    const payload = parseSoftDeletePayload(row.payload);
    if (!payload.thread_id || !row.subject_id) return;
    setExpanded(row.audit_id);
    setTombstone(null);
    setTombstoneError(null);
    try {
      const thread = await getThread(payload.thread_id, {
        include_deleted: true,
        actor_id: actorId,
      });
      const post = (thread.posts ?? []).find((p) => p.post_id === row.subject_id);
      if (!post) {
        setTombstoneError("Tombstone not found on thread");
        return;
      }
      setTombstone(post);
    } catch (err: unknown) {
      setTombstoneError(err instanceof Error ? err.message : "Preview failed");
    }
  }

  if (!canView) {
    return (
      <ActingAsHint
        requireCapability="view_audit"
        capabilityLabel="view soft-deleted posts"
      />
    );
  }

  return (
    <div className="space-y-3" data-testid="mod-queue-deleted-posts">
      <ActingAsHint
        requireCapability="view_audit"
        capabilityLabel="view soft-deleted posts"
      />
      <p className="text-xs text-neutral-500">
        Soft-deleted posts from the append-only audit log (CONCEPT §9.4). Stewards
        see Manual Collections only; Owner sees Canon too. Restore is out of scope.
      </p>
      {loading ? <p className="text-sm text-neutral-500">Loading…</p> : null}
      {error ? (
        <p className="text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {!loading && rows.length === 0 ? (
        <p className="text-sm text-neutral-500">No soft-deletes in scope yet.</p>
      ) : (
        <ul className="divide-y divide-neutral-100 rounded border border-neutral-100">
          {rows.map((row) => {
            const payload = parseSoftDeletePayload(row.payload);
            const href = softDeleteThreadHref(payload);
            return (
              <li
                key={row.audit_id}
                className="space-y-2 px-3 py-3 text-sm"
                data-testid="mod-queue-deleted-row"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <span className="font-medium text-neutral-900">
                      {row.subject_id}
                    </span>
                    <span className="ml-2 text-neutral-600">
                      by moderator {row.actor_id}
                    </span>
                    {payload.area_kind ? (
                      <Badge
                        variant="outline"
                        className="ml-2 text-[10px] uppercase"
                      >
                        {payload.area_kind}
                      </Badge>
                    ) : null}
                  </div>
                  <span className="text-xs text-neutral-400">
                    {new Date(row.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-neutral-600">
                  Author {payload.author_id ?? "?"}
                  {payload.collection_id
                    ? ` · ${payload.collection_id}`
                    : ""}
                  {payload.reason ? ` · ${payload.reason}` : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  {href ? (
                    <Link
                      to={href}
                      className="text-xs font-medium text-neutral-900 underline"
                    >
                      Open thread
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    className="text-xs font-medium text-neutral-700 underline"
                    onClick={() => void previewTombstone(row)}
                  >
                    Preview tombstone
                  </button>
                </div>
                {expanded === row.audit_id ? (
                  <div className="rounded border border-neutral-200 bg-neutral-50 p-2 text-xs">
                    {tombstoneError ? (
                      <p className="text-red-700">{tombstoneError}</p>
                    ) : tombstone ? (
                      <p data-testid="mod-queue-tombstone">
                        <span className="font-medium">
                          deleted {tombstone.deleted_at ?? "?"}
                        </span>
                        {" — "}
                        {tombstone.body}
                      </p>
                    ) : (
                      <p className="text-neutral-500">Loading tombstone…</p>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function OpenFindingsTab({
  canView,
  collectionFilter,
}: {
  canView: boolean;
  collectionFilter: string | null;
}) {
  const [findings, setFindings] = useState<FindingRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!canView) {
      setFindings([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getFindings({
      status: "open",
      collectionId: collectionFilter ?? undefined,
    })
      .then((rows) => {
        if (cancelled) return;
        const sorted = [...rows].sort((a, b) => {
          const rank = (s: string) =>
            s === "critical" ? 0 : s === "high" ? 1 : s === "med" ? 2 : 3;
          return rank(a.severity) - rank(b.severity);
        });
        setFindings(sorted);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canView, collectionFilter]);

  if (!canView) {
    return (
      <ActingAsHint
        requireCapability="view_audit"
        capabilityLabel="review open findings"
      />
    );
  }

  return (
    <div className="space-y-3" data-testid="mod-queue-open-findings">
      <ActingAsHint
        requireCapability="view_audit"
        capabilityLabel="review open findings"
      />
      <p className="text-xs text-neutral-500">
        Open Red Team findings (CONCEPT §7 / §8.2). Critical findings block merge
        unless Accepted Risk is signed. Stewards cannot suppress findings.
      </p>
      {collectionFilter ? (
        <p className="text-xs text-neutral-600">
          Filtered to collection{" "}
          <code className="rounded bg-neutral-100 px-1">{collectionFilter}</code>
          .{" "}
          <Link to="/mod?tab=open-findings" className="underline">
            Clear filter
          </Link>
        </p>
      ) : null}
      {loading ? <p className="text-sm text-neutral-500">Loading…</p> : null}
      {error ? (
        <p className="text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {!loading && findings.length === 0 ? (
        <p className="text-sm text-neutral-500">No open findings.</p>
      ) : (
        <ul className="divide-y divide-neutral-100 rounded border border-neutral-100">
          {findings.map((f) => (
            <li
              key={f.finding_id}
              className="flex flex-wrap items-start justify-between gap-2 px-3 py-3 text-sm"
              data-testid="mod-queue-finding-row"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={severityBadgeClass(f.severity)}
                  >
                    {f.severity}
                  </Badge>
                  <Link
                    to={findingThreadHref(f)}
                    className="font-medium text-neutral-900 underline"
                  >
                    {f.title}
                  </Link>
                </div>
                <p className="text-xs text-neutral-500">
                  {f.finding_id} · thread {f.thread_id}
                  {f.home_dossier_title
                    ? ` · ${f.home_dossier_title}`
                    : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AdjudicationTab({
  actorId,
  canAdjudicate,
  canView,
}: {
  actorId: string;
  canAdjudicate: boolean;
  canView: boolean;
}) {
  const [queue, setQueue] = useState<ClaimRow[]>([]);
  const [artifactPaths, setArtifactPaths] = useState<Record<string, string>>(
    {},
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusById, setStatusById] = useState<Record<string, string>>({});
  const [rationaleById, setRationaleById] = useState<Record<string, string>>(
    {},
  );
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!canView) {
      setQueue([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getAdjudicationQueue()
      .then(async (rows) => {
        if (cancelled) return;
        setQueue(rows);
        setError(null);
        const ids = [...new Set(rows.map((r) => r.artifact_id))];
        const paths: Record<string, string> = {};
        await Promise.all(
          ids.map(async (id) => {
            try {
              const art = await getArtifact(id);
              if (art.dossier_id) {
                paths[id] = `/dossier/${art.dossier_id}/artifact/${art.artifact_id}`;
              } else {
                paths[id] = `/test/preview/${art.artifact_id}`;
              }
            } catch {
              paths[id] = `/test/preview/${id}`;
            }
          }),
        );
        if (!cancelled) setArtifactPaths(paths);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canView, reloadToken]);

  async function onAdjudicate(claim: ClaimRow) {
    const status =
      statusById[claim.claim_id] ??
      adjudicationOutcomesForProfile(claim.profile)[0];
    const rationale = (rationaleById[claim.claim_id] ?? "").trim();
    if (!status || !rationale) {
      setError("Outcome and rationale are required");
      return;
    }
    setBusyId(claim.claim_id);
    setError(null);
    try {
      await adjudicateClaim(claim.claim_id, {
        author_id: actorId,
        status,
        rationale,
        require_queued: true,
      });
      setReloadToken((n) => n + 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Adjudication failed");
    } finally {
      setBusyId(null);
    }
  }

  if (!canView) {
    return (
      <p className="text-sm text-neutral-500">
        Switch to Steward, Owner, or Adjudicator to view the adjudication queue.
      </p>
    );
  }

  return (
    <div className="space-y-3" data-testid="mod-queue-adjudication">
      <ActingAsHint
        requireCapability="adjudicate_claims"
        capabilityLabel="adjudicate claims"
      />
      <p className="text-xs text-neutral-500">
        Pending claim adjudication (CONCEPT §8.3). Only global Adjudicators set
        outcomes; stewards/Owner may review the queue.
      </p>
      {loading ? <p className="text-sm text-neutral-500">Loading…</p> : null}
      {error ? (
        <p className="text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {!loading && queue.length === 0 ? (
        <p className="text-sm text-neutral-500">Adjudication queue is empty.</p>
      ) : (
        <ul className="space-y-3">
          {queue.map((claim) => {
            const outcomes = adjudicationOutcomesForProfile(claim.profile);
            const selected =
              statusById[claim.claim_id] ?? outcomes[0] ?? "invalidated";
            return (
              <li
                key={claim.claim_id}
                className="rounded border border-neutral-100 p-3 text-sm"
                data-testid="mod-queue-adjudication-row"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {claim.profile}
                  </Badge>
                  <span className="font-medium text-neutral-900">
                    {claim.claim_id}
                  </span>
                  <Link
                    to={
                      artifactPaths[claim.artifact_id] ??
                      `/test/preview/${claim.artifact_id}`
                    }
                    className="text-xs underline"
                  >
                    Open artifact
                  </Link>
                </div>
                <p className="mt-2 text-neutral-800">{claim.text}</p>
                {claim.adjudication_request_note ? (
                  <p className="mt-1 text-xs text-neutral-500">
                    Request note: {claim.adjudication_request_note}
                  </p>
                ) : null}
                {canAdjudicate ? (
                  <div className="mt-3 space-y-2 border-t border-neutral-100 pt-3">
                    <label className="block text-xs text-neutral-600">
                      Outcome
                      <select
                        className="mt-1 w-full rounded border border-neutral-200 bg-white px-2 py-1.5 text-sm"
                        value={selected}
                        onChange={(e) =>
                          setStatusById((m) => ({
                            ...m,
                            [claim.claim_id]: e.target.value,
                          }))
                        }
                        data-testid="mod-queue-adjudicate-status"
                      >
                        {outcomes.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-xs text-neutral-600">
                      Rationale
                      <textarea
                        className="mt-1 w-full rounded border border-neutral-200 bg-white px-2 py-1.5 text-sm"
                        rows={2}
                        value={rationaleById[claim.claim_id] ?? ""}
                        onChange={(e) =>
                          setRationaleById((m) => ({
                            ...m,
                            [claim.claim_id]: e.target.value,
                          }))
                        }
                        data-testid="mod-queue-adjudicate-rationale"
                      />
                    </label>
                    <Button
                      type="button"
                      size="sm"
                      disabled={busyId === claim.claim_id}
                      onClick={() => void onAdjudicate(claim)}
                      data-testid="mod-queue-adjudicate-submit"
                    >
                      {busyId === claim.claim_id
                        ? "Saving…"
                        : "Adjudicate"}
                    </Button>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-amber-800">
                    Read-only — switch to an Adjudicator to set outcomes.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function ModQueue() {
  const acting = useActingUserOptional();
  const [params, setParams] = useSearchParams();
  const access = canAccessModQueue(acting.user);
  const tabs = useMemo(
    () => modQueueTabsForUser(acting.user),
    [acting.user],
  );
  const requested = params.get("tab") as ModQueueTab | null;
  const collectionFilter = params.get("collection");
  const activeTab: ModQueueTab =
    requested && tabs.includes(requested)
      ? requested
      : defaultModQueueTab(acting.user);

  const canViewAudit = userHasCapability(acting.user, "view_audit");
  const canAdjudicate = userHasCapability(acting.user, "adjudicate_claims");

  function setTab(tab: string) {
    const next = new URLSearchParams(params);
    next.set("tab", tab);
    setParams(next, { replace: true });
  }

  return (
    <div className="min-h-screen bg-neutral-50" data-testid="mod-queue-page">
      <Header />
      <main className="mx-auto max-w-[960px] px-8 py-10">
        <div className="mb-6 space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
            Moderation queue
          </h1>
          <p className="text-sm text-neutral-600">
            Soft-deleted posts, open findings, and claim adjudication — beyond
            the Collection audit snippet (CONCEPT §9.4 / §8.3).
          </p>
        </div>

        {!access ? (
          <Card className="border border-neutral-200 bg-white p-6">
            <ActingAsHint
              requireCapability="view_audit"
              capabilityLabel="open the moderation queue"
            />
            <p className="mt-2 text-sm text-neutral-600">
              Steward / Owner (audit + findings) or Adjudicator (claim queue).
              Change identity in the header.
            </p>
          </Card>
        ) : (
          <Card className="border border-neutral-200 bg-white p-6">
            <Tabs value={activeTab} onValueChange={setTab}>
              <TabsList data-testid="mod-queue-tabs">
                {tabs.includes("deleted-posts") ? (
                  <TabsTrigger value="deleted-posts">
                    Soft-deleted posts
                  </TabsTrigger>
                ) : null}
                {tabs.includes("open-findings") ? (
                  <TabsTrigger value="open-findings">Open findings</TabsTrigger>
                ) : null}
                {tabs.includes("adjudication") ? (
                  <TabsTrigger value="adjudication">Adjudication</TabsTrigger>
                ) : null}
              </TabsList>
              {tabs.includes("deleted-posts") ? (
                <TabsContent value="deleted-posts" className="mt-4">
                  <DeletedPostsTab
                    actorId={acting.userId}
                    canView={canViewAudit}
                  />
                </TabsContent>
              ) : null}
              {tabs.includes("open-findings") ? (
                <TabsContent value="open-findings" className="mt-4">
                  <OpenFindingsTab
                    canView={canViewAudit}
                    collectionFilter={collectionFilter}
                  />
                </TabsContent>
              ) : null}
              {tabs.includes("adjudication") ? (
                <TabsContent value="adjudication" className="mt-4">
                  <AdjudicationTab
                    actorId={acting.userId}
                    canAdjudicate={canAdjudicate}
                    canView={canViewAudit || canAdjudicate}
                  />
                </TabsContent>
              ) : null}
            </Tabs>
          </Card>
        )}
      </main>
    </div>
  );
}
