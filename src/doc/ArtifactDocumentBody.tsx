import { useEffect, useMemo, useState } from "react";

import {
  getArtifactRevisions,
  resolveArtifactRef,
} from "@/api/client";
import {
  DocumentReader,
  type ReaderNode,
} from "@/doc/DocumentReader";
import { extractSectionsFromContent, type SectionDraft } from "@/doc/sections";
import type { ArtifactRevisionRow, ArtifactRow } from "@/doc/types";
import {
  EvidenceRegistryProvider,
  useEvidenceRegistry,
} from "@/editor/evidenceRegistry";

function ReaderBody({ content }: { content: ReaderNode[] }) {
  const { attributions, terms, loading, error } = useEvidenceRegistry();

  return (
    <>
      {loading && (
        <p className="mb-4 text-xs text-neutral-500">Loading registries…</p>
      )}
      {error && (
        <p className="mb-4 text-xs text-amber-700">
          Registries unavailable ({error}); citations/terms show ids only.
        </p>
      )}
      <DocumentReader
        value={content}
        attributions={attributions}
        terms={terms}
      />
    </>
  );
}

export type ArtifactDocumentLoad =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      artifact: ArtifactRow;
      revision: ArtifactRevisionRow;
      content: ReaderNode[];
      sections: SectionDraft[];
    };

/**
 * Load an artifact by id or slug and render its current/latest revision
 * via the shared DocumentReader (M3 content bridge).
 */
export function useArtifactDocument(ref: string | undefined): ArtifactDocumentLoad {
  const [state, setState] = useState<ArtifactDocumentLoad>({
    status: "loading",
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!ref) {
        setState({ status: "missing" });
        return;
      }
      setState({ status: "loading" });
      try {
        const artifact = await resolveArtifactRef(ref);
        if (!artifact) {
          if (!cancelled) setState({ status: "missing" });
          return;
        }
        const revisions = await getArtifactRevisions(artifact.page_id);
        const currentId = artifact.current_revision_id;
        const revision =
          revisions.find((r) => r.revision_id === currentId) ?? revisions[0];
        if (!revision) {
          if (!cancelled) setState({ status: "missing" });
          return;
        }
        const raw = revision.content_json;
        const content = Array.isArray(raw) ? (raw as ReaderNode[]) : [];
        const sections = extractSectionsFromContent(content);
        if (!cancelled) {
          setState({
            status: "ready",
            artifact,
            revision,
            content,
            sections,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            status: "error",
            message:
              err instanceof Error ? err.message : "Failed to load artifact",
          });
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [ref]);

  return state;
}

export function ArtifactDocumentBody({
  load,
  className,
}: {
  load: Extract<ArtifactDocumentLoad, { status: "ready" }>;
  className?: string;
}) {
  const content = useMemo(() => load.content, [load.content]);

  return (
    <div className={className}>
      <EvidenceRegistryProvider>
        <ReaderBody content={content} />
      </EvidenceRegistryProvider>
    </div>
  );
}
