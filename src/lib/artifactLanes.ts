/**
 * CONCEPT §4 — Manual artifact lanes (immutable after create).
 *
 * Manuals: exactly one of descriptive | prescriptive | alignment.
 * Canon: no Manual lane (null).
 * Cross-lane work is by links; a computed soft "composite"/"bridge" label
 * may apply when an artifact references other Manual lanes — never a hard type.
 */

export type ManualLane = "descriptive" | "prescriptive" | "alignment";

export type AreaKind = "canon" | "manuals";

export const MANUAL_LANES: readonly ManualLane[] = [
  "descriptive",
  "prescriptive",
  "alignment",
] as const;

export type SoftLaneLabel = ManualLane | "composite" | "bridge";

export type LaneRuleErrorCode =
  | "manual_requires_lane"
  | "canon_rejects_lane"
  | "unknown_lane"
  | "lane_immutable"
  | "missing_dossier"
  | "unknown_area";

export type LaneRuleError = {
  code: LaneRuleErrorCode;
  message: string;
};

export function isManualLane(value: unknown): value is ManualLane {
  return (
    typeof value === "string" &&
    (MANUAL_LANES as readonly string[]).includes(value)
  );
}

/** Title-case badge label for UI (`descriptive` → `Descriptive`). */
export function displayLaneLabel(
  lane: ManualLane | SoftLaneLabel | string | null | undefined,
): "Descriptive" | "Prescriptive" | "Alignment" | "Composite" | "Bridge" | null {
  if (!lane) return null;
  if (lane === "descriptive") return "Descriptive";
  if (lane === "prescriptive") return "Prescriptive";
  if (lane === "alignment") return "Alignment";
  if (lane === "composite") return "Composite";
  if (lane === "bridge") return "Bridge";
  return null;
}

/**
 * Validate lane at artifact create time given owning Area kind.
 * Manual → required valid lane; Canon → must be absent/null.
 */
export function validateLaneOnCreate(
  areaKind: AreaKind | string,
  lane: string | null | undefined,
): { ok: true; lane: ManualLane | null } | { ok: false; error: LaneRuleError } {
  if (areaKind === "manuals") {
    if (lane == null || lane === "") {
      return {
        ok: false,
        error: {
          code: "manual_requires_lane",
          message:
            "Manual artifacts require an immutable lane (descriptive | prescriptive | alignment) at create.",
        },
      };
    }
    if (!isManualLane(lane)) {
      return {
        ok: false,
        error: {
          code: "unknown_lane",
          message: `Unknown Manual lane "${lane}".`,
        },
      };
    }
    return { ok: true, lane };
  }

  if (areaKind === "canon") {
    if (lane != null && lane !== "") {
      return {
        ok: false,
        error: {
          code: "canon_rejects_lane",
          message: "Canon artifacts have no Manual lane; omit lane (or pass null).",
        },
      };
    }
    return { ok: true, lane: null };
  }

  return {
    ok: false,
    error: {
      code: "unknown_area",
      message: `Unknown Area kind "${areaKind}".`,
    },
  };
}

/**
 * Lanes are immutable after create. Any PATCH that includes `lane`
 * (even same value or null) is rejected.
 */
export function validateLaneOnPatch(opts: {
  /** True when the client sent a `lane` property (including null). */
  lanePresentInPatch: boolean;
}): { ok: true } | { ok: false; error: LaneRuleError } {
  if (opts.lanePresentInPatch) {
    return {
      ok: false,
      error: {
        code: "lane_immutable",
        message:
          "Artifact lane is immutable after create; cross-lane work uses links (soft composite/bridge label).",
      },
    };
  }
  return { ok: true };
}

/**
 * Soft label from primary lane + referenced Manual lanes (CONCEPT §4.1).
 * Returns `composite` when any referenced lane differs from primary.
 * Prefer `bridge` only when caller asks (`preferBridge`).
 */
export function computeSoftLaneLabel(
  primary: ManualLane | string | null | undefined,
  referencedLanes: ReadonlyArray<ManualLane | string | null | undefined>,
  opts?: { preferBridge?: boolean },
): SoftLaneLabel | null {
  if (!isManualLane(primary)) return null;
  const cross = referencedLanes.some(
    (l) => isManualLane(l) && l !== primary,
  );
  if (!cross) return primary;
  return opts?.preferBridge ? "bridge" : "composite";
}

/**
 * Extract candidate artifact ids from claim `links` JSON blobs.
 * Accepts string ids or objects with `artifact_id` / `page_id`.
 */
export function artifactIdsFromClaimLinks(links: unknown): string[] {
  if (!Array.isArray(links)) return [];
  const ids: string[] = [];
  for (const item of links) {
    if (typeof item === "string" && item.trim()) {
      ids.push(item.trim());
      continue;
    }
    if (item && typeof item === "object") {
      const rec = item as Record<string, unknown>;
      const id = rec.artifact_id ?? rec.page_id ?? rec.id;
      if (typeof id === "string" && id.trim()) ids.push(id.trim());
    }
  }
  return ids;
}
