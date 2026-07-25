import { useEffect, useState } from "react";
import { Header } from "../components/header";
import { SidebarNav } from "../components/sidebar-nav";
import { StatusBadge } from "../components/badges";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { GitBranch, Flag } from "lucide-react";
import { useParams, Link, useNavigate } from "react-router";
import { getThread, promoteThread } from "../../api/client";
import type { ThreadRow } from "../../doc/types";

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
      const updated = await promoteThread(id, { author_id: "user-alice" });
      setThread(updated);
      navigate(`/thread/${id}/rfc`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Promote failed");
    } finally {
      setPromoting(false);
    }
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
                    Leaf promote requires a single artifact target (wrapper
                    parent/sub-RFC still deferred).
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
                          {post.author_id.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-neutral-900">
                          {post.author_id}
                        </div>
                        <div className="text-sm text-neutral-500">
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

                <Card className="border-2 border-dashed border-neutral-300 bg-white p-6">
                  <div className="text-center text-sm text-neutral-500">
                    <p>Reply composer (impersonated author) still open in M5.</p>
                  </div>
                </Card>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
