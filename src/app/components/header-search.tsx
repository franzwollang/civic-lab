import {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useNavigate } from "react-router";
import { Search } from "lucide-react";
import { searchCorpus } from "../../api/client";
import type { SearchHit } from "../../doc/types";
import { Input } from "./ui/input";

const DEBOUNCE_MS = 200;
const RESULT_LIMIT = 12;

const KIND_LABEL: Record<SearchHit["kind"], string> = {
  dossier: "Dossier",
  artifact: "Artifact",
  thread: "Thread",
  claim: "Claim",
};

export function HeaderSearch() {
  const navigate = useNavigate();
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setHits([]);
      setError(null);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(() => {
      void searchCorpus({ q, limit: RESULT_LIMIT })
        .then((res) => {
          if (cancelled) return;
          startTransition(() => {
            setHits(res.hits);
            setActiveIndex(0);
            setError(null);
            setOpen(true);
          });
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : "Search failed");
          setHits([]);
          setOpen(true);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function goTo(hit: SearchHit) {
    setOpen(false);
    setQuery("");
    setHits([]);
    navigate(hit.href);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const hit = hits[activeIndex] ?? hits[0];
    if (hit) goTo(hit);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open || hits.length === 0) {
      if (e.key === "Escape") setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % hits.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + hits.length) % hits.length);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  const showPanel = open && query.trim().length > 0;

  return (
    <div ref={wrapRef} className="relative">
      <form onSubmit={onSubmit} role="search">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <Input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (query.trim()) setOpen(true);
          }}
          onKeyDown={onKeyDown}
          placeholder="Search dossiers, threads, artifacts..."
          className="h-9 w-96 border-neutral-200 pl-9 text-sm"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={showPanel}
          autoComplete="off"
        />
      </form>

      {showPanel && (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-50 max-h-80 overflow-auto rounded-md border border-neutral-200 bg-white shadow-md"
        >
          {searching || pending ? (
            <p className="px-3 py-2 text-sm text-neutral-500">Searching…</p>
          ) : error ? (
            <p className="px-3 py-2 text-sm text-red-600">{error}</p>
          ) : hits.length === 0 ? (
            <p className="px-3 py-2 text-sm text-neutral-500">
              No matches for “{query.trim()}”
            </p>
          ) : (
            <ul className="py-1">
              {hits.map((hit, index) => {
                const active = index === activeIndex;
                return (
                  <li key={`${hit.kind}:${hit.id}`} role="option" aria-selected={active}>
                    <button
                      type="button"
                      className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm ${
                        active ? "bg-neutral-100" : "hover:bg-neutral-50"
                      }`}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => goTo(hit)}
                    >
                      <span className="flex items-center gap-2">
                        <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                          {KIND_LABEL[hit.kind]}
                        </span>
                        <span className="truncate font-medium text-neutral-900">
                          {hit.title}
                        </span>
                      </span>
                      {hit.subtitle && (
                        <span className="truncate pl-[4.25rem] text-xs text-neutral-500">
                          {hit.subtitle}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
