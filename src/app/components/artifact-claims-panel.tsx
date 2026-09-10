import { useEffect, useMemo, useState } from "react";
import { getArtifactClaims } from "../../api/client";
import type {
  ArtifactRow,
  ClaimRow,
  DossierRow,
  SectionRow,
} from "../../doc/types";
import { artifactIdOf } from "../../doc/types";
import {
  sectionIdFor,
  type SectionDraft,
} from "../../doc/sections";
import { buildClaimOwnerContext } from "../lib/claim-owner-context";
import { ClaimComposer } from "./claim-composer";
import { ClaimImplicationGraph } from "./claim-implication-graph";
import { ClaimListItem } from "./claim-list-item";
import { Card } from "./ui/card";

type ArtifactClaimsPanelProps = {
  artifact: ArtifactRow;
  dossier: DossierRow | null;
  /** Extracted heading drafts from the current revision (mapped to Section ids). */
  sections?: SectionDraft[];
};

function draftsToSectionRows(
  artifactId: string,
  drafts: SectionDraft[],
): SectionRow[] {
  return drafts.map((d) => ({
    section_id: sectionIdFor(artifactId, d.stable_key),
    artifact_id: artifactId,
    stable_key: d.stable_key,
    title: d.title,
    level: d.level,
    order: d.order,
  }));
}

export function ArtifactClaimsPanel({
  artifact,
  dossier,
  sections = [],
}: ArtifactClaimsPanelProps) {
  const artifactId = artifactIdOf(artifact);
  const ownerContext = useMemo(
    () => buildClaimOwnerContext(artifact, dossier),
    [artifact, dossier],
  );
  const sectionRows = useMemo(
    () => draftsToSectionRows(artifactId, sections),
    [artifactId, sections],
  );
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const rows = await getArtifactClaims(artifactId);
        if (!cancelled) setClaims(rows);
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Failed to load claims",
          );
          setClaims([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [artifactId]);

  return (
    <Card className="border border-neutral-200 p-6">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-700">
        Claims
      </h3>

      {loading && (
        <p className="mb-4 text-xs text-neutral-500">Loading claims…</p>
      )}
      {loadError && (
        <p className="mb-4 text-xs text-red-700" role="alert">
          {loadError}
        </p>
      )}
      {!loading && !loadError && claims.length === 0 && (
        <p className="mb-4 text-xs text-neutral-500">
          No claims on this artifact yet.
        </p>
      )}
      {!loading && claims.length > 0 && (
        <>
          <ClaimImplicationGraph claims={claims} />
          <div className="mb-4 space-y-3">
            {claims.map((c) => (
              <ClaimListItem key={c.claim_id} claim={c} />
            ))}
          </div>
        </>
      )}

      <div className="border-t border-neutral-100 pt-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-neutral-500">
          New claim
        </p>
        <ClaimComposer
          artifactId={artifactId}
          ownerContext={ownerContext}
          sections={sectionRows}
          enabled={!loading}
          onCreated={(claim) => setClaims((prev) => [claim, ...prev])}
        />
      </div>
    </Card>
  );
}
