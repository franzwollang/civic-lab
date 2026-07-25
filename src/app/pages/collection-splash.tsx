import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { Header } from "../components/header";
import { DossierCard } from "../components/cards";
import { Card } from "../components/ui/card";
import { getCollection, getDossiers } from "../../api/client";
import type { CollectionRow, DossierRow } from "../../doc/types";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; collection: CollectionRow; dossiers: DossierRow[] };

/**
 * Shared Collection splash/dashboard chrome (CONCEPT §11 / M4).
 * Used for Canon singleton and each country Manual.
 */
export function CollectionSplash({
  collectionId: collectionIdProp,
}: {
  collectionId?: string;
}) {
  const { collectionId: paramId } = useParams();
  const collectionId = collectionIdProp || paramId || "";
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!collectionId) {
        setState({ status: "error", message: "Missing collection id" });
        return;
      }
      try {
        const [collection, dossiers] = await Promise.all([
          getCollection(collectionId),
          getDossiers({ collectionId }),
        ]);
        if (!cancelled) {
          setState({ status: "ready", collection, dossiers });
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            status: "error",
            message: err instanceof Error ? err.message : "Failed to load",
          });
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [collectionId]);

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />
      <main className="mx-auto max-w-[1200px] px-8 py-10">
        {state.status === "loading" && (
          <p className="text-sm text-neutral-500">Loading collection…</p>
        )}
        {state.status === "error" && (
          <Card className="border border-neutral-200 p-6">
            <h1 className="mb-2 text-xl font-semibold text-neutral-900">
              Collection not found
            </h1>
            <p className="text-sm text-neutral-600">{state.message}</p>
            <Link
              to="/"
              className="mt-4 inline-block text-sm text-neutral-900 underline"
            >
              Back home
            </Link>
          </Card>
        )}
        {state.status === "ready" && (
          <>
            <div className="mb-8">
              <p className="mb-2 text-sm uppercase tracking-wider text-neutral-500">
                {state.collection.country_code
                  ? `Manual · ${state.collection.country_code}`
                  : "Canon Collection"}
              </p>
              <h1 className="mb-3 text-3xl font-bold text-neutral-900">
                {state.collection.title}
              </h1>
              {state.collection.summary && (
                <p className="max-w-2xl text-neutral-600">
                  {state.collection.summary}
                </p>
              )}
            </div>

            <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-neutral-500">
              Dossiers
            </h2>
            {state.dossiers.length === 0 ? (
              <p className="text-sm text-neutral-500">
                No dossiers in this collection yet.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {state.dossiers.map((d) => (
                  <DossierCard
                    key={d.dossier_id}
                    id={d.dossier_id}
                    title={d.title}
                    description={d.summary || ""}
                    lane={
                      state.collection.country_code
                        ? "Prescriptive"
                        : "Descriptive"
                    }
                    steward="—"
                    lastUpdated="seed"
                    artifactCount={0}
                    threadCount={0}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

/** Canon Area entry → singleton Collection splash. */
export function CanonIndex() {
  return <CollectionSplash collectionId="collection-canon" />;
}
