import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Header } from "../components/header";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { ManualsMap } from "../components/manuals-map";
import { getCollections } from "../../api/client";
import type { CollectionRow } from "../../doc/types";
import { Search } from "lucide-react";

/**
 * Manuals Area entry — map + list/search of country Collections (CONCEPT §1.2).
 */
export function ManualsIndex() {
  const [collections, setCollections] = useState<CollectionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    getCollections({ kind: "manuals" })
      .then((rows) => {
        if (!cancelled) setCollections(rows);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!collections) return [];
    const q = query.trim().toLowerCase();
    if (!q) return collections;
    return collections.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.country_code && c.country_code.toLowerCase().includes(q)) ||
        (c.summary && c.summary.toLowerCase().includes(q)),
    );
  }, [collections, query]);

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />
      <main className="mx-auto max-w-[1200px] px-8 py-10">
        <div className="mb-8">
          <p className="mb-2 text-sm uppercase tracking-wider text-neutral-500">
            Country Manuals
          </p>
          <h1 className="mb-3 text-3xl font-bold text-neutral-900">Manuals</h1>
          <p className="mb-6 max-w-2xl text-neutral-600">
            One Collection per country. Pick from the map or search the list to
            open a Manual splash and its dossiers.
          </p>
        </div>

        {error && (
          <Card className="mb-8 border border-neutral-200 p-6 text-sm text-neutral-600">
            {error}
          </Card>
        )}

        {collections && collections.length > 0 && (
          <div className="mb-10">
            <ManualsMap collections={collections} />
          </div>
        )}

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-medium uppercase tracking-wider text-neutral-500">
              All manuals
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              List view mirrors the map — same Collections from the store.
            </p>
          </div>
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by country name or code…"
              className="h-10 border-neutral-200 pl-9"
            />
          </div>
        </div>

        {!error && collections === null && (
          <p className="text-sm text-neutral-500">Loading manuals…</p>
        )}
        {!error && collections && filtered.length === 0 && (
          <p className="text-sm text-neutral-500">No manuals match.</p>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((c) => (
            <Link
              key={c.collection_id}
              to={`/collection/${c.collection_id}`}
              className="block"
            >
              <Card className="border border-neutral-200 p-6 transition-all hover:border-neutral-300 hover:shadow-sm">
                <div className="mb-1 text-xs font-medium uppercase tracking-wider text-neutral-500">
                  {c.country_code || "—"}
                </div>
                <h2 className="mb-2 text-xl font-semibold text-neutral-900">
                  {c.title}
                </h2>
                {c.summary && (
                  <p className="text-sm text-neutral-600">{c.summary}</p>
                )}
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
