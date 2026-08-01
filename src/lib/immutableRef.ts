/**
 * CONCEPT Appendix E.1 + D.3 — optional attribution `immutable_ref` patterns.
 * Plate `external_artifact` nodes use `src/lib/externalArtifact.ts` (App D
 * provider + general_id + specific_id); this validates registry snapshot strings.
 */

export type ImmutableRefKind = "github_commit" | "doi" | "arxiv" | "osf" | "other";

export type ParsedImmutableRef = {
  kind: ImmutableRefKind;
  /** Normalized display / storage form */
  normalized: string;
  general_id?: string;
  specific_id?: string;
};

const GITHUB_COMMIT_RE =
  /^(?:github:)?(?:https?:\/\/github\.com\/)?([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:\/commit\/|@)([0-9a-f]{40})$/i;

const DOI_RE =
  /^(?:doi:)?(?:https?:\/\/(?:dx\.)?doi\.org\/)?(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)$/i;

const ARXIV_RE =
  /^(?:arxiv:)?(?:https?:\/\/arxiv\.org\/(?:abs|pdf)\/)?(\d{4}\.\d{4,5})(v\d+)$/i;

const OSF_RE =
  /^(?:osf:)?(?:https?:\/\/osf\.io\/)?([a-z0-9]{5,})(?:\/)?(?:\?.*version=(\d+)|\/v(\d+))?$/i;

export function parseImmutableRef(
  raw: string | null | undefined,
): ParsedImmutableRef | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;

  const gh = trimmed.match(GITHUB_COMMIT_RE);
  if (gh) {
    const owner = gh[1]!;
    const repo = gh[2]!;
    const sha = gh[3]!.toLowerCase();
    return {
      kind: "github_commit",
      normalized: `github:${owner}/${repo}@${sha}`,
      general_id: `github:${owner}/${repo}`,
      specific_id: sha,
    };
  }

  const doi = trimmed.match(DOI_RE);
  if (doi) {
    const id = doi[1]!;
    return {
      kind: "doi",
      normalized: `doi:${id}`,
      general_id: `doi:${id.replace(/\/v\d+$/i, "")}`,
      specific_id: id,
    };
  }

  const arxiv = trimmed.match(ARXIV_RE);
  if (arxiv) {
    const base = arxiv[1]!;
    const ver = arxiv[2]!.toLowerCase();
    return {
      kind: "arxiv",
      normalized: `arxiv:${base}${ver}`,
      general_id: `arxiv:${base}`,
      specific_id: ver,
    };
  }

  const osf = trimmed.match(OSF_RE);
  if (osf) {
    const id = osf[1]!.toLowerCase();
    const ver = osf[2] ?? osf[3];
    if (ver) {
      return {
        kind: "osf",
        normalized: `osf:${id}/v${ver}`,
        general_id: `osf:${id}`,
        specific_id: `v${ver}`,
      };
    }
    // Bare OSF id without version — accepted as other (mutable) hint only
    return {
      kind: "other",
      normalized: `osf:${id}`,
      general_id: `osf:${id}`,
    };
  }

  return {
    kind: "other",
    normalized: trimmed,
  };
}

export type ImmutableRefValidation =
  | { ok: true; parsed: ParsedImmutableRef | null }
  | { ok: false; message: string };

/**
 * Empty/null is always ok (optional field). Non-empty must parse to a
 * recognized snapshot kind (github_commit | doi | arxiv | osf-with-version).
 * Free-form "other" is rejected so the field stays an immutability signal.
 */
export function validateImmutableRef(
  raw: string | null | undefined,
): ImmutableRefValidation {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { ok: true, parsed: null };

  const parsed = parseImmutableRef(trimmed);
  if (!parsed) {
    return {
      ok: false,
      message:
        "immutable_ref must be a GitHub commit SHA, DOI, arXiv id+vN, or OSF id+version",
    };
  }
  if (parsed.kind === "other") {
    return {
      ok: false,
      message:
        "immutable_ref must be a GitHub commit SHA, DOI, arXiv id+vN, or OSF id+version (CONCEPT App D/E)",
    };
  }
  if (!parsed.specific_id) {
    return {
      ok: false,
      message: "immutable_ref requires an immutable specific_id (version/SHA)",
    };
  }
  return { ok: true, parsed };
}

export function formatImmutableRefLabel(
  raw: string | null | undefined,
): string | null {
  const result = validateImmutableRef(raw);
  if (!result.ok || !result.parsed) return null;
  return result.parsed.normalized;
}
