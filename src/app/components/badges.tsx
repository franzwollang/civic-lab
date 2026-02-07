import { Badge } from "./ui/badge";

type LaneType = "Descriptive" | "Prescriptive" | "Alignment";
type StatusType = "Open" | "RFC" | "Review" | "Decided" | "Merged" | "Parked";
type SeverityType = "Low" | "Med" | "High" | "Critical";

interface LaneBadgeProps {
  lane: LaneType;
}

interface StatusBadgeProps {
  status: StatusType;
}

interface SeverityBadgeProps {
  severity: SeverityType;
}

export function LaneBadge({ lane }: LaneBadgeProps) {
  const colors = {
    Descriptive: "bg-blue-50 text-blue-700 border-blue-200",
    Prescriptive: "bg-purple-50 text-purple-700 border-purple-200",
    Alignment: "bg-green-50 text-green-700 border-green-200",
  };

  return (
    <Badge
      variant="outline"
      className={`border ${colors[lane]} text-xs font-medium`}
    >
      {lane}
    </Badge>
  );
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const colors = {
    Open: "bg-neutral-50 text-neutral-700 border-neutral-200",
    RFC: "bg-amber-50 text-amber-700 border-amber-200",
    Review: "bg-orange-50 text-orange-700 border-orange-200",
    Decided: "bg-green-50 text-green-700 border-green-200",
    Merged: "bg-green-50 text-green-700 border-green-200",
    Parked: "bg-neutral-100 text-neutral-600 border-neutral-300",
  };

  return (
    <Badge
      variant="outline"
      className={`border ${colors[status]} text-xs font-medium`}
    >
      {status}
    </Badge>
  );
}

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  const colors = {
    Low: "bg-neutral-100 text-neutral-700 border-neutral-300",
    Med: "bg-yellow-50 text-yellow-700 border-yellow-300",
    High: "bg-orange-50 text-orange-700 border-orange-300",
    Critical: "bg-red-50 text-red-700 border-red-300",
  };

  return (
    <Badge
      variant="outline"
      className={`border ${colors[severity]} text-xs font-semibold`}
    >
      {severity}
    </Badge>
  );
}
