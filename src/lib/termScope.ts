import type { TermScope } from "../doc/evidence";

/** Default term scope from editor context (product dossier vs isolated /test/editor). */
export function resolveDefaultTermScope(opts: {
  dossierId?: string | null;
  countryCode?: string | null;
}): TermScope {
  if (opts.dossierId) {
    return { kind: "dossier", ref: opts.dossierId };
  }
  if (opts.countryCode) {
    return { kind: "country", ref: opts.countryCode };
  }
  return { kind: "global" };
}

export function formatTermScope(scope: TermScope): string {
  if (scope.kind === "global") return "global";
  return `${scope.kind}:${scope.ref}`;
}
