import { useEffect, useState } from "react";
import { Header } from "../components/header";
import { SidebarNav } from "../components/sidebar-nav";
import { StatusBadge } from "../components/badges";
import { ThreadTimeline } from "../components/thread-timeline";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { GitBranch } from "lucide-react";
import { useParams, Link, useNavigate } from "react-router";
import { getThread, promoteThread } from "../../api/client";
import type { ThreadPostRow, ThreadRow } from "../../doc/types";
import { useActingUser } from "../lib/acting-user";
import { ObjectBreadcrumbs } from "../components/object-breadcrumbs";
import { buildHierarchyCrumbs } from "../lib/object-nav";

function statusLabel(
  state: string,
): "Open" | "RFC" | "Review" | "Decided" | "Merged" | "Parked" {
  switch (state) {
    case "rfc":
      return "RFC";
    case "review":
      return "Review";
    case "decided":
      return "Decided";
    case "archived":
      return "Parked";
    default:
      return "Open";
  }
}

export function ThreadPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userId: actingId } = useActingUser();
  const [thread, setThread] = useState<ThreadRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [promoting, setPromoting] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getThread(id)
      .then((t) => {
        if (!cancelled) {
          setThread(t);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setThread(null);
          setError(err instanceof Error ? err.message : "Failed to load thread");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function onPromote() {
    if (!id || !thread || thread.state !== "open") return;
    setPromoting(true);
    try {
      const updated = await promoteThread(id, {
        author_id: actingId,
      });
      setThread(updated);
      navigate(`/thread/${id}/rfc`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Promote failed");
    } finally {
      setPromoting(false);
    }
  }

  function onPosted(post: ThreadPostRow) {
    setThread((prev) =>
      prev
        ? { ...prev, posts: [...(prev.posts ?? []), post] }
        : prev,
    );
  }

  function onPostDeleted(postId: string) {
    setThread((prev) =>
      prev
        ? {
            ...prev,
            posts: (prev.posts ?? []).filter((p) => p.post_id !== postId),
          }
        : prev,
    );
  }

  const dossierId = thread?.home_dossier_id ?? "us-voting-1";

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />
      <SidebarNav dossierId={dossierId} currentPage="thread" />

      <main className="ml-64 pt-16">
        <div className="mx-auto max-w-[900px] px-8 py-8">
          {error && (
            <Card className="mb-4 border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {error}
            </Card>
          )}

          {!thread && !error && (
            <p className="text-sm text-neutral-500">Loading thread…</p>
          )}

          {thread && (
            <>
              <div className="mb-8">
                {thread.collection_id && thread.area_kind && (
                  <ObjectBreadcrumbs
                    crumbs={buildHierarchyCrumbs({
                      area_kind: thread.area_kind,
                      collection_id: thread.collection_id,
                      collection_title:
                        thread.collection_title ?? "Collection",
                      dossier_id: thread.home_dossier_id,
                      dossier_title:
                        thread.home_dossier_title ?? thread.home_dossier_id,
                      leaf: [{ label: thread.title }],
                    })}
                  />
                )}
                <div className="mb-4 flex items-center gap-3">
                  <StatusBadge status={statusLabel(thread.state)} />
                  <span className="text-sm text-neutral-500">
                    {thread.thread_id}
                  </span>
                </div>
                <h1 className="mb-4 text-3xl font-bold text-neutral-900">
                  {thread.title}
                </h1>

                <div className="mb-4 rounded-lg border border-neutral-200 bg-white p-4">
                  <div className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-500">
                    Thread Targets
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-neutral-600">Home dossier:</span>
                      <Link
                        to={`/dossier/${thread.home_dossier_id}`}
                        className="font-medium text-neutral-900 hover:text-neutral-700"
                      >
                        {thread.home_dossier_title ?? thread.home_dossier_id}
                      </Link>
                    </div>
                    {(thread.targets ?? []).map((t) => (
                      <div
                        key={`${t.target_kind}:${t.target_id}`}
                        className="flex items-center gap-2"
                      >
                        <span className="text-neutral-600">{t.target_kind}:</span>
                        {t.target_kind === "artifact" ? (
                          <Link
                            to={`/dossier/${thread.home_dossier_id}/artifact/${t.target_id}`}
                            className="font-medium text-neutral-900 hover:text-neutral-700"
                          >
                            {t.target_id}
                          </Link>
                        ) : (
                          <span className="font-medium text-neutral-900">
                            {t.target_id}
                          </span>
                        )}
                      </div>
                    ))}
                    {thread.merge_artifact_id && (
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-600">Merge artifact:</span>
                        <Link
                          to={`/dossier/${thread.home_dossier_id}/artifact/${thread.merge_artifact_id}`}
                          className="font-medium text-neutral-900 hover:text-neutral-700"
                        >
                          {thread.merge_artifact_id}
                        </Link>
                      </div>
                    )}
                    {thread.collection_id && (
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-600">Collection:</span>
                        <Link
                          to={`/collection/${thread.collection_id}`}
                          className="font-medium text-neutral-900 hover:text-neutral-700"
                        >
                          {thread.collection_title ?? thread.collection_id}
                        </Link>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-3">
                  {thread.state === "open" ? (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={onPromote}
                      disabled={promoting}
                    >
                      <GitBranch className="mr-2 h-4 w-4" />
                      {promoting ? "Promoting…" : "Promote to RFC"}
                    </Button>
                  ) : thread.state === "rfc" ? (
                    <Link to={`/thread/${thread.thread_id}/rfc`}>
                      <Button variant="default" size="sm">
                        <GitBranch className="mr-2 h-4 w-4" />
                        Open RFC detail
                      </Button>
                    </Link>
                  ) : null}
                </div>
                {thread.state === "open" && (
                  <p className="mt-2 text-xs text-neutral-500">
                    One artifact target → leaf RFC. Multiple targets in the same
                    Collection → wrapper parent + one sub-RFC per artifact.
                  </p>
                )}
                {thread.rfc_kind === "wrapper" &&
                  (thread.child_threads?.length ?? 0) > 0 && (
                    <div className="mt-4 rounded-lg border border-neutral-200 bg-white p-4">
                      <div className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-500">
                        Sub-RFCs
                      </div>
                      <ul className="space-y-2 text-sm">
                        {thread.child_threads!.map((child) => (
                          <li key={child.thread_id}>
                            <Link
                              to={`/thread/${child.thread_id}/rfc`}
                              className="font-medium text-neutral-900 hover:text-neutral-700"
                            >
                              {child.title}
                            </Link>
                            <span className="ml-2 text-neutral-500">
                              → {child.merge_artifact_id}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                {thread.parent_thread_id && (
                  <p className="mt-3 text-xs text-neutral-500">
                    Sub-RFC of{" "}
                    <Link
                      to={`/thread/${thread.parent_thread_id}/rfc`}
                      className="underline"
                    >
                      {thread.parent_thread_id}
                    </Link>
                  </p>
                )}
              </div>

              <ThreadTimeline
                threadId={thread.thread_id}
                posts={thread.posts ?? []}
                onPosted={onPosted}
                onPostDeleted={onPostDeleted}
              />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
