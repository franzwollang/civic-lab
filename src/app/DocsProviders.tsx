import { ReactNode } from "react";
import { RootProvider as FumadocsRootProvider } from "fumadocs-ui/provider/react-router";

export function DocsProviders({ children }: { children: ReactNode }) {
  return (
    <FumadocsRootProvider
      theme={{
        enabled: true,
      }}
      search={{
        enabled: false,
      }}
    >
      {children}
    </FumadocsRootProvider>
  );
}
