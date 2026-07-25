import type { DossierRow } from "../../doc/types";
import { displayLaneLabel, type ManualLane } from "../../lib/artifactLanes";

export type LaneLabel = "Descriptive" | "Prescriptive" | "Alignment";

/**
 * Prefer the artifact's immutable Manual lane; fall back to dossier tags
 * only when the artifact has no lane (legacy / Canon).
 */
export function laneLabelForArtifact(
  lane: string | null | undefined,
): LaneLabel | null {
  const label = displayLaneLabel(lane as ManualLane | null);
  if (label === "Descriptive" || label === "Prescriptive" || label === "Alignment") {
    return label;
  }
  return null;
}

/**
 * Prototype dossier-level hint when artifact lane is unavailable.
 * Prefer `laneLabelForArtifact` for real Manual artifacts (M6).
 */
export function laneForDossier(d: DossierRow): LaneLabel {
  const tags = d.tags.map((t) => t.toLowerCase());
  if (tags.includes("alignment") || /alignment/i.test(d.title)) {
    return "Alignment";
  }
  if (d.country_code) {
    return "Prescriptive";
  }
  return "Descriptive";
}
