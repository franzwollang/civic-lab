import { Link } from "react-router";
import { Card } from "./ui/card";
import { LaneBadge, StatusBadge } from "./badges";
import { ChevronRight, User, Clock } from "lucide-react";

interface DossierCardProps {
  id: string;
  title: string;
  description: string;
  lane: "Descriptive" | "Prescriptive" | "Alignment";
  steward: string;
  lastUpdated: string;
  artifactCount: number;
  threadCount: number;
}

interface ArtifactCardProps {
  id: string;
  dossierId: string;
  title: string;
  description: string;
  isPinned?: boolean;
  tags: string[];
}

interface ThreadRowProps {
  id: string;
  title: string;
  status: "Open" | "RFC" | "Review" | "Decided";
  author: string;
  messageCount: number;
  lastActivity: string;
}

interface FindingCardProps {
  id: string;
  title: string;
  description: string;
  severity: "Low" | "Med" | "High" | "Critical";
  likelihood: string;
  status: "Open" | "Mitigated" | "Accepted Risk";
}

export function DossierCard({
  id,
  title,
  description,
  lane,
  steward,
  lastUpdated,
  artifactCount,
  threadCount,
}: DossierCardProps) {
  return (
    <Link to={`/dossier/${id}`}>
      <Card className="group cursor-pointer border border-neutral-200 p-6 transition-all hover:border-neutral-300 hover:shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="mb-2 flex items-center gap-2">
              <LaneBadge lane={lane} />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-neutral-900 group-hover:text-neutral-700">
              {title}
            </h3>
            <p className="mb-4 text-sm text-neutral-600">{description}</p>
            <div className="flex items-center gap-4 text-xs text-neutral-500">
              <div className="flex items-center gap-1">
                <User className="h-3 w-3" />
                <span>{steward}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{lastUpdated}</span>
              </div>
              <span>·</span>
              <span>{artifactCount} artifacts</span>
              <span>·</span>
              <span>{threadCount} threads</span>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-neutral-400 transition-transform group-hover:translate-x-1" />
        </div>
      </Card>
    </Link>
  );
}

export function ArtifactCard({
  id,
  dossierId,
  title,
  description,
  isPinned,
  tags,
}: ArtifactCardProps) {
  return (
    <Link to={`/dossier/${dossierId}/artifact/${id}`}>
      <div className="group cursor-pointer rounded-lg border border-neutral-200 p-4 transition-all hover:border-neutral-300 hover:bg-neutral-50">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="mb-1 flex items-center gap-2">
              {isPinned && (
                <span className="text-xs text-neutral-500">📌 Pinned</span>
              )}
            </div>
            <h4 className="mb-1 font-medium text-neutral-900 group-hover:text-neutral-700">
              {title}
            </h4>
            <p className="mb-2 text-sm text-neutral-600">{description}</p>
            <div className="flex flex-wrap gap-1">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-neutral-400 transition-transform group-hover:translate-x-1" />
        </div>
      </div>
    </Link>
  );
}

export function ThreadRow({
  id,
  title,
  status,
  author,
  messageCount,
  lastActivity,
}: ThreadRowProps) {
  return (
    <Link to={`/thread/${id}`}>
      <div className="group flex cursor-pointer items-center gap-4 border-b border-neutral-200 py-3 transition-colors hover:bg-neutral-50">
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2">
            <h4 className="font-medium text-neutral-900 group-hover:text-neutral-700">
              {title}
            </h4>
            <StatusBadge status={status} />
          </div>
          <div className="flex items-center gap-4 text-xs text-neutral-500">
            <span>{author}</span>
            <span>·</span>
            <span>{messageCount} messages</span>
            <span>·</span>
            <span>{lastActivity}</span>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-neutral-400 transition-transform group-hover:translate-x-1" />
      </div>
    </Link>
  );
}

export function FindingCard({
  id,
  title,
  description,
  severity,
  likelihood,
  status,
}: FindingCardProps) {
  const statusColors = {
    Open: "border-l-orange-500",
    Mitigated: "border-l-green-500",
    "Accepted Risk": "border-l-neutral-400",
  };

  return (
    <Card
      className={`border-l-4 ${statusColors[status]} border-t border-r border-b border-neutral-200 p-4`}
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
            {status}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-500">Likelihood: {likelihood}</span>
        </div>
      </div>
      <div className="mb-2 flex items-center gap-2">
        <h4 className="font-semibold text-neutral-900">{title}</h4>
      </div>
      <p className="mb-3 text-sm text-neutral-600">{description}</p>
      <div className="flex items-center gap-2">
        <span className="text-xs text-neutral-500">Severity:</span>
        <div className="flex items-center gap-1">
          {Array.from({ length: 4 }).map((_, i) => {
            const severityLevel = { Low: 1, Med: 2, High: 3, Critical: 4 }[
              severity
            ];
            return (
              <div
                key={i}
                className={`h-2 w-8 rounded-sm ${
                  i < severityLevel ? "bg-red-500" : "bg-neutral-200"
                }`}
              />
            );
          })}
        </div>
      </div>
    </Card>
  );
}
