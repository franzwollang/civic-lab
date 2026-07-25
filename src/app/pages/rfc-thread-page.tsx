import { useEffect, useState } from "react";
import { Header } from "../components/header";
import { SidebarNav } from "../components/sidebar-nav";
import { StatusBadge } from "../components/badges";
import { RevSetRow } from "../components/revset-row";
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
import { getThread, getThreadRevSets } from "../../api/client";
import type { RevSetRow as RevSetWire, ThreadRow } from "../../doc/types";

export function RfcThreadPage() {
  const { id } = useParams();
  const [thread, setThread] = useState<ThreadRow | null>(null);
  const [revsets, setRevsets] = useState<RevSetWire[]>([]);
  const [error, setError] = useState<string | null>(null);

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

  const dossierId = thread?.home_dossier_id ?? "us-voting-1";
  const latestVersion =
    revsets.length > 0 ? Math.max(...revsets.map((r) => r.version)) : 0;

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
                  <StatusBadge status="RFC" />
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
                            ? "Wrapper RFC coordinates sub-RFCs; it does not merge content. Each child leaf holds RevSets for one artifact."
                            : "Leaf RFC: RevSets propose ArtifactRevisions against the merge artifact. Merge authority / Accepted Risk still deferred."}
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
                      Wrapper RFC: open each sub-RFC to attach RevSets. Parent
                      becomes <code className="text-xs">decided</code> only when
                      all children are decided (decision controls still deferred).
                    </>
                  ) : (
                    <>
                      Leaf RFC scaffolding: RevSets below point at proposed
                      ArtifactRevisions. Merging those into{" "}
                      <code className="text-xs">
                        {thread.merge_artifact_id ?? "—"}
                      </code>{" "}
                      still lands in a later M5 cut.
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
                      revision.
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
                <p className="mb-4 text-sm text-neutral-600">
                  {thread.rfc_kind === "wrapper"
                    ? "Wrapper decisions follow children (all decided → parent decided). Merge / reject / park controls still deferred."
                    : "Merge / reject / park and Collection merge authority are still deferred within M5."}
                </p>
                <div className="flex gap-3">
                  <Button variant="default" size="lg" disabled>
                    Merge RFC
                  </Button>
                  <Button variant="outline" size="lg" disabled>
                    Reject
                  </Button>
                  <Button variant="outline" size="lg" disabled>
                    Park
                  </Button>
                </div>
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
                            {post.author_id.slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium text-neutral-900">
                            {post.author_id}
                          </div>
                          <div className="text-sm text-neutral-500">
                            {new Date(post.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-neutral-800">
                        {post.body}
                      </p>
                    </Card>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
