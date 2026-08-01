/**
 * Fixture dossier dashboard retired — redirect to the Collection splash
 * (CONCEPT §11 live dashboard) for the dossier's collection.
 */
import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router";
import { Header } from "../components/header";
import { getDossier } from "../../api/client";

export function Dashboard() {
  const { id } = useParams();
  const [collectionId, setCollectionId] = useState<string | null | undefined>(
    undefined,
  );

  useEffect(() => {
    if (!id) {
      setCollectionId(null);
      return;
    }
    let cancelled = false;
    getDossier(id)
      .then((d) => {
        if (!cancelled) setCollectionId(d?.collection_id ?? null);
      })
      .catch(() => {
        if (!cancelled) setCollectionId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (collectionId === undefined) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <Header />
        <main className="mx-auto max-w-lg px-6 py-24 text-sm text-neutral-600">
          Loading dashboard…
        </main>
      </div>
    );
  }

  if (collectionId) {
    return <Navigate to={`/collection/${collectionId}`} replace />;
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />
      <main className="mx-auto max-w-lg px-6 py-24 text-sm text-neutral-700">
        <p className="mb-4">
          The old fixture dossier dashboard was retired. Open the Collection
          splash for live CONCEPT §11 panels.
        </p>
        {id ? (
          <Link
            className="text-neutral-900 underline"
            to={`/dossier/${id}`}
          >
            Back to dossier
          </Link>
        ) : null}
      </main>
    </div>
  );
}
