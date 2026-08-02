import { ArrowRight, GitBranch } from "lucide-react";
import type { ClaimRow } from "../../doc/types";
import {
  buildImplicationGraph,
  scoreModelImplicationsById,
  type ImplicationGraphNode,
  type ModelImplicationScore,
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

function fmtScore(n: number | null, digits = 3): string {
  if (n === null || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

function ModelScoreSummary({ score }: { score: ModelImplicationScore }) {
  return (
    <div
      className="mt-2 rounded border border-emerald-200/80 bg-white/70 px-2 py-1.5 text-[11px] text-emerald-900"
      data-testid={`implication-score-${score.model_claim_id}`}
      data-scored-n={score.scored_n}
      data-public-board={score.public_board_eligible ? "1" : "0"}
    >
      <div className="font-semibold uppercase tracking-wider text-emerald-800/80">
        Implied forecast score (advisory)
      </div>
      <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[10px] text-emerald-900/90">
        <span>n={score.scored_n}</span>
        <span>Brier {fmtScore(score.mean_brier)}</span>
        <span>log {fmtScore(score.mean_log_score)}</span>
        <span>skill {fmtScore(score.mean_skill_vs_baseline)}</span>
        {score.open_n > 0 && <span>open {score.open_n}</span>}
        {score.missing_n > 0 && <span>missing {score.missing_n}</span>}
      </div>
      {!score.public_board_eligible && score.scored_n > 0 && (
        <p className="mt-0.5 text-[10px] text-emerald-800/70">
          Below public-board threshold (n≥20); advisory only.
        </p>
      )}
      {score.scored_n === 0 && (
        <p className="mt-0.5 text-[10px] text-emerald-800/70">
          No resolved implied forecasts yet.
        </p>
      )}
    </div>
  );
}

/**
 * Read-only artifact-scoped model→forecast implication DAG (CONCEPT §5.2).
 * Two-tier layout: models on the left, forecasts on the right.
 * Advisory score propagation: resolved implied forecasts → model Brier/log/skill.
 */
export function ClaimImplicationGraph({ claims }: Props) {
  const graph = buildImplicationGraph(claims);
  if (graph.edges.length === 0) return null;

  const scoresByModel = scoreModelImplicationsById(claims);
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
          Model → forecast (advisory score propagation from resolved forecasts)
        </span>
      </div>

      <div className="space-y-4">
        {models.map((model) => {
          const targetIds = targetsByModel.get(model.claim_id) ?? [];
          const modelScore = scoresByModel.get(model.claim_id);
          const contribById = new Map(
            (modelScore?.contributions ?? []).map((c) => [
              c.forecast_claim_id,
              c,
            ]),
          );
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
                {modelScore && <ModelScoreSummary score={modelScore} />}
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
                  const contrib = contribById.get(tid);
                  return (
                    <div
                      key={`${model.claim_id}-${tid}`}
                      className={`rounded-md border px-3 py-2 ${nodeTone(node)}`}
                      data-claim-id={node.claim_id}
                      data-role="forecast"
                      data-testid={`implication-forecast-${node.claim_id}`}
                      data-scored={contrib?.scored ? "1" : "0"}
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
                      {contrib?.scored && (
                        <p
                          className="mt-1 font-mono text-[10px] text-violet-900/80"
                          data-testid={`implication-contrib-${node.claim_id}`}
                        >
                          contrib Brier {fmtScore(contrib.brier)} · log{" "}
                          {fmtScore(contrib.log_score)} · skill{" "}
                          {fmtScore(contrib.skill_vs_baseline)}
                        </p>
                      )}
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
