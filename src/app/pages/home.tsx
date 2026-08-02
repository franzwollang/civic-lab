import { useEffect, useState } from "react";
import { Header } from "../components/header";
import { DossierCard, ThreadRow } from "../components/cards";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  ArrowRight,
  BookOpen,
  MapPin,
  Sparkles,
  MessageSquare,
  GitPullRequest,
  ShieldCheck,
  Target,
  Scale,
  ArrowUpRight,
} from "lucide-react";
import { Link } from "react-router";
import { formatDistanceToNow } from "date-fns";
import { getDossiers, getFindings, getThreads } from "../../api/client";
import type { DossierRow, FindingRow, ThreadRow as ThreadApiRow } from "../../doc/types";
import { laneForDossier } from "../lib/dossier-display";
import { getPrototypeUser } from "../lib/prototype-users";
import { HOME_EXEMPLARS } from "../../lib/homeExemplars";

const HOME_PANEL_LIMIT = 5;

const RFC_HOME_STATES = new Set(["rfc", "review", "decided"]);

function threadStatusLabel(
  state: string,
): "Open" | "RFC" | "Review" | "Decided" | "Merged" | "Parked" {
  switch (state) {
    case "rfc":
      return "RFC";
    case "review":
      return "Review";
    case "decided":
      return "Decided";
    case "archived":
      return "Parked";
    default:
      return "Open";
  }
}

function severityBorderClass(severity: string): string {
  switch (severity) {
    case "critical":
      return "border-l-red-500";
    case "high":
      return "border-l-orange-500";
    case "med":
      return "border-l-amber-500";
    default:
      return "border-l-neutral-400";
  }
}

function severityBadgeClass(severity: string): string {
  switch (severity) {
    case "critical":
      return "bg-red-50 text-red-700";
    case "high":
      return "bg-orange-50 text-orange-700";
    case "med":
      return "bg-amber-50 text-amber-700";
    default:
      return "bg-neutral-100 text-neutral-700";
  }
}

function findingStatusLabel(status: string): string {
  switch (status) {
    case "mitigated":
      return "Mitigated";
    case "accepted_risk":
      return "Accepted Risk";
    case "disputed":
      return "Disputed";
    default:
      return "Open";
  }
}

function findingHref(finding: FindingRow, threadsById: Map<string, ThreadApiRow>): string {
  const thread = threadsById.get(finding.thread_id);
  const base =
    thread && RFC_HOME_STATES.has(thread.state)
      ? `/thread/${finding.thread_id}/rfc`
      : `/thread/${finding.thread_id}`;
  return `${base}#finding-${finding.finding_id}`;
}

function formatActivity(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return iso;
  }
}

export function Home() {
  const [dossiers, setDossiers] = useState<DossierRow[] | null>(null);
  const [dossiersError, setDossiersError] = useState<string | null>(null);
  const [recentRfcs, setRecentRfcs] = useState<ThreadApiRow[] | null>(null);
  const [rfcsError, setRfcsError] = useState<string | null>(null);
  const [recentFindings, setRecentFindings] = useState<FindingRow[] | null>(
    null,
  );
  const [findingsError, setFindingsError] = useState<string | null>(null);
  const [threadsById, setThreadsById] = useState<Map<string, ThreadApiRow>>(
    () => new Map(),
  );

  useEffect(() => {
    let cancelled = false;
    getDossiers()
      .then((rows) => {
        if (!cancelled) setDossiers(rows);
      })
      .catch((err) => {
        if (!cancelled) {
          setDossiersError(
            err instanceof Error ? err.message : "Failed to load dossiers",
          );
        }
      });

    Promise.all([getThreads(), getFindings()])
      .then(([threads, findings]) => {
        if (cancelled) return;
        const byId = new Map(threads.map((t) => [t.thread_id, t]));
        setThreadsById(byId);
        setRecentRfcs(
          threads
            .filter((t) => RFC_HOME_STATES.has(t.state))
            .slice(0, HOME_PANEL_LIMIT),
        );
        setRecentFindings(findings.slice(0, HOME_PANEL_LIMIT));
        setRfcsError(null);
        setFindingsError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to load home panels";
        setRfcsError(message);
        setFindingsError(message);
        setRecentRfcs([]);
        setRecentFindings([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />

      <main className="mx-auto max-w-[1440px] px-8 py-12">
        <section className="mb-16">
          <div className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-gradient-to-br from-white via-neutral-50 to-neutral-100 p-10">
            <div className="absolute -right-28 -top-28 h-72 w-72 rounded-full bg-neutral-200/60 blur-3xl" />
            <div className="absolute -bottom-24 left-0 h-56 w-56 -translate-x-1/2 rounded-full bg-blue-100/50 blur-3xl" />
            <div className="relative grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-600">
                  <Sparkles className="h-3 w-3 text-neutral-700" />
                  Governance Engineering Lab
                </div>
                <h1 className="mb-4 text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl">
                  Civic Lab
                </h1>
                <p className="mb-4 text-lg text-neutral-700">
                  A governance engineering lab for living specs, adversarial
                  review, and transparent uncertainty.
                </p>
                <p className="text-sm text-neutral-600">
                  Civic Lab is a forum/wiki hybrid for building revisioned
                  knowledge bases about political systems, economic systems,
                  voting systems, cultural institutions, and the real-world
                  plans needed to move societies toward better outcomes.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button asChild size="lg">
                    <Link to="/canon">
                      Explore Canon
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <Link to="/manuals">Browse Manuals</Link>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="ghost"
                    className="text-neutral-700"
                  >
                    <Link to="/#what-is-this">What is this?</Link>
                  </Button>
                </div>
              </div>
              <div className="space-y-4">
                <Card className="border border-neutral-200 bg-white/90 p-6">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-900">
                    <Scale className="h-4 w-4" />
                    Not Neutral by Design
                  </div>
                  <p className="text-sm text-neutral-600">
                    Civic Lab has an explicit living Charter (Owner-gated Canon
                    artifact) and a clear editor-in-chief model. The trade: higher
                    signal, stronger standards, and an auditable trail of reasoning.
                  </p>
                </Card>
                <Card className="border border-neutral-200 bg-white/90 p-6">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-900">
                    <Target className="h-4 w-4" />
                    Standards and Uncertainty
                  </div>
                  <ul className="space-y-2 text-sm text-neutral-600">
                    <li>Assumptions are explicit.</li>
                    <li>Uncertainty is tracked, not hidden.</li>
                    <li>Claims are tied to evidence where possible.</li>
                  </ul>
                </Card>
                <Card className="border border-neutral-200 bg-white/90 p-6">
                  <div className="mb-3 text-sm font-semibold text-neutral-900">
                    How To Read This Site
                  </div>
                  <p className="text-sm text-neutral-600">
                    You’ll encounter math, CS, and other technical terms. They’re
                    optional precision tools: start with plain-language
                    summaries, and expand the formal layer when you want to audit
                    reasoning.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <Link
                      to="/faq#do-i-need-math"
                      className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-900 hover:text-neutral-700"
                    >
                      Read the FAQ
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                    <Link
                      to="/constitution"
                      className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-900 hover:text-neutral-700"
                    >
                      Read the Charter
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-16" id="what-is-this">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-neutral-900">
                What is this?
              </h2>
              <p className="mt-2 max-w-3xl text-sm text-neutral-600">
                Canon holds truth-first ideal specs. Country Manuals hold
                execution under realpolitik — with lane hygiene so Descriptive,
                Prescriptive, and Alignment stay separate. Threads are primary;
                RFCs promote change with RevSets. Scorable claims make forecasts
                and requirements auditable. Red Team files findings; Adjudicators
                resolve contested claims.
              </p>
            </div>
            <Link
              to="/about"
              className="shrink-0 text-sm font-medium text-neutral-600 hover:text-neutral-900"
            >
              Full About →
            </Link>
          </div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Tour live exemplars
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {HOME_EXEMPLARS.map((ex) => (
              <Link
                key={ex.id}
                to={ex.href}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-900 underline-offset-4 hover:underline"
              >
                {ex.label}
                <ArrowUpRight className="h-3.5 w-3.5 text-neutral-500" />
              </Link>
            ))}
          </div>
        </section>

        <section className="mb-16" id="two-channels">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-neutral-900">
                Two Channels
              </h2>
              <p className="mt-2 text-sm text-neutral-600">
                Ideals live in the Canon. Execution lives in Country Manuals.
              </p>
            </div>
            <Link
              to="/about#two-channels"
              className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
            >
              Learn more →
            </Link>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Link to="/canon">
              <Card className="group cursor-pointer border-2 border-neutral-900 bg-white p-8 transition-all hover:border-neutral-700 hover:shadow-lg">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-neutral-900">
                    <BookOpen className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-neutral-900">
                      Canon
                    </h2>
                    <Badge className="mt-1 bg-blue-50 text-blue-700">
                      Ideal
                    </Badge>
                  </div>
                </div>
                <p className="mb-4 text-neutral-600">
                  The spec: core principles, constraints, invariants, and
                  mechanisms—plus the tests, metrics, and failure modes that let
                  us argue about it rigorously.
                </p>
                <div className="flex items-center gap-2 text-sm font-medium text-neutral-900 group-hover:text-neutral-700">
                  <span>Explore Canon</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </Card>
            </Link>

            <Link to="/manuals">
              <Card className="group cursor-pointer border-2 border-neutral-900 bg-white p-8 transition-all hover:border-neutral-700 hover:shadow-lg">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-neutral-900">
                    <MapPin className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-neutral-900">
                      Country Manuals
                    </h2>
                    <Badge className="mt-1 bg-emerald-50 text-emerald-700">
                      Execution
                    </Badge>
                  </div>
                </div>
                <p className="mb-4 text-neutral-600">
                  Pragmatic field guides: current conditions, constraints,
                  incentives, and stepwise plans. Bluntly realistic, yet
                  intellectually honest.
                </p>
                <div className="flex items-center gap-2 text-sm font-medium text-neutral-900 group-hover:text-neutral-700">
                  <span>Browse Manuals</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </Card>
            </Link>
          </div>
        </section>

        <section className="mb-16" id="workflow">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-neutral-900">
                How Work Gets Done
              </h2>
              <p className="mt-2 text-sm text-neutral-600">
                Threads, RFCs, and Red Team review keep change control rigorous.
              </p>
            </div>
            <Link
              to="/about#workflow"
              className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
            >
              Process overview →
            </Link>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="border border-neutral-200 bg-white p-6">
              <MessageSquare className="mb-4 h-5 w-5 text-neutral-700" />
              <h3 className="mb-2 text-lg font-semibold text-neutral-900">
                Threads-first Collaboration
              </h3>
              <p className="text-sm text-neutral-600">
                Discussion happens in threads attached to dossiers, not scattered
                comment sections.
              </p>
            </Card>
            <Card className="border border-neutral-200 bg-white p-6">
              <GitPullRequest className="mb-4 h-5 w-5 text-neutral-700" />
              <h3 className="mb-2 text-lg font-semibold text-neutral-900">
                RFC Workflow
              </h3>
              <p className="text-sm text-neutral-600">
                Threads can be promoted to an RFC, bundling revisions, diffs, and
                review into an auditable path from proposal to merge.
              </p>
            </Card>
            <Card className="border border-neutral-200 bg-white p-6">
              <ShieldCheck className="mb-4 h-5 w-5 text-neutral-700" />
              <h3 className="mb-2 text-lg font-semibold text-neutral-900">
                Red Team Cases
              </h3>
              <p className="text-sm text-neutral-600">
                First-class dissent yields structured findings, mitigation
                discussions, and accepted-risk signoffs.
              </p>
            </Card>
          </div>
        </section>

        <section className="mb-16" id="get-involved">
          <Card className="border border-neutral-200 bg-white p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <Badge className="bg-neutral-100 text-neutral-700" variant="secondary">
                  Get Involved
                </Badge>
                <h3 className="mt-3 text-2xl font-semibold text-neutral-900">
                  Start with a dossier you care about
                </h3>
                <p className="mt-2 max-w-2xl text-sm text-neutral-600">
                  Open a thread with a concrete correction, a resolvable claim, a
                  structured objection, or a well-scoped RFC proposal.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <Link to="/about#get-involved">
                    Contribution Guide
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/about">What is Civic Lab?</Link>
                </Button>
              </div>
            </div>
          </Card>
        </section>

        <section className="mb-12">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-neutral-900">
                Trending Dossiers
              </h3>
              <p className="mt-1 text-sm text-neutral-600">
                Live from the corpus store (Area → Collection → Dossier).
              </p>
            </div>
            <Link
              to="/canon"
              className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
            >
              Browse Canon →
            </Link>
          </div>
          <div className="grid gap-4">
            {dossiersError && (
              <Card className="border border-neutral-200 p-6 text-sm text-neutral-600">
                {dossiersError}
              </Card>
            )}
            {!dossiersError && dossiers === null && (
              <p className="text-sm text-neutral-500">Loading dossiers…</p>
            )}
            {!dossiersError && dossiers && dossiers.length === 0 && (
              <p className="text-sm text-neutral-500">
                No dossiers seeded yet.
              </p>
            )}
            {dossiers?.map((d) => (
              <DossierCard
                key={d.dossier_id}
                id={d.dossier_id}
                title={d.title}
                description={d.summary || ""}
                lane={laneForDossier(d)}
                steward={d.collection_title || d.country_code || "Corpus"}
                lastUpdated="seed"
                artifactCount={d.artifact_count ?? 0}
                threadCount={0}
              />
            ))}
          </div>
        </section>

        <section className="mb-12">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-neutral-900">
                Recent RFCs
              </h3>
              <p className="mt-1 text-sm text-neutral-600">
                Live from store threads in RFC / review / decided.
              </p>
            </div>
            {recentRfcs && recentRfcs[0] && (
              <Link
                to={`/dossier/${recentRfcs[0].home_dossier_id}`}
                className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
              >
                Open exemplar dossier →
              </Link>
            )}
          </div>
          <Card className="border border-neutral-200 bg-white p-6">
            {rfcsError && (
              <p className="text-sm text-neutral-600">{rfcsError}</p>
            )}
            {!rfcsError && recentRfcs === null && (
              <p className="text-sm text-neutral-500">Loading RFCs…</p>
            )}
            {!rfcsError && recentRfcs && recentRfcs.length === 0 && (
              <p className="text-sm text-neutral-500">
                No RFC or decided threads seeded yet.
              </p>
            )}
            {!rfcsError && recentRfcs && recentRfcs.length > 0 && (
              <div className="divide-y divide-neutral-200">
                {recentRfcs.map((t) => {
                  const dossierTitle =
                    dossiers?.find((d) => d.dossier_id === t.home_dossier_id)
                      ?.title ?? t.home_dossier_id;
                  return (
                    <ThreadRow
                      key={t.thread_id}
                      id={t.thread_id}
                      title={t.title}
                      status={threadStatusLabel(t.state)}
                      author={dossierTitle}
                      messageCount={t.post_count ?? t.posts?.length ?? 0}
                      lastActivity={formatActivity(t.created_at)}
                      to={
                        t.state === "open"
                          ? `/thread/${t.thread_id}`
                          : `/thread/${t.thread_id}/rfc`
                      }
                    />
                  );
                })}
              </div>
            )}
          </Card>
        </section>

        <section>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-neutral-900">
                Recent Red Team Findings
              </h3>
              <p className="mt-1 text-sm text-neutral-600">
                Live from store Findings (thread-required context).
              </p>
            </div>
            {recentFindings && recentFindings[0] && (
              <Link
                to={findingHref(recentFindings[0], threadsById)}
                className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
              >
                Open latest finding →
              </Link>
            )}
          </div>
          {findingsError && (
            <Card className="border border-neutral-200 p-6 text-sm text-neutral-600">
              {findingsError}
            </Card>
          )}
          {!findingsError && recentFindings === null && (
            <p className="text-sm text-neutral-500">Loading findings…</p>
          )}
          {!findingsError && recentFindings && recentFindings.length === 0 && (
            <p className="text-sm text-neutral-500">
              No Red Team findings seeded yet.
            </p>
          )}
          {!findingsError && recentFindings && recentFindings.length > 0 && (
            <div className="grid gap-3">
              {recentFindings.map((f) => {
                const severityLabel =
                  f.severity.charAt(0).toUpperCase() + f.severity.slice(1);
                const dossierLabel =
                  f.home_dossier_title ??
                  f.home_dossier_id ??
                  getPrototypeUser(f.author_id)?.display_name ??
                  f.author_id;
                return (
                  <Link key={f.finding_id} to={findingHref(f, threadsById)}>
                    <div
                      className={`cursor-pointer rounded-lg border-l-4 ${severityBorderClass(f.severity)} border-t border-r border-b border-neutral-200 bg-white p-4 transition-all hover:shadow-sm`}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge className={severityBadgeClass(f.severity)}>
                            {severityLabel}
                          </Badge>
                          <Badge className="bg-orange-50 text-orange-700">
                            {findingStatusLabel(f.status)}
                          </Badge>
                        </div>
                        <span className="text-xs text-neutral-500">
                          {dossierLabel}
                        </span>
                      </div>
                      <h4 className="mb-1 font-semibold text-neutral-900">
                        {f.title}
                      </h4>
                      <p className="text-sm text-neutral-600">
                        {f.evidence ||
                          f.attack_path ||
                          "No evidence summary seeded."}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
