import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  HelpCircle,
  XCircle,
} from "lucide-react";
import type { ClaimRow } from "../../doc/types";
import { Badge } from "./ui/badge";

function formatStatusLabel(status: string): string {
  switch (status) {
    case "resolved_true":
    case "resolved-true":
      return "Resolved: True";
    case "resolved_false":
    case "resolved-false":
      return "Resolved: False";
    case "source_conflict":
    case "source-conflict":
      return "Source Conflict";
    case "satisfied":
      return "Satisfied";
    case "unsatisfied":
      return "Unsatisfied";
    case "partial":
      return "Partial";
    case "ambiguous":
      return "Ambiguous";
    case "invalidated":
      return "Invalidated";
    case "withdrawn":
      return "Withdrawn";
    default:
      return status.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  }
}

function statusTone(status: string): string {
  switch (status) {
    case "resolved_true":
    case "resolved-true":
    case "satisfied":
      return "bg-green-50 text-green-700 border-green-300";
    case "resolved_false":
    case "resolved-false":
    case "unsatisfied":
      return "bg-red-50 text-red-700 border-red-300";
    case "ambiguous":
    case "partial":
      return "bg-amber-50 text-amber-700 border-amber-300";
    case "invalidated":
    case "withdrawn":
      return "bg-neutral-100 text-neutral-600 border-neutral-300";
    case "source_conflict":
    case "source-conflict":
      return "bg-orange-50 text-orange-700 border-orange-300";
    default:
      return "bg-neutral-50 text-neutral-600 border-neutral-300";
  }
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "resolved_true":
    case "resolved-true":
    case "satisfied":
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />;
    case "resolved_false":
    case "resolved-false":
    case "unsatisfied":
      return <XCircle className="h-3.5 w-3.5 text-red-600" />;
    case "ambiguous":
    case "partial":
      return <HelpCircle className="h-3.5 w-3.5 text-amber-600" />;
    case "source_conflict":
    case "source-conflict":
      return <AlertCircle className="h-3.5 w-3.5 text-orange-600" />;
    case "invalidated":
    case "withdrawn":
      return <XCircle className="h-3.5 w-3.5 text-neutral-400" />;
    default:
      return <div className="h-2 w-2 rounded-full bg-neutral-400" />;
  }
}

function profileBadgeClass(profile: string): string {
  return profile === "requirement"
    ? "bg-teal-50 text-teal-800 border-teal-200"
    : "bg-sky-50 text-sky-800 border-sky-200";
}

function empiricalBadgeClass(type: string | null): string {
  switch (type) {
    case "forecast":
      return "bg-violet-50 text-violet-700 border-violet-200";
    case "model":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    default:
      return "bg-blue-50 text-blue-700 border-blue-200";
  }
}

function shortDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString();
}

type ClaimListItemProps = {
  claim: ClaimRow;
  /** Optional artifact title when listing across a dossier. */
  artifactTitle?: string;
};

export function ClaimListItem({ claim, artifactTitle }: ClaimListItemProps) {
  const deadline = shortDate(claim.deadline);
  const asOf = shortDate(claim.as_of);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className={`border text-xs font-medium ${profileBadgeClass(claim.profile)}`}
        >
          {claim.profile}
        </Badge>
        {claim.profile === "empirical" && claim.empirical_type && (
          <Badge
            variant="outline"
            className={`border text-xs font-medium ${empiricalBadgeClass(claim.empirical_type)}`}
          >
            {claim.empirical_type}
          </Badge>
        )}
        {claim.scope && (
          <Badge
            variant="outline"
            className="border border-neutral-200 bg-neutral-50 text-xs font-medium text-neutral-700"
          >
            scope: {claim.scope}
          </Badge>
        )}
        <Badge
          variant="outline"
          className={`border text-xs font-medium ${statusTone(claim.status)}`}
        >
          <StatusIcon status={claim.status} />
          <span className="ml-1">{formatStatusLabel(claim.status)}</span>
        </Badge>
        {claim.adjudication_pending && (
          <Badge
            variant="outline"
            className="border border-amber-200 bg-amber-50 text-xs font-medium text-amber-800"
          >
            adjudication queued
          </Badge>
        )}
        <span className="text-xs text-neutral-500">{claim.claim_id}</span>
      </div>

      {artifactTitle && (
        <p className="mb-1 text-xs text-neutral-500">{artifactTitle}</p>
      )}

      <p className="mb-3 text-sm leading-relaxed text-neutral-900">
        {claim.text}
      </p>

      <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
        {claim.probability != null && (
          <span className="font-medium text-neutral-800">
            p = {(claim.probability * 100).toFixed(0)}%
          </span>
        )}
        {asOf && (
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            As of {asOf}
          </span>
        )}
        {deadline && (
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Deadline {deadline}
          </span>
        )}
        {claim.canon_citations.length > 0 && (
          <span>Cites: {claim.canon_citations.join(", ")}</span>
        )}
        {claim.author_id && <span>by {claim.author_id}</span>}
      </div>
    </div>
  );
}
