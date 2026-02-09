import { createContext, useContext } from "react";
import type { ReactNode } from "react";

export type CollapseContextValue = {
  collapsedHeaderIds: Set<string>;
  hiddenBlockIds: Set<string>;
  toggleCollapse: (id: string) => void;
  isCollapsed: (id: string) => boolean;
  isHidden: (id: string) => boolean;
};

const CollapseContext = createContext<CollapseContextValue | null>(null);

export function CollapseProvider({
  value,
  children,
}: {
  value: CollapseContextValue;
  children: ReactNode;
}) {
  return (
    <CollapseContext.Provider value={value}>
      {children}
    </CollapseContext.Provider>
  );
}

export function useCollapseContext() {
  return useContext(CollapseContext);
}

