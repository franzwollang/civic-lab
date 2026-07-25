import type { ArtifactRow, DossierRow } from "../../doc/types";
import { artifactIdOf } from "../../doc/types";
import type { ClaimOwnerContext } from "../../lib/claimLegality";

/**
 * Derive CONCEPT §5 owner context from loaded artifact + dossier.
 * Manuals Area ⇒ non-null country_code on the Collection (joined onto dossier).
 */
export function buildClaimOwnerContext(
  artifact: ArtifactRow,
  dossier: DossierRow | null | undefined,
): ClaimOwnerContext {
  const area_kind =
    dossier?.country_code != null && dossier.country_code !== ""
      ? "manuals"
      : "canon";
  return {
    artifact_id: artifactIdOf(artifact),
    area_kind,
    lane: artifact.lane ?? null,
  };
}
