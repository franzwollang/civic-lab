import type { DossierRow } from "../../doc/types";

export type LaneLabel = "Descriptive" | "Prescriptive" | "Alignment";

/**
 * Prototype lane hint from tags / collection membership.
 * Real Manual lanes arrive with M6 immutability; this is display-only.
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
