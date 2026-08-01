import { useEffect, useMemo, useState } from "react";
import {
  flagCandidateFinding,
  getThreadCandidates,
  getThreadFindings,
  promoteCandidateFinding,
  softDeleteThreadPost,
} from "../../api/client";
import type {
  CandidateFindingRow,
  FindingRow,
  ThreadPostRow,
} from "../../doc/types";
import {
  actorMayPromoteCandidate,
  findingMatchesTimelineFilter,
  postMatchesTimelineFilter,
  type TimelineFilter,
} from "../../lib/candidateFindings";
import { useActingUserOptional } from "../lib/acting-user";
import { getPrototypeUser } from "../lib/prototype-users";
import { userHasCapability } from "../lib/role-affordances";
import { ActingAsHint } from "./acting-as-hint";
import {
  ReplyComposer,
  authorDisplayName,
  authorInitials,
} from "./reply-composer";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "./ui/toggle-group";
import { AlertTriangle, Flag, ShieldAlert, Trash2 } from "lucide-react";

type ThreadTimelineProps = {
  threadId: string;
  posts: ThreadPostRow[];
  onPosted?: (post: ThreadPostRow) => void;
  /** Called after a successful soft-delete so parents can drop the post. */
  onPostDeleted?: (postId: string) => void;
  /** Optional heading override (default: Discussion). */
  heading?: string;
};

type TimelineEntry =
  | { kind: "finding"; at: string; finding: FindingRow }
  | { kind: "post"; at: string; post: ThreadPostRow };

function severityBadgeClass(severity: string): string {
  switch (severity) {
    case "critical":
      return "bg-red-100 text-red-800";
    case "high":
      return "bg-orange-100 text-orange-800";
    case "med":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-neutral-100 text-neutral-700";
  }
}

export function ThreadTimeline({
  threadId,
  posts,
  onPosted,
  onPostDeleted,
  heading = "Discussion",
}: ThreadTimelineProps) {
  const { userId: actingId } = useActingUserOptional();
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const [findings, setFindings] = useState<FindingRow[]>([]);
  const [candidates, setCandidates] = useState<CandidateFindingRow[]>([]);
  const [busyPostId, setBusyPostId] = useState<string | null>(null);
  const [busyCandidateId, setBusyCandidateId] = useState<string | null>(null);
  const [busyDeleteId, setBusyDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const actor = getPrototypeUser(actingId);
  const canModerate = userHasCapability(actor, "moderate_posts");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getThreadFindings(threadId),
      getThreadCandidates(threadId),
    ])
      .then(([f, c]) => {
        if (!cancelled) {
          setFindings(f);
          setCandidates(c);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load Findings",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [threadId]);

  const candidatesByPost = useMemo(() => {
    const map = new Map<string, CandidateFindingRow>();
    for (const c of candidates) map.set(c.post_id, c);
    return map;
  }, [candidates]);

  const openCandidates = useMemo(
    () => candidates.filter((c) => c.status === "open"),
    [candidates],
  );

  const entries = useMemo(() => {
    const items: TimelineEntry[] = [];
    if (findingMatchesTimelineFilter(filter)) {
      for (const finding of findings) {
        items.push({
          kind: "finding",
          at: finding.created_at,
          finding,
        });
      }
    }
    for (const post of posts) {
      if (!postMatchesTimelineFilter(post.type, filter)) continue;
      items.push({ kind: "post", at: post.created_at, post });
    }
    items.sort((a, b) => a.at.localeCompare(b.at));
    return items;
  }, [filter, findings, posts]);

  const canPromote = actorMayPromoteCandidate(actingId);

  async function onFlag(post: ThreadPostRow) {
    if (busyPostId) return;
    setBusyPostId(post.post_id);
    setError(null);
    try {
      const candidate = await flagCandidateFinding(threadId, {
        post_id: post.post_id,
        flagger_id: actingId,
        note: "Flagged from thread timeline",
      });
      setCandidates((prev) => [...prev, candidate]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Flag failed");
    } finally {
      setBusyPostId(null);
    }
  }

  async function onPromote(candidate: CandidateFindingRow) {
    if (busyCandidateId || !canPromote) return;
    setBusyCandidateId(candidate.candidate_id);
    setError(null);
    try {
      const result = await promoteCandidateFinding(candidate.candidate_id, {
        author_id: actingId,
        severity: "med",
        title: `Candidate from ${candidate.post_id}`,
        targets: [{ target_kind: "thread", target_id: threadId }],
      });
      setFindings((prev) => [...prev, result.finding]);
      setCandidates((prev) =>
        prev.map((c) =>
          c.candidate_id === result.candidate.candidate_id
            ? result.candidate
            : c,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Promote failed");
    } finally {
      setBusyCandidateId(null);
    }
  }

  async function onSoftDelete(post: ThreadPostRow) {
    if (busyDeleteId || !canModerate || post.deleted_at) return;
    setBusyDeleteId(post.post_id);
    setError(null);
    try {
      await softDeleteThreadPost(threadId, post.post_id, {
        actor_id: actingId,
        reason: "Moderation soft-delete",
      });
      onPostDeleted?.(post.post_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Soft-delete failed");
    } finally {
      setBusyDeleteId(null);
    }
  }

  function scrollToFinding(findingId: string) {
    const el = document.getElementById(`finding-${findingId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="mt-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-xl font-semibold text-neutral-900">{heading}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-neutral-500">
            View
          </span>
          <ToggleGroup
            type="single"
            value={filter}
            onValueChange={(value) => {
              if (
                value === "all" ||
                value === "findings" ||
                value === "findings_responses"
              ) {
                setFilter(value);
              }
            }}
            className="bg-white"
          >
            <ToggleGroupItem value="findings" className="text-sm">
              Findings only
            </ToggleGroupItem>
            <ToggleGroupItem value="findings_responses" className="text-sm">
              Findings + responses
            </ToggleGroupItem>
            <ToggleGroupItem value="all" className="text-sm">
              All discussion
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {error && (
        <Card className="mb-4 border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </Card>
      )}

      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="min-w-0 flex-1 space-y-4">
          {entries.length === 0 && (
            <p className="text-sm text-neutral-500">
              No timeline items for this filter.
            </p>
          )}

          {entries.map((entry) => {
            if (entry.kind === "finding") {
              const f = entry.finding;
              return (
                <Card
                  key={`finding:${f.finding_id}`}
                  id={`finding-${f.finding_id}`}
                  className="border border-neutral-200 border-l-4 border-l-red-500 bg-white p-6"
                >
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50">
                        <ShieldAlert className="h-5 w-5 text-red-700" />
                      </div>
                      <div>
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded px-2 py-0.5 text-xs font-medium uppercase ${severityBadgeClass(f.severity)}`}
                          >
                            {f.severity}
                          </span>
                          <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs font-medium uppercase text-neutral-700">
                            {f.status}
                          </span>
                          <span className="text-xs text-neutral-500">
                            Finding
                          </span>
                        </div>
                        <h3 className="font-semibold text-neutral-900">
                          {f.title}
                        </h3>
                        <div className="text-sm text-neutral-500">
                          {authorDisplayName(f.author_id)} ·{" "}
                          {new Date(f.created_at).toLocaleString()}
                          {f.source_candidate_id
                            ? ` · promoted from ${f.source_candidate_id}`
                            : ""}
                        </div>
                      </div>
                    </div>
                  </div>
                  {f.evidence && (
                    <p className="mb-2 whitespace-pre-wrap text-sm text-neutral-800">
                      {f.evidence}
                    </p>
                  )}
                  {f.attack_path && (
                    <p className="text-sm text-neutral-700">
                      <span className="font-medium">Attack path:</span>{" "}
                      {f.attack_path}
                    </p>
                  )}
                </Card>
              );
            }

            const post = entry.post;
            const candidate = candidatesByPost.get(post.post_id);
            const isMitigation = post.type === "mitigation";
            return (
              <Card
                key={`post:${post.post_id}`}
                className={`border bg-white p-6 ${
                  isMitigation
                    ? "border-amber-200 border-l-4 border-l-amber-500"
                    : "border-neutral-200"
                }`}
              >
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full text-white ${
                        isMitigation ? "bg-amber-700" : "bg-neutral-800"
                      }`}
                    >
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
                  <div className="flex flex-wrap items-center gap-2">
                    {candidate && (
                      <span className="inline-flex items-center gap-1 rounded bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-800">
                        <AlertTriangle className="h-3 w-3" />
                        Candidate · {candidate.status}
                      </span>
                    )}
                    {!candidate && post.type === "comment" && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busyPostId === post.post_id}
                        onClick={() => onFlag(post)}
                      >
                        <Flag className="mr-1.5 h-3.5 w-3.5" />
                        {busyPostId === post.post_id
                          ? "Flagging…"
                          : "Flag Candidate"}
                      </Button>
                    )}
                    {canModerate && !post.deleted_at && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busyDeleteId === post.post_id}
                        onClick={() => onSoftDelete(post)}
                        data-testid="soft-delete-post"
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                        {busyDeleteId === post.post_id
                          ? "Deleting…"
                          : "Soft-delete"}
                      </Button>
                    )}
                    {candidate?.status === "open" && canPromote && (
                      <Button
                        type="button"
                        size="sm"
                        disabled={busyCandidateId === candidate.candidate_id}
                        onClick={() => onPromote(candidate)}
                      >
                        {busyCandidateId === candidate.candidate_id
                          ? "Promoting…"
                          : "Promote to Finding"}
                      </Button>
                    )}
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-sm text-neutral-800">
                  {post.body}
                </p>
                {candidate?.note && (
                  <p className="mt-2 text-xs text-neutral-500">
                    Flag note: {candidate.note}
                  </p>
                )}
              </Card>
            );
          })}

          {filter === "all" && (
            <ReplyComposer
              threadId={threadId}
              onPosted={onPosted}
              allowMitigation
            />
          )}
          {filter !== "all" && (
            <p className="text-xs text-neutral-500">
              Switch to All discussion to post a reply
              {actor?.roles.includes("red_team")
                ? " or mitigation response"
                : ""}
              .
            </p>
          )}
        </div>

        <aside className="w-full shrink-0 space-y-4 lg:w-72">
          <Card className="border border-neutral-200 bg-white p-4">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-500">
              Findings index
            </h3>
            {findings.length === 0 ? (
              <p className="text-sm text-neutral-500">No Findings yet.</p>
            ) : (
              <ul className="space-y-2">
                {findings.map((f) => (
                  <li key={f.finding_id}>
                    <button
                      type="button"
                      className="w-full rounded border border-transparent px-2 py-1.5 text-left text-sm hover:border-neutral-200 hover:bg-neutral-50"
                      onClick={() => scrollToFinding(f.finding_id)}
                    >
                      <span
                        className={`mr-1.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${severityBadgeClass(f.severity)}`}
                      >
                        {f.severity}
                      </span>
                      <span className="font-medium text-neutral-900">
                        {f.title}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="border border-neutral-200 bg-white p-4">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-500">
              Open candidates
            </h3>
            {openCandidates.length === 0 ? (
              <p className="text-sm text-neutral-500">
                No open Candidate Findings.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {openCandidates.map((c) => (
                  <li
                    key={c.candidate_id}
                    className="rounded border border-violet-100 bg-violet-50/50 px-2 py-1.5"
                  >
                    <div className="font-medium text-neutral-900">
                      {c.candidate_id}
                    </div>
                    <div className="text-xs text-neutral-500">
                      post {c.post_id} · flagged by {c.flagger_id}
                    </div>
                    {canPromote && (
                      <Button
                        type="button"
                        size="sm"
                        className="mt-2"
                        disabled={busyCandidateId === c.candidate_id}
                        onClick={() => onPromote(c)}
                      >
                        Promote
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {!canPromote && (
              <div className="mt-2">
                <ActingAsHint
                  className="text-xs text-neutral-500"
                  requireCapability="create_findings"
                  capabilityLabel="promote candidates"
                />
              </div>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
