import { useEffect, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";

import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import { Badge } from "@/app/components/ui/badge";
import { Separator } from "@/app/components/ui/separator";

import type { TermAlias, TermEntity } from "@/doc/evidence";
import { putTerms } from "@/api/client";
import { useEvidenceRegistry } from "@/editor/evidenceRegistry";

type TermDraft = Omit<TermEntity, "id"> & { id?: string };

const normalize = (s: string) => s.trim().toLowerCase();

function defaultNewTerm(seedLabel: string): TermDraft {
  const label = seedLabel.trim() || "";
  return {
    scope: { kind: "global" },
    type: "platform_construct",
    status: "tentative",
    canonical_label_en: label,
    aliases: label
      ? [{ lang: "en", text: label, transliteration: null }]
      : [],
    definition_en: "",
    disambiguation_en: "",
    see_also_term_ids: [],
    notes: "",
  };
}

function matchesTerm(term: TermEntity, query: string) {
  const q = normalize(query);
  if (!q) return true;
  if (normalize(term.canonical_label_en).includes(q)) return true;
  return term.aliases.some((a) => normalize(a.text).includes(q));
}

export function TermSearchDialog({
  open,
  onOpenChange,
  initialQuery,
  onSelectTermId,
  onProposeNew,
  onEditTerm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialQuery: string;
  onSelectTermId: (termId: string) => void;
  onProposeNew: (seedLabel: string) => void;
  onEditTerm: (term: TermEntity) => void;
}) {
  const { terms, loading, error } = useEvidenceRegistry();
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => {
    if (!open) return;
    setQuery(initialQuery);
  }, [initialQuery, open]);

  const results = useMemo(() => {
    const filtered = terms.items.filter((t) => matchesTerm(t, query));
    const statusRank = (t: TermEntity) => {
      return (t.status ?? "tentative") === "accepted" ? 0 : 1;
    };
    return filtered.sort((a, b) => {
      const dr = statusRank(a) - statusRank(b);
      if (dr !== 0) return dr;
      return a.canonical_label_en.localeCompare(b.canonical_label_en);
    });
  }, [query, terms.items]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Insert Term</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search terms (label or alias)…"
              className="h-9"
              autoFocus
            />
            <Button
              variant="outline"
              onClick={() => onProposeNew(query)}
              disabled={loading}
            >
              Propose New
            </Button>
          </div>

          {error ? (
            <div className="text-sm text-red-700">Failed to load terms: {error}</div>
          ) : null}

          <div className="rounded-md border border-neutral-200">
            <ScrollArea className="h-[320px]">
              <div className="p-2">
                {results.length === 0 ? (
                  <div className="p-3 text-sm text-neutral-600">
                    No matches. You can propose a new term.
                  </div>
                ) : (
                  results.map((term) => (
                    <div
                      key={term.id}
                      className="flex items-start justify-between gap-3 rounded-md px-2 py-2 hover:bg-neutral-50"
                    >
                    <button
                      type="button"
                      className="flex flex-1 flex-col items-start gap-1 text-left"
                      onClick={() => onSelectTermId(term.id)}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-medium text-neutral-900">
                          {term.canonical_label_en}
                        </div>
                        {(() => {
                          const s = term.status ?? "tentative";
                          return (
                            <Badge
                              variant={s === "accepted" ? "secondary" : "outline"}
                              className="text-[11px]"
                            >
                              {s}
                            </Badge>
                          );
                        })()}
                      </div>
                      {term.definition_en ? (
                        <div className="line-clamp-2 text-xs text-neutral-600">
                          {term.definition_en}
                        </div>
                      ) : (
                        <div className="text-xs text-amber-700">Missing definition.</div>
                      )}
                    </button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditTerm(term)}
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

export function TermEditorDialog({
  open,
  onOpenChange,
  seedLabel,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seedLabel: string;
  editing: TermEntity | null;
  onSaved: (termId: string) => void;
}) {
  const registry = useEvidenceRegistry();
  const [draft, setDraft] = useState<TermDraft>(() =>
    editing ? editing : defaultNewTerm(seedLabel),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setDraft(editing ? editing : defaultNewTerm(seedLabel));
  }, [editing, open, seedLabel]);

  const canonical = draft.canonical_label_en ?? "";
  const definition = draft.definition_en ?? "";

  const isValid =
    canonical.trim().length > 0 &&
    definition.trim().length > 0 &&
    Array.isArray(draft.aliases) &&
    draft.aliases.length > 0 &&
    draft.aliases.every((a) => a.lang.trim() && a.text.trim());

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const id = editing?.id ?? uuidv4();
      const entity: TermEntity = {
        id,
        scope: { kind: "global" },
        type: draft.type ?? "platform_construct",
        status: editing?.status ?? draft.status ?? "tentative",
        canonical_label_en: canonical.trim(),
        aliases: (draft.aliases ?? []).map((a) => ({
          lang: a.lang.trim(),
          text: a.text.trim(),
          transliteration: a.transliteration ?? null,
        })),
        definition_en: definition.trim(),
        disambiguation_en: (draft.disambiguation_en ?? "").trim(),
        see_also_term_ids: draft.see_also_term_ids ?? [],
        notes: (draft.notes ?? "").trim(),
      };

      const nextItems = (() => {
        const items = registry.terms.items.slice();
        const idx = items.findIndex((t) => t.id === id);
        if (idx === -1) return [entity, ...items];
        items[idx] = entity;
        return items;
      })();

      await putTerms({ version: registry.terms.version, items: nextItems });
      await registry.reload();
      setSaving(false);
      onSaved(id);
      onOpenChange(false);
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : "Failed to save term");
    }
  };

  const updateAlias = (idx: number, patch: Partial<TermAlias>) => {
    const next = (draft.aliases ?? []).slice();
    next[idx] = { ...next[idx], ...patch } as TermAlias;
    setDraft((prev) => ({ ...prev, aliases: next }));
  };

  const addAlias = () => {
    setDraft((prev) => ({
      ...prev,
      aliases: [...(prev.aliases ?? []), { lang: "en", text: "", transliteration: null }],
    }));
  };

  const removeAlias = (idx: number) => {
    setDraft((prev) => ({
      ...prev,
      aliases: (prev.aliases ?? []).filter((_, i) => i !== idx),
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Term" : "Propose New Term"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error ? (
            <div className="text-sm text-red-700">{error}</div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Canonical Label (English)</Label>
              <Input
                value={canonical}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, canonical_label_en: e.target.value }))
                }
                placeholder="e.g. Bundestag"
              />
            </div>
            {editing ? (
              <div className="space-y-1">
                <Label>Status</Label>
                <div className="h-9 w-full rounded-md border border-neutral-200 bg-neutral-50 px-2 text-sm text-neutral-700">
                  {(draft.status ?? "tentative") === "accepted"
                    ? "accepted"
                    : "tentative"}
                </div>
                <div className="text-[11px] text-neutral-500">
                  Acceptance is managed separately.
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-1">
            <Label>Definition (English)</Label>
            <Textarea
              value={definition}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, definition_en: e.target.value }))
              }
              placeholder="Operational definition used on Civic Lab."
              className="min-h-[90px]"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Aliases</Label>
              <Button variant="outline" size="sm" onClick={addAlias}>
                Add Alias
              </Button>
            </div>
            <div className="rounded-md border border-neutral-200">
              <div className="grid grid-cols-12 gap-2 border-b border-neutral-200 bg-neutral-50 px-3 py-2 text-[11px] font-semibold text-neutral-600">
                <div className="col-span-3">Lang</div>
                <div className="col-span-5">Text</div>
                <div className="col-span-3">Translit</div>
                <div className="col-span-1" />
              </div>
              <div className="space-y-2 p-3">
                {(draft.aliases ?? []).map((alias, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2">
                    <Input
                      value={alias.lang}
                      onChange={(e) => updateAlias(idx, { lang: e.target.value })}
                      className="col-span-3 h-9"
                      placeholder="en"
                    />
                    <Input
                      value={alias.text}
                      onChange={(e) => updateAlias(idx, { text: e.target.value })}
                      className="col-span-5 h-9"
                      placeholder="Bundestag"
                    />
                    <Input
                      value={alias.transliteration ?? ""}
                      onChange={(e) =>
                        updateAlias(idx, { transliteration: e.target.value || null })
                      }
                      className="col-span-3 h-9"
                      placeholder="optional"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="col-span-1 h-9"
                      onClick={() => removeAlias(idx)}
                      disabled={(draft.aliases ?? []).length <= 1}
                      title="Remove alias"
                    >
                      x
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-1">
            <Label>Notes (Optional)</Label>
            <Textarea
              value={draft.notes ?? ""}
              onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Extra context, edge cases, or usage notes."
              className="min-h-[70px]"
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
