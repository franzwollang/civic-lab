/**
 * CONCEPT Appendix D — `external_artifact` provider whitelist + immutability.
 * Reuses the same snapshot patterns as attribution `immutable_ref`
 * (`src/lib/immutableRef.ts`) but validates split provider / general_id /
 * specific_id fields on the Plate node.
 */

export const EXTERNAL_ARTIFACT_PROVIDERS = [
  "github",
  "zenodo",
  "arxiv",
  "osf",
] as const;

export type ExternalArtifactProvider =
  (typeof EXTERNAL_ARTIFACT_PROVIDERS)[number];

export type ExternalArtifactFields = {
  provider?: string | null;
  general_id?: string | null;
  specific_id?: string | null;
  display_title?: string | null;
  summary?: string | null;
  license?: string | null;
};

export type NormalizedExternalArtifact = {
  provider: ExternalArtifactProvider;
  general_id: string;
  specific_id: string;
  display_title: string;
  summary: string;
  license: string;
};

export type ExternalArtifactValidation =
  | { ok: true; normalized: NormalizedExternalArtifact }
  | { ok: false; message: string; field?: keyof NormalizedExternalArtifact };

const GITHUB_GENERAL_RE =
  /^(?:github:)?([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/;
const GITHUB_SHA_RE = /^[0-9a-f]{40}$/i;

const DOI_RE = /^(?:doi:)?(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)$/i;

const ARXIV_GENERAL_RE = /^(?:arxiv:)?(\d{4}\.\d{4,5})$/i;
const ARXIV_VERSION_RE = /^v\d+$/i;

const OSF_GENERAL_RE = /^(?:osf:)?([a-z0-9]{5,})$/i;
const OSF_VERSION_RE = /^v\d+$/i;

export function isExternalArtifactProvider(
  value: string,
): value is ExternalArtifactProvider {
  return (EXTERNAL_ARTIFACT_PROVIDERS as readonly string[]).includes(value);
}

function trim(value: string | null | undefined): string {
  return (value ?? "").trim();
}

/**
 * Normalize + validate App D fields. Empty required fields fail so callers
 * can distinguish "incomplete draft" vs "invalid snapshot".
 */
export function validateExternalArtifact(
  fields: ExternalArtifactFields,
): ExternalArtifactValidation {
  const providerRaw = trim(fields.provider).toLowerCase();
  const generalRaw = trim(fields.general_id);
  const specificRaw = trim(fields.specific_id);
  const title = trim(fields.display_title);
  const summary = trim(fields.summary);
  const license = trim(fields.license);

  if (!providerRaw) {
    return {
      ok: false,
      message: "External artifact requires a provider",
      field: "provider",
    };
  }
  if (!isExternalArtifactProvider(providerRaw)) {
    return {
      ok: false,
      message: `provider must be one of: ${EXTERNAL_ARTIFACT_PROVIDERS.join(", ")}`,
      field: "provider",
    };
  }
  if (!generalRaw) {
    return {
      ok: false,
      message: "External artifact requires general_id",
      field: "general_id",
    };
  }
  if (!specificRaw) {
    return {
      ok: false,
      message: "External artifact requires specific_id (immutable snapshot)",
      field: "specific_id",
    };
  }
  if (!title) {
    return {
      ok: false,
      message: "External artifact requires display_title",
      field: "display_title",
    };
  }

  let general_id = generalRaw;
  let specific_id = specificRaw;

  switch (providerRaw) {
    case "github": {
      const g = generalRaw.match(GITHUB_GENERAL_RE);
      if (!g) {
        return {
          ok: false,
          message: "github general_id must be owner/repo",
          field: "general_id",
        };
      }
      if (!GITHUB_SHA_RE.test(specificRaw)) {
        return {
          ok: false,
          message: "github specific_id must be a 40-char commit SHA",
          field: "specific_id",
        };
      }
      general_id = `github:${g[1]}/${g[2]}`;
      specific_id = specificRaw.toLowerCase();
      break;
    }
    case "zenodo": {
      // Zenodo snapshots use DOI (+ version in the DOI path when present).
      const g = generalRaw.match(DOI_RE);
      const s = specificRaw.match(DOI_RE);
      if (!g) {
        return {
          ok: false,
          message: "zenodo general_id must be a DOI (10.xxxx/...)",
          field: "general_id",
        };
      }
      if (!s) {
        return {
          ok: false,
          message: "zenodo specific_id must be a versioned DOI",
          field: "specific_id",
        };
      }
      general_id = `doi:${g[1]}`;
      specific_id = `doi:${s[1]}`;
      break;
    }
    case "arxiv": {
      const g = generalRaw.match(ARXIV_GENERAL_RE);
      if (!g) {
        return {
          ok: false,
          message: "arxiv general_id must be YYYY.NNNNN",
          field: "general_id",
        };
      }
      if (!ARXIV_VERSION_RE.test(specificRaw)) {
        return {
          ok: false,
          message: "arxiv specific_id must be vN (e.g. v2)",
          field: "specific_id",
        };
      }
      general_id = `arxiv:${g[1]}`;
      specific_id = specificRaw.toLowerCase();
      break;
    }
    case "osf": {
      const g = generalRaw.match(OSF_GENERAL_RE);
      if (!g) {
        return {
          ok: false,
          message: "osf general_id must be an OSF id",
          field: "general_id",
        };
      }
      if (!OSF_VERSION_RE.test(specificRaw)) {
        return {
          ok: false,
          message: "osf specific_id must be vN (e.g. v1)",
          field: "specific_id",
        };
      }
      general_id = `osf:${g[1]!.toLowerCase()}`;
      specific_id = specificRaw.toLowerCase();
      break;
    }
  }

  return {
    ok: true,
    normalized: {
      provider: providerRaw,
      general_id,
      specific_id,
      display_title: title,
      summary,
      license,
    },
  };
}

/** True when every required field is blank (fresh insert / incomplete draft). */
export function isExternalArtifactEmpty(fields: ExternalArtifactFields): boolean {
  return (
    !trim(fields.provider) &&
    !trim(fields.general_id) &&
    !trim(fields.specific_id) &&
    !trim(fields.display_title)
  );
}

/**
 * Serialize to the plain-text fence used by void clipboard round-trip.
 *
 * ```external_artifact
 * provider: github
 * general_id: github:owner/repo
 * specific_id: <sha>
 * display_title: Title
 * summary: ...
 * license: ...
 * ```
 */
export function serializeExternalArtifactFence(
  fields: ExternalArtifactFields,
): string {
  const lines = [
    `provider: ${trim(fields.provider)}`,
    `general_id: ${trim(fields.general_id)}`,
    `specific_id: ${trim(fields.specific_id)}`,
    `display_title: ${trim(fields.display_title)}`,
  ];
  const summary = trim(fields.summary);
  const license = trim(fields.license);
  if (summary) lines.push(`summary: ${summary}`);
  if (license) lines.push(`license: ${license}`);
  return `\`\`\`external_artifact\n${lines.join("\n")}\n\`\`\``;
}

export function parseExternalArtifactFenceBody(
  body: string,
): ExternalArtifactFields | null {
  const fields: ExternalArtifactFields = {};
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  let sawKey = false;
  for (const line of lines) {
    const match = line.match(
      /^(provider|general_id|specific_id|display_title|summary|license)\s*:\s*(.*)$/i,
    );
    if (!match) continue;
    sawKey = true;
    const key = match[1]!.toLowerCase() as keyof ExternalArtifactFields;
    fields[key] = match[2] ?? "";
  }
  return sawKey ? fields : null;
}

export function formatExternalArtifactLabel(
  fields: ExternalArtifactFields,
): string {
  const title = trim(fields.display_title);
  const provider = trim(fields.provider);
  if (title && provider) return `${title} (${provider})`;
  if (title) return title;
  if (provider) return `External artifact (${provider})`;
  return "External artifact";
}
