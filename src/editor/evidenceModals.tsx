import type { ReactNode } from "react";
import { createContext, useContext } from "react";

type OpenAttributionSearchOptions = {
  seed?: string;
  onSelect: (id: string) => void;
};

export type EvidenceModalApi = {
  openAttributionSearch: (options: OpenAttributionSearchOptions) => void;
};

const EvidenceModalContext = createContext<EvidenceModalApi | null>(null);

export function EvidenceModalProvider({
  value,
  children,
}: {
  value: EvidenceModalApi;
  children: ReactNode;
}) {
  return (
    <EvidenceModalContext.Provider value={value}>
      {children}
    </EvidenceModalContext.Provider>
  );
}

export function useEvidenceModals(): EvidenceModalApi | null {
  return useContext(EvidenceModalContext);
}
