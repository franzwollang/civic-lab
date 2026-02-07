import { Badge } from "./ui/badge";
import { Calendar, AlertCircle, CheckCircle2, XCircle, HelpCircle } from "lucide-react";

type ClaimType = "fact" | "forecast" | "model";
type ClaimStatus = "open" | "resolved-true" | "resolved-false" | "ambiguous" | "invalidated" | "source-conflict";

interface ClaimRowProps {
  id: string;
  type: ClaimType;
  statement: string;
  confidence?: number; // For facts
  probability?: number; // For forecasts
  asOf?: string; // For facts
  deadline?: string; // For forecasts
  resolutionCriteria?: string;
  status: ClaimStatus;
  sources?: string[];
  onClick?: () => void;
}

const claimTypeLabels: Record<ClaimType, string> = {
  fact: "Fact",
  forecast: "Forecast",
  model: "Model",
};

const claimTypeColors: Record<ClaimType, string> = {
  fact: "bg-blue-50 text-blue-700 border-blue-200",
  forecast: "bg-purple-50 text-purple-700 border-purple-200",
  model: "bg-green-50 text-green-700 border-green-200",
};

export function ClaimRow({
  id,
  type,
  statement,
  confidence,
  probability,
  asOf,
  deadline,
  resolutionCriteria,
  status,
  sources,
  onClick,
}: ClaimRowProps) {
  const getStatusIcon = () => {
    switch (status) {
      case "resolved-true":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "resolved-false":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "ambiguous":
        return <HelpCircle className="h-4 w-4 text-amber-600" />;
      case "invalidated":
        return <XCircle className="h-4 w-4 text-neutral-400" />;
      case "source-conflict":
        return <AlertCircle className="h-4 w-4 text-orange-600" />;
      default:
        return <div className="h-2 w-2 rounded-full bg-neutral-400" />;
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case "resolved-true":
        return "Resolved: True";
      case "resolved-false":
        return "Resolved: False";
      case "ambiguous":
        return "Ambiguous";
      case "invalidated":
        return "Invalidated";
      case "source-conflict":
        return "Source Conflict";
      default:
        return "Open";
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case "resolved-true":
        return "bg-green-50 text-green-700 border-green-300";
      case "resolved-false":
        return "bg-red-50 text-red-700 border-red-300";
      case "ambiguous":
        return "bg-amber-50 text-amber-700 border-amber-300";
      case "invalidated":
        return "bg-neutral-100 text-neutral-600 border-neutral-300";
      case "source-conflict":
        return "bg-orange-50 text-orange-700 border-orange-300";
      default:
        return "bg-neutral-50 text-neutral-600 border-neutral-300";
    }
  };

  return (
    <div
      className={`rounded-lg border border-neutral-200 bg-white p-4 transition-all ${
        onClick ? "cursor-pointer hover:border-neutral-300 hover:shadow-sm" : ""
      }`}
      onClick={onClick}
    >
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`border ${claimTypeColors[type]} text-xs font-medium`}>
            {claimTypeLabels[type]}
          </Badge>
          <Badge variant="outline" className={`border ${getStatusColor()} text-xs font-medium`}>
            {getStatusIcon()}
            <span className="ml-1">{getStatusLabel()}</span>
          </Badge>
          <span className="text-xs text-neutral-500">#{id}</span>
        </div>
        <div className="text-right">
          {type === "fact" && confidence !== undefined && (
            <div className="text-sm font-medium text-neutral-900">
              {Math.round(confidence * 100)}% confidence
            </div>
          )}
          {type === "forecast" && probability !== undefined && (
            <div className="text-sm font-medium text-neutral-900">
              p = {(probability * 100).toFixed(0)}%
            </div>
          )}
        </div>
      </div>

      <div className="mb-3">
        <p className="text-sm leading-relaxed text-neutral-900">{statement}</p>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-500">
        {asOf && (
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>As of: {asOf}</span>
          </div>
        )}
        {deadline && (
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>Deadline: {deadline}</span>
          </div>
        )}
        {sources && sources.length > 0 && (
          <>
            <span>·</span>
            <span>{sources.length} source{sources.length !== 1 ? "s" : ""}</span>
          </>
        )}
        {resolutionCriteria && (
          <>
            <span>·</span>
            <span className="truncate">Resolution: {resolutionCriteria}</span>
          </>
        )}
      </div>
    </div>
  );
}
