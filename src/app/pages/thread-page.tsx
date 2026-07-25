import { useEffect, useState } from "react";
import { Header } from "../components/header";
import { SidebarNav } from "../components/sidebar-nav";
import { StatusBadge } from "../components/badges";
import {
  ReplyComposer,
  authorDisplayName,
  authorInitials,
} from "../components/reply-composer";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { GitBranch, Flag } from "lucide-react";
import { useParams, Link, useNavigate } from "react-router";
import { getThread, promoteThread } from "../../api/client";
import type { ThreadPostRow, ThreadRow } from "../../doc/types";
import { readActingUserId } from "../lib/prototype-users";

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
        author_id: readActingUserId(),
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
                        {thread.home_dossier_id}
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
                        <span className="font-medium text-neutral-900">
                          {thread.merge_artifact_id}
                        </span>
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
                  <Button variant="outline" size="sm" disabled>
                    <Flag className="mr-2 h-4 w-4" />
                    Flag Candidate Finding
                  </Button>
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

              <div className="space-y-4">
                {(thread.posts ?? []).map((post) => (
                  <Card
                    key={post.post_id}
                    className="border border-neutral-200 bg-white p-6"
                  >
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-800 text-white">
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
                          {new Date(post.created_at).toLocaleString()} ·{" "}
                          {post.type}
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
            </>
          )}
        </div>
      </main>
    </div>
  );
}
