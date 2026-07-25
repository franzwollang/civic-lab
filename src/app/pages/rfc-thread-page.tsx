import { useEffect, useState } from "react";
import { Header } from "../components/header";
import { SidebarNav } from "../components/sidebar-nav";
import { StatusBadge } from "../components/badges";
import { RevSetRow } from "../components/revset-row";
import {
  ReplyComposer,
  authorDisplayName,
  authorInitials,
} from "../components/reply-composer";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Info } from "lucide-react";
import { useParams, Link } from "react-router";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip";
import { decideThread, getThread, getThreadRevSets } from "../../api/client";
import type {
  RevSetRow as RevSetWire,
  ThreadPostRow,
  ThreadRow,
} from "../../doc/types";
import {
  getPrototypeUser,
  readActingUserId,
} from "../lib/prototype-users";
import { actorMayDecide } from "../../lib/mergeAuthority";

function statusLabel(
  thread: ThreadRow,
): "Open" | "RFC" | "Review" | "Decided" | "Merged" | "Parked" {
  if (thread.state === "decided") {
    if (thread.decision_outcome === "merged") return "Merged";
    if (thread.decision_outcome === "parked") return "Parked";
    return "Decided";
  }
  switch (thread.state) {
    case "rfc":
      return "RFC";
    case "review":
      return "Review";
    case "archived":
      return "Parked";
    default:
      return "Open";
  }
}

export function RfcThreadPage() {
  const { id } = useParams();
  const [thread, setThread] = useState<ThreadRow | null>(null);
  const [revsets, setRevsets] = useState<RevSetWire[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    Promise.all([getThread(id), getThreadRevSets(id)])
      .then(([t, rs]) => {
        if (cancelled) return;
        setThread(t);
        setRevsets(rs);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setThread(null);
        setRevsets([]);
        setError(err instanceof Error ? err.message : "Failed to load RFC");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function onDecide(outcome: "merged" | "rejected" | "parked") {
    if (!id || !thread || thread.state === "decided") return;
    if (thread.rfc_kind === "wrapper") return;
    setDeciding(true);
    try {
      const result = await decideThread(id, {
        outcome,
        author_id: readActingUserId(),
      });
      setThread(result.thread);
      setError(null);
      if (result.parent_cascaded && result.thread.parent_thread_id) {
        // Refresh is enough for this leaf; parent cascade happened server-side.
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Decide failed");
    } finally {
      setDeciding(false);
    }
  }

  function onPosted(post: ThreadPostRow) {
    setThread((prev) =>
      prev
        ? { ...prev, posts: [...(prev.posts ?? []), post] }
        : prev,
    );
  }

  const dossierId = thread?.home_dossier_id ?? "us-voting-1";
  const latestVersion =
    revsets.length > 0 ? Math.max(...revsets.map((r) => r.version)) : 0;
  const actingId = readActingUserId();
  const actingUser = getPrototypeUser(actingId);
  const authorityOk =
    !thread?.merge_authority ||
    actorMayDecide(actingId, thread.merge_authority.authority_class);
  const canDecide =
    thread != null &&
    thread.rfc_kind === "leaf" &&
    (thread.state === "rfc" || thread.state === "review") &&
    !deciding;

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />
      <SidebarNav dossierId={dossierId} currentPage="rfc" />

      <main className="ml-64 pt-16">
        <div className="mx-auto max-w-[900px] px-8 py-8">
          {error && (
            <Card className="mb-4 border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {error}
            </Card>
          )}

          {!thread && !error && (
            <p className="text-sm text-neutral-500">Loading RFC…</p>
          )}

          {thread && (
            <>
              <div className="mb-8">
                <div className="mb-4 flex items-center gap-3">
                  <StatusBadge status={statusLabel(thread)} />
                  <span className="text-sm text-neutral-500">
                    {thread.thread_id}
                  </span>
                  {thread.rfc_kind === "wrapper" && (
                    <span className="rounded bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-700">
                      Wrapper
                    </span>
                  )}
                  {thread.rfc_kind === "leaf" && (
                    <span className="rounded bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-700">
                      Leaf
                    </span>
                  )}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-neutral-400" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-xs">
                          {thread.rfc_kind === "wrapper"
                            ? "Wrapper RFC coordinates sub-RFCs; it does not merge content. Parent becomes decided when all children are decided."
                            : "Leaf RFC: Merge applies the latest RevSet to the artifact. Decide authority follows the artifact Collection (CONCEPT §3.4). Accepted Risk deferred to M7."}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <h1 className="mb-4 text-3xl font-bold text-neutral-900">
                  {thread.title}
                </h1>

                <div className="mb-4 rounded-lg border border-neutral-200 bg-white p-4">
                  <div className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-500">
                    {thread.rfc_kind === "wrapper"
                      ? "Wrapper scope"
                      : "Leaf merge target"}
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-neutral-600">Home dossier:</span>
                      <Link
                        to={`/dossier/${thread.home_dossier_id}`}
                        className="font-medium text-neutral-900 hover:text-neutral-700"
                      >
                        {thread.home_dossier_id}
                      </Link>
                    </div>
                    {thread.parent_thread_id && (
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-600">Parent wrapper:</span>
                        <Link
                          to={`/thread/${thread.parent_thread_id}/rfc`}
                          className="font-medium text-neutral-900 hover:text-neutral-700"
                        >
                          {thread.parent_thread_id}
                        </Link>
                      </div>
                    )}
                    {thread.merge_artifact_id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-600">Merge artifact:</span>
                        <Link
                          to={`/dossier/${thread.home_dossier_id}/artifact/${thread.merge_artifact_id}`}
                          className="font-medium text-neutral-900 hover:text-neutral-700"
                        >
                          {thread.merge_artifact_id}
                        </Link>
                      </div>
                    ) : (
                      <p className="text-sm text-amber-700">
                        No merge_artifact_id — wrapper RFCs do not merge content.
                      </p>
                    )}
                    {thread.decision_outcome && (
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-600">Outcome:</span>
                        <span className="font-medium text-neutral-900">
                          {thread.decision_outcome}
                        </span>
                      </div>
                    )}
                    {(thread.child_threads?.length ?? 0) > 0 && (
                      <div className="pt-2">
                        <div className="mb-1 text-xs font-medium uppercase tracking-wider text-neutral-500">
                          Sub-RFCs
                        </div>
                        <ul className="space-y-1">
                          {thread.child_threads!.map((child) => (
                            <li key={child.thread_id}>
                              <Link
                                to={`/thread/${child.thread_id}/rfc`}
                                className="font-medium text-neutral-900 hover:text-neutral-700"
                              >
                                {child.title}
                              </Link>
                              <span className="ml-2 text-neutral-500">
                                → {child.merge_artifact_id} · {child.state}
                                {child.decision_outcome
                                  ? ` (${child.decision_outcome})`
                                  : ""}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <Link
                      to={`/thread/${thread.thread_id}`}
                      className="inline-block text-xs text-neutral-500 underline"
                    >
                      View discussion thread
                    </Link>
                  </div>
                </div>
              </div>

              <Card className="mb-8 border border-amber-200 bg-amber-50 p-6">
                <div className="mb-2 rounded bg-amber-600 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-white inline-block">
                  Request for Change
                </div>
                <p className="text-sm text-neutral-800">
                  {thread.rfc_kind === "wrapper" ? (
                    <>
                      Wrapper RFC: open each sub-RFC to attach RevSets and decide.
                      Parent becomes <code className="text-xs">decided</code>{" "}
                      automatically when all children are decided.
                    </>
                  ) : (
                    <>
                      Leaf RFC: RevSets propose ArtifactRevisions. Merge applies
                      the latest RevSet to{" "}
                      <code className="text-xs">
                        {thread.merge_artifact_id ?? "—"}
                      </code>
                      .
                    </>
                  )}
                </p>
              </Card>

              {thread.rfc_kind !== "wrapper" && (
              <div className="mb-8">
                <h2 className="mb-4 text-xl font-semibold text-neutral-900">
                  Revision Sets
                </h2>
                <Card className="border border-neutral-200 bg-white">
                  {revsets.length === 0 ? (
                    <p className="p-6 text-center text-sm text-neutral-500">
                      No RevSets yet. POST /api/threads/:id/revsets to propose a
                      revision. Merge requires at least one RevSet.
                    </p>
                  ) : (
                    [...revsets]
                      .sort((a, b) => b.version - a.version)
                      .map((rs) => (
                        <RevSetRow
                          key={rs.revset_id}
                          version={rs.version}
                          author={rs.author_id}
                          timestamp={new Date(rs.created_at).toLocaleString()}
                          description={
                            rs.summary ??
                            `Proposed revision ${rs.artifact_revision_id}`
                          }
                          isCurrent={rs.version === latestVersion}
                        />
                      ))
                  )}
                </Card>
              </div>
              )}

              <Card className="border-2 border-neutral-300 bg-white p-6">
                <h3 className="mb-4 text-lg font-semibold text-neutral-900">
                  Decision
                </h3>
                {thread.state === "decided" ? (
                  <p className="text-sm text-neutral-700">
                    Decided:{" "}
                    <span className="font-medium">
                      {thread.decision_outcome ?? "—"}
                    </span>
                    {thread.merge_authority ? (
                      <>
                        {" "}
                        under{" "}
                        <span className="font-medium">
                          {thread.merge_authority.authority_class}
                        </span>
                        .
                      </>
                    ) : (
                      "."
                    )}{" "}
                    Accepted Risk / Critical Finding gate deferred to M7.
                  </p>
                ) : thread.rfc_kind === "wrapper" ? (
                  <p className="mb-4 text-sm text-neutral-600">
                    Wrapper decisions follow children (all decided → parent
                    decided). Decide each leaf sub-RFC instead.
                  </p>
                ) : (
                  <>
                    <p className="mb-4 text-sm text-neutral-600">
                      Merge applies the latest RevSet. Reject / park close without
                      writing content. Authority follows the merge artifact&apos;s
                      Collection (CONCEPT §3.4).
                    </p>
                    {thread.merge_authority && (
                      <div className="mb-4 rounded border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
                        <div className="font-medium text-neutral-900">
                          {thread.merge_authority.description}
                        </div>
                        <div className="mt-1 text-xs text-neutral-500">
                          Collection{" "}
                          <code>{thread.merge_authority.collection_id}</code>
                          {" · "}
                          required roles:{" "}
                          {thread.merge_authority.required_roles.join(", ")}
                        </div>
                        <div className="mt-1 text-xs text-neutral-500">
                          Acting as{" "}
                          {actingUser
                            ? `${actingUser.display_name} (${actingUser.roles.join(", ")})`
                            : actingId}
                          {authorityOk
                            ? " — authorized"
                            : " — not authorized to decide"}
                        </div>
                      </div>
                    )}
                    <div className="flex gap-3">
                      <Button
                        variant="default"
                        size="lg"
                        disabled={!canDecide || revsets.length === 0}
                        onClick={() => onDecide("merged")}
                      >
                        {deciding ? "Working…" : "Merge RFC"}
                      </Button>
                      <Button
                        variant="outline"
                        size="lg"
                        disabled={!canDecide}
                        onClick={() => onDecide("rejected")}
                      >
                        Reject
                      </Button>
                      <Button
                        variant="outline"
                        size="lg"
                        disabled={!canDecide}
                        onClick={() => onDecide("parked")}
                      >
                        Park
                      </Button>
                    </div>
                  </>
                )}
              </Card>

              <div className="mt-8">
                <h2 className="mb-4 text-xl font-semibold text-neutral-900">
                  Discussion
                </h2>
                <div className="space-y-4">
                  {(thread.posts ?? []).map((post) => (
                    <Card
                      key={post.post_id}
                      className="border border-neutral-200 bg-white p-6"
                    >
                      <div className="mb-3 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-700 text-white">
                          <span className="text-xs font-semibold">
                            {authorInitials(post.author_id)}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium text-neutral-900">
                            {authorDisplayName(post.author_id)}
                          </div>
                          <div className="text-sm text-neutral-500">
                            {post.author_id} ·{" "}
                            {new Date(post.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-neutral-800">
                        {post.body}
                      </p>
                    </Card>
                  ))}

                  <ReplyComposer
                    threadId={thread.thread_id}
                    onPosted={onPosted}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
