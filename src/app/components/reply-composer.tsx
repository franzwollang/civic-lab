import { useEffect, useState, type FormEvent } from "react";
import { createThreadPost } from "../../api/client";
import type { ThreadPostRow } from "../../doc/types";
import {
  DEFAULT_PROTOTYPE_USER_ID,
  PROTOTYPE_USERS,
  formatUserLabel,
  getPrototypeUser,
  readActingUserId,
  writeActingUserId,
} from "../lib/prototype-users";
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
};

export function ReplyComposer({
  threadId,
  enabled = true,
  onPosted,
}: ReplyComposerProps) {
  const [authorId, setAuthorId] = useState(DEFAULT_PROTOTYPE_USER_ID);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAuthorId(readActingUserId());
  }, []);

  function onAuthorChange(next: string) {
    setAuthorId(next);
    writeActingUserId(next);
  }

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
        type: "comment",
      });
      setBody("");
      onPosted?.(post);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post reply");
    } finally {
      setSubmitting(false);
    }
  }

  const author = getPrototypeUser(authorId);
  const canSubmit = enabled && !submitting && body.trim().length > 0;

  return (
    <Card className="border border-neutral-200 bg-white p-6">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-[220px] flex-1 space-y-1.5">
            <Label htmlFor="reply-author" className="text-xs uppercase tracking-wider text-neutral-500">
              Post as (impersonate)
            </Label>
            <Select
              value={authorId}
              onValueChange={onAuthorChange}
              disabled={!enabled || submitting}
            >
              <SelectTrigger id="reply-author" className="w-full bg-white">
                <SelectValue placeholder="Choose user" />
              </SelectTrigger>
              <SelectContent>
                {PROTOTYPE_USERS.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {formatUserLabel(u)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {author && (
            <p className="text-xs text-neutral-500">
              Acting as <span className="font-medium text-neutral-700">{author.id}</span>
            </p>
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
            placeholder="Write a reply…"
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
