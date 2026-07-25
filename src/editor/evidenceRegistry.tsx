import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { getAttributions, getTerms } from "@/api/client";
import type { AttributionRegistry, TermRegistry } from "@/doc/evidence";

export type EvidenceRegistryState = {
  attributions: AttributionRegistry;
  terms: TermRegistry;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

const emptyAttributions: AttributionRegistry = { version: 1, items: [] };
const emptyTerms: TermRegistry = { version: 1, items: [] };

const EvidenceRegistryContext = createContext<EvidenceRegistryState | null>(null);

export function EvidenceRegistryProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [attributions, setAttributions] = useState<AttributionRegistry>(emptyAttributions);
  const [terms, setTerms] = useState<TermRegistry>(emptyTerms);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextAttributions, nextTerms] = await Promise.all([
        getAttributions(),
        getTerms(),
      ]);
      setAttributions(nextAttributions);
      setTerms(nextTerms);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load registries");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const value = useMemo(
    () => ({
      attributions,
      terms,
      loading,
      error,
      reload: load,
    }),
    [attributions, terms, loading, error, load],
  );

  return (
    <EvidenceRegistryContext.Provider value={value}>
      {children}
    </EvidenceRegistryContext.Provider>
  );
}

export function useEvidenceRegistry(): EvidenceRegistryState {
  const ctx = useContext(EvidenceRegistryContext);
  if (!ctx) {
    return {
      attributions: emptyAttributions,
      terms: emptyTerms,
      loading: false,
      error: null,
      reload: () => {},
    };
  }
  return ctx;
}
