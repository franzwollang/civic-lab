/**
 * CONCEPT §5 — Claim profile legality by owning artifact Area/lane.
 *
 * | Owning artifact       | Legal profiles                          |
 * | Manual Descriptive    | empirical                               |
 * | Manual Alignment      | requirement                             |
 * | Manual Prescriptive   | none (cite only)                        |
 * | Canon                 | empirical only (with scope)             |
 *
 * Anti-smuggle (§5.7): Force Manual if criteria/sources name a single state's
 * institutions, elections, parties, or agencies.
 */

export type ClaimProfile = "empirical" | "requirement";

export type ManualLane = "descriptive" | "prescriptive" | "alignment";

export type AreaKind = "canon" | "manuals";

export type EmpiricalType = "fact" | "forecast" | "model";

export type CanonScope = "global" | "regional";

export type ClaimOwnerContext = {
  artifact_id: string;
  area_kind: AreaKind | string;
  /** Null/undefined on Canon; required on Manuals. */
  lane: ManualLane | string | null | undefined;
};

export type ClaimLegalityErrorCode =
  | "illegal_profile"
  | "prescriptive_no_claims"
  | "canon_requires_scope"
  | "manual_rejects_scope"
  | "requirement_requires_canon_citations"
  | "empirical_requires_type"
  | "forecast_requires_probability"
  | "anti_smuggle_force_manual"
  | "unknown_lane"
  | "missing_lane";

export type ClaimLegalityError = {
  code: ClaimLegalityErrorCode;
  message: string;
};

/** Profiles legal for a given owner context (empty = none). */
export function legalProfilesForOwner(
  ctx: ClaimOwnerContext,
): ClaimProfile[] {
  if (ctx.area_kind === "canon") {
    return ["empirical"];
  }
  if (ctx.area_kind === "manuals") {
    const lane = ctx.lane;
    if (!lane) return [];
    if (lane === "descriptive") return ["empirical"];
    if (lane === "alignment") return ["requirement"];
    if (lane === "prescriptive") return [];
    return [];
  }
  return [];
}

export function isProfileLegalForOwner(
  ctx: ClaimOwnerContext,
  profile: ClaimProfile | string,
): boolean {
  return legalProfilesForOwner(ctx).includes(profile as ClaimProfile);
}

/**
 * Heuristic anti-smuggle (§5.7): single-state institutions/elections/parties/agencies.
 * Returns true when Canon empirical text should be forced to a Manual.
 */
export function looksLikeSingleStateSmuggle(text: string): boolean {
  const t = text.toLowerCase();
  // Explicit country / demonym + institutional cues.
  const stateActors =
    /\b(united states|u\.s\.a?\.?|american|canada|canadian|united kingdom|u\.k\.|british|england|germany|german|france|french|australia|australian|india|indian|japan|japanese|brazil|brazilian|mexico|mexican)\b/;
  const institutions =
    /\b(election|elections|electoral|congress|parliament|senate|house of representatives|fec|electoral college|supreme court|federal election|elections canada|bundestag|returning officer|secretary of state|political part(y|ies)|democratic party|republican party|labour party|tory|conservatives)\b/;
  const stateCodes =
    /\b(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming)\b/;

  if (stateActors.test(t) && institutions.test(t)) return true;
  if (stateCodes.test(t) && institutions.test(t)) return true;
  // Bare "US midterm elections" style without needing both matches separately.
  if (
    /\b(u\.s\.|us|usa|american)\b.{0,40}\b(election|elections|congress|fec|electoral)\b/.test(
      t,
    )
  ) {
    return true;
  }
  return false;
}

export type ClaimDraftInput = {
  profile: ClaimProfile | string;
  text: string;
  /** Empirical only. */
  empirical_type?: EmpiricalType | string | null;
  /** Canon empirical only. */
  scope?: CanonScope | string | null;
  region_code?: string | null;
  region_label?: string | null;
  /** Forecast scoring. */
  probability?: number | null;
  /** Requirement: Canon citations (artifact ids or attribution refs). */
  canon_citations?: string[] | null;
  resolution_criteria?: string | null;
  preferred_sources?: string[] | null;
};

/**
 * Validate profile + profile-specific fields against owner Area/lane.
 * Does not persist; pure check for create/update paths.
 */
export function validateClaimAgainstOwner(
  ctx: ClaimOwnerContext,
  draft: ClaimDraftInput,
): { ok: true } | { ok: false; error: ClaimLegalityError } {
  const profile = draft.profile;

  if (ctx.area_kind === "manuals" && !ctx.lane) {
    return {
      ok: false,
      error: {
        code: "missing_lane",
        message: "Manual artifact requires an immutable lane before claims",
      },
    };
  }

  if (
    ctx.area_kind === "manuals" &&
    ctx.lane &&
    !["descriptive", "prescriptive", "alignment"].includes(String(ctx.lane))
  ) {
    return {
      ok: false,
      error: {
        code: "unknown_lane",
        message: `Unknown Manual lane: ${ctx.lane}`,
      },
    };
  }

  if (ctx.area_kind === "manuals" && ctx.lane === "prescriptive") {
    return {
      ok: false,
      error: {
        code: "prescriptive_no_claims",
        message:
          "Manual Prescriptive artifacts cite claims but do not own claim rows",
      },
    };
  }

  if (!isProfileLegalForOwner(ctx, profile)) {
    return {
      ok: false,
      error: {
        code: "illegal_profile",
        message: `Profile "${profile}" is not legal for ${ctx.area_kind}${
          ctx.lane ? `/${ctx.lane}` : ""
        } (allowed: ${legalProfilesForOwner(ctx).join(", ") || "none"})`,
      },
    };
  }

  if (profile === "empirical") {
    if (!draft.empirical_type) {
      return {
        ok: false,
        error: {
          code: "empirical_requires_type",
          message: "Empirical claims require type: fact | forecast | model",
        },
      };
    }
    if (
      draft.empirical_type === "forecast" &&
      (draft.probability == null ||
        Number.isNaN(Number(draft.probability)) ||
        Number(draft.probability) < 0.01 ||
        Number(draft.probability) > 0.99)
    ) {
      return {
        ok: false,
        error: {
          code: "forecast_requires_probability",
          message: "Forecast claims require probability in [0.01, 0.99]",
        },
      };
    }
    if (ctx.area_kind === "canon") {
      if (draft.scope !== "global" && draft.scope !== "regional") {
        return {
          ok: false,
          error: {
            code: "canon_requires_scope",
            message: "Canon empirical claims require scope: global | regional",
          },
        };
      }
      const smuggleCorpus = [
        draft.text,
        draft.resolution_criteria ?? "",
        ...(draft.preferred_sources ?? []),
      ].join("\n");
      if (looksLikeSingleStateSmuggle(smuggleCorpus)) {
        return {
          ok: false,
          error: {
            code: "anti_smuggle_force_manual",
            message:
              "Canon anti-smuggle: single-state institutions/elections belong in a Manual",
          },
        };
      }
    } else if (draft.scope) {
      return {
        ok: false,
        error: {
          code: "manual_rejects_scope",
          message: "Manual empirical claims do not carry Canon scope",
        },
      };
    }
  }

  if (profile === "requirement") {
    const cites = draft.canon_citations ?? [];
    if (!Array.isArray(cites) || cites.length === 0) {
      return {
        ok: false,
        error: {
          code: "requirement_requires_canon_citations",
          message: "Requirement claims must cite at least one Canon artifact",
        },
      };
    }
  }

  return { ok: true };
}
