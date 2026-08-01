import { useState, type FormEvent } from "react";
import { createThreadPost } from "../../api/client";
import type { ThreadPostRow } from "../../doc/types";
import { useActingUserOptional } from "../lib/acting-user";
import { getPrototypeUser } from "../lib/prototype-users";
import { ActingAsHint } from "./acting-as-hint";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Textarea } from "./ui/textarea";

type ReplyComposerProps = {
  threadId: string;
  /** When false, hide/disable (e.g. thread still loading). Default true. */
  enabled?: boolean;
  onPosted?: (post: ThreadPostRow) => void;
  /** CONCEPT §7.5 — allow mitigation response type (default false). */
  allowMitigation?: boolean;
};

export function ReplyComposer({
  threadId,
  enabled = true,
  onPosted,
  allowMitigation = false,
}: ReplyComposerProps) {
  const { userId: authorId, user: actingUser } = useActingUserOptional();
  const [body, setBody] = useState("");
  const [postType, setPostType] = useState<"comment" | "mitigation">("comment");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || !enabled || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const post = await createThreadPost(threadId, {
        author_id: authorId,
        body: trimmed,
        type: allowMitigation ? postType : "comment",
      });
      setBody("");
      onPosted?.(post);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post reply");
    } finally {
      setSubmitting(false);
    }
  }

  const canMitigate = Boolean(actingUser?.roles.includes("red_team"));
  const canSubmit = enabled && !submitting && body.trim().length > 0;

  return (
    <Card className="border border-neutral-200 bg-white p-6">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <ActingAsHint className="min-w-[220px] flex-1 text-xs text-neutral-500" />
          {allowMitigation && canMitigate && (
            <div className="min-w-[160px] space-y-1.5">
              <Label
                htmlFor="reply-type"
                className="text-xs uppercase tracking-wider text-neutral-500"
              >
                Post type
              </Label>
              <Select
                value={postType}
                onValueChange={(v) =>
                  setPostType(v === "mitigation" ? "mitigation" : "comment")
                }
                disabled={!enabled || submitting}
              >
                <SelectTrigger id="reply-type" className="w-full bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="comment">Comment</SelectItem>
                  <SelectItem value="mitigation">Mitigation response</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reply-body" className="sr-only">
            Reply
          </Label>
          <Textarea
            id="reply-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={
              postType === "mitigation"
                ? "Write a mitigation response…"
                : "Write a reply…"
            }
            rows={4}
            disabled={!enabled || submitting}
            className="bg-white"
          />
        </div>

        {error && (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-3">
          <Button type="submit" size="sm" disabled={!canSubmit}>
            {submitting ? "Posting…" : "Post reply"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

/** Display helper for post headers — prefers seed display names. */
export function authorDisplayName(authorId: string): string {
  return getPrototypeUser(authorId)?.display_name ?? authorId;
}

export function authorInitials(authorId: string): string {
  const name = authorDisplayName(authorId);
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}
