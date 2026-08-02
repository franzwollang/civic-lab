import { ArrowRight, GitBranch } from "lucide-react";
import type { ClaimRow } from "../../doc/types";
import {
  buildImplicationGraph,
  type ImplicationGraphNode,
} from "../../lib/claimImplications";
import { Badge } from "./ui/badge";

type Props = {
  claims: ClaimRow[];
};

function truncate(text: string, max = 96): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function nodeTone(node: ImplicationGraphNode): string {
  if (!node.present) {
    return "border-dashed border-neutral-300 bg-neutral-50 text-neutral-500";
  }
  if (node.role === "model") {
    return "border-emerald-200 bg-emerald-50/80 text-emerald-950";
  }
  return "border-violet-200 bg-violet-50/70 text-violet-950";
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

/**
 * Read-only artifact-scoped model→forecast implication DAG (CONCEPT §5.2).
 * Two-tier layout: models on the left, forecasts on the right.
 * Does not propagate scores — display only.
 */
export function ClaimImplicationGraph({ claims }: Props) {
  const graph = buildImplicationGraph(claims);
  if (graph.edges.length === 0) return null;

  const models = graph.nodes.filter((n) => n.role === "model");
  const forecasts = graph.nodes.filter((n) => n.role === "forecast");
  const targetsByModel = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const list = targetsByModel.get(edge.from) ?? [];
    list.push(edge.to);
    targetsByModel.set(edge.from, list);
  }
  const forecastById = new Map(forecasts.map((n) => [n.claim_id, n]));

  return (
    <div
      className="mb-4 rounded-lg border border-emerald-100 bg-gradient-to-br from-emerald-50/40 via-white to-violet-50/30 p-4"
      data-testid="claim-implication-graph"
      aria-label="Model to forecast implication graph"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-900">
          <GitBranch className="h-3.5 w-3.5" />
          Implication graph
        </span>
        <Badge
          variant="outline"
          className="border-emerald-200 bg-white font-mono text-[10px] text-emerald-800"
        >
          {graph.edges.length} edge{graph.edges.length === 1 ? "" : "s"}
        </Badge>
        <span className="text-[11px] text-neutral-500">
          Model → forecast (read-only; scoring propagation deferred)
        </span>
      </div>

      <div className="space-y-4">
        {models.map((model) => {
          const targetIds = targetsByModel.get(model.claim_id) ?? [];
          return (
            <div
              key={model.claim_id}
              className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.2fr)] lg:items-stretch"
              data-testid={`implication-model-${model.claim_id}`}
            >
              <div
                className={`rounded-md border px-3 py-2 ${nodeTone(model)}`}
                data-claim-id={model.claim_id}
                data-role="model"
              >
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className="border-emerald-300 bg-white text-[10px] text-emerald-800"
                  >
                    model
                  </Badge>
                  <span className="font-mono text-[10px] text-emerald-800/80">
                    {model.claim_id}
                  </span>
                  <span className="text-[10px] capitalize text-emerald-800/70">
                    {statusLabel(model.status)}
                  </span>
                </div>
                <p className="text-sm leading-snug">{truncate(model.text)}</p>
              </div>

              <div
                className="hidden items-center justify-center text-emerald-700 lg:flex"
                aria-hidden
              >
                <ArrowRight className="h-4 w-4" />
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-800 lg:hidden">
                  Implies forecasts
                </p>
                {targetIds.map((tid) => {
                  const node = forecastById.get(tid);
                  if (!node) return null;
                  return (
                    <div
                      key={`${model.claim_id}-${tid}`}
                      className={`rounded-md border px-3 py-2 ${nodeTone(node)}`}
                      data-claim-id={node.claim_id}
                      data-role="forecast"
                      data-testid={`implication-forecast-${node.claim_id}`}
                    >
                      <div className="mb-1 flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className="border-violet-300 bg-white text-[10px] text-violet-800"
                        >
                          forecast
                        </Badge>
                        <span className="font-mono text-[10px] opacity-80">
                          {node.claim_id}
                        </span>
                        <span className="text-[10px] capitalize opacity-70">
                          {statusLabel(node.status)}
                        </span>
                        {node.probability != null && (
                          <span className="font-mono text-[10px] opacity-80">
                            p={node.probability.toFixed(2)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm leading-snug">
                        {truncate(node.text)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
