import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { User, Clock, FileText } from "lucide-react";

interface RevSetRowProps {
  version: number;
  author: string;
  timestamp: string;
  description: string;
  isCurrent?: boolean;
  onViewDiff?: () => void;
  onSetCurrent?: () => void;
}

export function RevSetRow({
  version,
  author,
  timestamp,
  description,
  isCurrent,
  onViewDiff,
  onSetCurrent,
}: RevSetRowProps) {
  return (
    <div className="flex items-center justify-between border-b border-neutral-200 p-4 last:border-b-0">
      <div className="flex items-center gap-4">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-lg font-semibold ${
            isCurrent
              ? "bg-green-100 text-green-700"
              : "bg-neutral-100 text-neutral-700"
          }`}
        >
          v{version}
        </div>
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="font-medium text-neutral-900">
              Revision {version}
            </span>
            {isCurrent && (
              <Badge className="bg-green-100 text-green-700">Current</Badge>
            )}
          </div>
          <div className="mb-1 text-sm text-neutral-600">{description}</div>
          <div className="flex items-center gap-3 text-xs text-neutral-500">
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span>{author}</span>
            </div>
            <span>·</span>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{timestamp}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onViewDiff}
          disabled={!onViewDiff}
        >
          <FileText className="mr-2 h-4 w-4" />
          View Diff
        </Button>
        {!isCurrent && (
          <Button
            variant="outline"
            size="sm"
            onClick={onSetCurrent}
            disabled={!onSetCurrent}
          >
            Set as Current
          </Button>
        )}
      </div>
    </div>
  );
}
