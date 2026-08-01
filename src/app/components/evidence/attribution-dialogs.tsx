import { useEffect, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import { ScrollArea } from "@/app/components/ui/scroll-area";

import type { AttributionEntity } from "@/doc/evidence";
import { putAttributions } from "@/api/client";
import { useEvidenceRegistry } from "@/editor/evidenceRegistry";
import {
  formatImmutableRefLabel,
  validateImmutableRef,
} from "@/lib/immutableRef";

type AttributionDraft = Omit<AttributionEntity, "id" | "authors"> & {
  id?: string;
  authorsText?: string;
};

const normalize = (s: string) => s.trim().toLowerCase();

function labelFor(item: { title?: string; url?: string; id: string }) {
  if (item.title && item.title.trim()) return item.title;
  if (item.url && item.url.trim()) return item.url;
  return item.id;
}

function matchesAttribution(att: AttributionEntity, query: string) {
  const q = normalize(query);
  if (!q) return true;
  return (
    normalize(att.title).includes(q) ||
    normalize(att.url ?? "").includes(q) ||
    att.authors.some((a) => normalize(a).includes(q))
  );
}

function defaultNewAttribution(seedTitleOrUrl: string): AttributionDraft {
  const seed = seedTitleOrUrl.trim();
  const isUrl = /^https?:\/\//i.test(seed);
  return {
    type: "url",
    title: isUrl ? "Untitled source" : seed || "Untitled source",
    url: isUrl ? seed : "",
    authorsText: "",
    publisher: "",
    date_published: "",
    accessed_at: "",
    immutable_ref: null,
    notes: "",
  };
}

export function AttributionSearchDialog({
  open,
  onOpenChange,
  initialQuery,
  onSelectAttributionId,
  onCreateNew,
  onEditAttribution,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialQuery: string;
  onSelectAttributionId: (id: string) => void;
  onCreateNew: (seed: string) => void;
  onEditAttribution: (att: AttributionEntity) => void;
}) {
  const { attributions, loading, error } = useEvidenceRegistry();
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => {
    if (!open) return;
    setQuery(initialQuery);
  }, [initialQuery, open]);

  const results = useMemo(() => {
    const filtered = attributions.items.filter((a) => matchesAttribution(a, query));
    return filtered.sort((a, b) => labelFor(a).localeCompare(labelFor(b)));
  }, [attributions.items, query]);

  const urlDupe =
    query.trim() &&
    /^https?:\/\//i.test(query.trim()) &&
    attributions.items.some((a) => (a.url ?? "").trim() === query.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Insert Citation</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search sources (title, URL, author)…"
              className="h-9"
              autoFocus
            />
            <Button
              variant="outline"
              onClick={() => onCreateNew(query)}
              disabled={loading}
            >
              New Source
            </Button>
          </div>

          {urlDupe ? (
            <div className="text-xs text-amber-700">
              A source with this URL already exists. Prefer selecting it.
            </div>
          ) : null}

          {error ? (
            <div className="text-sm text-red-700">
              Failed to load sources: {error}
            </div>
          ) : null}

          <div className="rounded-md border border-neutral-200">
            <ScrollArea className="h-[320px]">
              <div className="p-2">
                {results.length === 0 ? (
                  <div className="p-3 text-sm text-neutral-600">
                    No matches. You can create a new source.
                  </div>
                ) : (
                  results.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-start justify-between gap-3 rounded-md px-2 py-2 hover:bg-neutral-50"
                    >
                      <button
                        type="button"
                        className="flex flex-1 flex-col items-start gap-1 text-left"
                        onClick={() => onSelectAttributionId(att.id)}
                      >
                        <div className="text-sm font-medium text-neutral-900">
                          {labelFor(att)}
                        </div>
                        {att.url ? (
                          <div className="line-clamp-1 text-xs text-neutral-500">
                            {att.url}
                          </div>
                        ) : null}
                        {att.authors.length ? (
                          <div className="line-clamp-1 text-xs text-neutral-600">
                            {att.authors.join(", ")}
                          </div>
                        ) : (
                          <div className="text-xs text-neutral-400">
                            No authors listed
                          </div>
                        )}
                        {att.immutable_ref ? (
                          <div className="line-clamp-1 font-mono text-[10px] text-neutral-500">
                            {formatImmutableRefLabel(att.immutable_ref) ??
                              att.immutable_ref}
                          </div>
                        ) : null}
                      </button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditAttribution(att)}
                      >
                        Edit
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AttributionEditorDialog({
  open,
  onOpenChange,
  seed,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seed: string;
  editing: AttributionEntity | null;
  onSaved: (id: string) => void;
}) {
  const registry = useEvidenceRegistry();
  const [draft, setDraft] = useState<AttributionDraft>(() =>
    editing
      ? { ...editing, authorsText: editing.authors.join(", ") }
      : defaultNewAttribution(seed),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setDraft(
      editing
        ? { ...editing, authorsText: editing.authors.join(", ") }
        : defaultNewAttribution(seed),
    );
  }, [editing, open, seed]);

  const title = (draft.title ?? "").trim();
  const immutableCheck = validateImmutableRef(draft.immutable_ref);
  const isValid = title.length > 0 && immutableCheck.ok;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const id = editing?.id ?? uuidv4();
      const authors = (draft.authorsText ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      if (!immutableCheck.ok) {
        setSaving(false);
        setError(immutableCheck.message);
        return;
      }

      const entity: AttributionEntity = {
        id,
        type: draft.type ?? "url",
        title,
        authors,
        publisher: (draft.publisher ?? "").trim() || undefined,
        date_published: (draft.date_published ?? "").trim() || undefined,
        url: (draft.url ?? "").trim() || undefined,
        accessed_at: (draft.accessed_at ?? "").trim() || undefined,
        immutable_ref: immutableCheck.parsed?.normalized ?? null,
        notes: (draft.notes ?? "").trim() || undefined,
      };

      const nextItems = (() => {
        const items = registry.attributions.items.slice();
        const idx = items.findIndex((a) => a.id === id);
        if (idx === -1) return [entity, ...items];
        items[idx] = entity;
        return items;
      })();

      await putAttributions({
        version: registry.attributions.version,
        items: nextItems,
      });
      await registry.reload();
      setSaving(false);
      onSaved(id);
      onOpenChange(false);
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : "Failed to save source");
    }
  };

  const urlDupe =
    (draft.url ?? "").trim() &&
    registry.attributions.items.some(
      (a) => a.id !== editing?.id && (a.url ?? "").trim() === (draft.url ?? "").trim(),
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Source" : "Create Source"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error ? <div className="text-sm text-red-700">{error}</div> : null}

          {urlDupe ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Potential duplicate: another source already has this URL.
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Title</Label>
              <Input
                value={draft.title ?? ""}
                onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
                placeholder="Example Article Title"
              />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <select
                value={draft.type ?? "url"}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, type: e.target.value as AttributionEntity["type"] }))
                }
                className="h-9 w-full rounded-md border border-neutral-200 bg-white px-2 text-sm"
              >
                <option value="url">url</option>
                <option value="paper">paper</option>
                <option value="report">report</option>
                <option value="book">book</option>
                <option value="other">other</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>URL (Optional)</Label>
            <Input
              value={draft.url ?? ""}
              onChange={(e) => setDraft((p) => ({ ...p, url: e.target.value }))}
              placeholder="https://example.com/..."
            />
          </div>

          <div className="space-y-1">
            <Label>Immutable ref (Optional)</Label>
            <Input
              value={draft.immutable_ref ?? ""}
              onChange={(e) =>
                setDraft((p) => ({
                  ...p,
                  immutable_ref: e.target.value.trim() ? e.target.value : null,
                }))
              }
              placeholder="doi:10.… / arxiv:….vN / github:org/repo@sha / osf:id/vN"
              className="font-mono text-xs"
            />
            {!immutableCheck.ok ? (
              <div className="text-xs text-red-700">{immutableCheck.message}</div>
            ) : immutableCheck.parsed ? (
              <div className="text-xs text-neutral-500">
                Normalized:{" "}
                <span className="font-mono">{immutableCheck.parsed.normalized}</span>
              </div>
            ) : (
              <div className="text-xs text-neutral-500">
                Snapshot identity per CONCEPT App D/E (omit if only a mutable URL).
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Authors (comma-separated)</Label>
              <Input
                value={draft.authorsText ?? ""}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, authorsText: e.target.value }))
                }
                placeholder="Author One, Author Two"
              />
            </div>
            <div className="space-y-1">
              <Label>Publisher (Optional)</Label>
              <Input
                value={draft.publisher ?? ""}
                onChange={(e) => setDraft((p) => ({ ...p, publisher: e.target.value }))}
                placeholder="Publisher/Org"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Date Published (Optional)</Label>
              <Input
                value={draft.date_published ?? ""}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, date_published: e.target.value }))
                }
                placeholder="YYYY-MM-DD"
              />
            </div>
            <div className="space-y-1">
              <Label>Accessed At (Optional)</Label>
              <Input
                value={draft.accessed_at ?? ""}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, accessed_at: e.target.value }))
                }
                placeholder="YYYY-MM-DD"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Notes (Optional)</Label>
            <Textarea
              value={draft.notes ?? ""}
              onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Any extra context, quotes, or rationale."
              className="min-h-[90px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!isValid || saving}>
            {saving ? "Saving…" : editing ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
