import { Header } from "../components/header";
import { SidebarNav } from "../components/sidebar-nav";
import { ClaimRow } from "../components/claim-row";
import { LaneBadge } from "../components/badges";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import {
  Tag,
  ExternalLink,
  MessageSquare,
  GitBranch,
  Scale,
  Info,
} from "lucide-react";
import { useParams, Link } from "react-router";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip";

export function DescriptiveArtifact() {
  const { dossierId, artifactId } = useParams();

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />
      <SidebarNav dossierId={dossierId} currentPage="artifact" />

      <main className="ml-64 pt-16">
        <div className="mx-auto max-w-[1200px] px-8 py-8">
          <div className="flex gap-8">
            {/* Main Content */}
            <article className="flex-1">
              <div className="mb-6">
                <div className="mb-2 text-sm text-neutral-500">
                  <Link
                    to={`/dossier/${dossierId}`}
                    className="hover:text-neutral-700"
                  >
                    US Voting Implementation Guide
                  </Link>{" "}
                  / Artifact
                </div>
                <div className="mb-4 flex items-center gap-3">
                  <LaneBadge lane="Descriptive" />
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-neutral-400" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-xs">
                          <strong>Descriptive Lane:</strong> Contains intelligence,
                          resolvable claims, and probabilistic forecasts. Must be
                          fact-based and scorable.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <h1 className="mb-4 text-3xl font-bold text-neutral-900">
                  2024 Election Turnout Intelligence
                </h1>
                <p className="mb-4 text-neutral-600">
                  Intelligence gathering and forecasting for 2024 US federal
                  election turnout patterns, early voting trends, and demographic
                  participation rates.
                </p>
                <div className="flex items-center gap-4 text-sm text-neutral-600">
                  <span>Last updated: 1 day ago</span>
                  <span>·</span>
                  <span>Updated by Research Team</span>
                </div>
              </div>

              {/* Primary Actions */}
              <div className="mb-8 flex gap-3">
                <Link to="/thread/thread-1">
                  <Button variant="default" size="sm">
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Start Thread
                  </Button>
                </Link>
                <Button variant="outline" size="sm" disabled>
                  <GitBranch className="mr-2 h-4 w-4" />
                  Nominate for RFC
                </Button>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Scale className="mr-2 h-4 w-4" />
                        Request Adjudication
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">
                        Request adjudicator review for conflicting sources
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* Claim Quality Alert */}
              <Card className="mb-6 border-l-4 border-l-blue-500 bg-blue-50 p-4">
                <div className="flex items-start gap-3">
                  <Info className="mt-0.5 h-5 w-5 text-blue-700" />
                  <div>
                    <h4 className="mb-1 font-semibold text-blue-900">
                      Descriptive Artifact Requirements
                    </h4>
                    <p className="text-sm text-blue-800">
                      This artifact is in the <strong>Descriptive lane</strong>.
                      All claims must be timestamped, include confidence levels or
                      probabilities, specify resolution criteria, and cite
                      preferred sources. Claims are subject to adjudication if
                      sources conflict.
                    </p>
                  </div>
                </div>
              </Card>

              {/* Claims Section */}
              <div className="mb-8">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-semibold text-neutral-900">
                      Claims
                    </h2>
                    <Badge variant="secondary">12 total</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-neutral-600">
                    <span>10 resolved</span>
                    <span>·</span>
                    <span>1 source conflict</span>
                    <span>·</span>
                    <span>1 open</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <ClaimRow
                    id="C-2041"
                    type="fact"
                    statement="Early voting in Georgia for the 2024 general election began on October 15, 2024, and ended on November 1, 2024."
                    confidence={0.99}
                    asOf="Oct 10, 2024"
                    resolutionCriteria="GA Secretary of State official dates"
                    status="resolved-true"
                    sources={["ga.gov/elections", "AP News"]}
                  />

                  <ClaimRow
                    id="C-2042"
                    type="forecast"
                    statement="National voter turnout for the 2024 general election will exceed 66% of eligible voters."
                    probability={0.72}
                    deadline="Nov 20, 2024"
                    resolutionCriteria="US Elections Project final tally"
                    status="open"
                    sources={["Historical turnout models", "Gallup enthusiasm"]}
                  />

                  <ClaimRow
                    id="C-2043"
                    type="fact"
                    statement="As of September 2024, 23 states plus DC allow same-day voter registration."
                    confidence={0.95}
                    asOf="Sep 15, 2024"
                    resolutionCriteria="NCSL state policy database"
                    status="source-conflict"
                    sources={["NCSL.org", "Ballotpedia", "EAC report"]}
                  />

                  <ClaimRow
                    id="C-2044"
                    type="forecast"
                    statement="Mail-in ballots will comprise more than 30% of total ballots cast in the 2024 general election."
                    probability={0.58}
                    deadline="Nov 20, 2024"
                    resolutionCriteria="US Elections Project breakdown"
                    status="open"
                    sources={["2020 baseline data", "State policy changes"]}
                  />

                  <ClaimRow
                    id="C-2045"
                    type="model"
                    statement="If youth turnout (18-29) increases by 5 percentage points, Democratic margin in swing states improves by 1.2-1.8 points."
                    probability={0.68}
                    asOf="Oct 1, 2024"
                    resolutionCriteria="Exit poll validation post-election"
                    status="resolved-true"
                    sources={["Catalist model", "Pew youth cohort data"]}
                  />

                  <ClaimRow
                    id="C-2046"
                    type="fact"
                    statement="Pennsylvania requires mail ballots to be received by 8 PM on Election Day; postmark date does not extend deadline."
                    confidence={0.98}
                    asOf="Aug 20, 2024"
                    resolutionCriteria="PA election code statute"
                    status="resolved-true"
                    sources={["PA Act 77", "PA Dept of State guidance"]}
                  />
                </div>

                <div className="mt-4 text-center">
                  <Button variant="outline" size="sm">
                    View all 12 claims →
                  </Button>
                </div>
              </div>

              <Separator className="my-8" />

              {/* Linked Threads */}
              <div className="mb-8">
                <h3 className="mb-4 text-lg font-semibold text-neutral-900">
                  Linked Threads
                </h3>
                <Card className="border border-neutral-200 bg-white">
                  <div className="divide-y divide-neutral-200">
                    <Link
                      to="/thread/thread-5"
                      className="flex items-center justify-between p-4 transition-colors hover:bg-neutral-50"
                    >
                      <div>
                        <div className="mb-1 font-medium text-neutral-900">
                          Adjudication request: Same-day registration count
                          discrepancy
                        </div>
                        <div className="text-sm text-neutral-500">
                          References Claim #C-2043 · 8 messages · Active
                        </div>
                      </div>
                      <Badge className="bg-orange-50 text-orange-700">
                        Adjudication
                      </Badge>
                    </Link>
                    <Link
                      to="/thread/thread-6"
                      className="flex items-center justify-between p-4 transition-colors hover:bg-neutral-50"
                    >
                      <div>
                        <div className="mb-1 font-medium text-neutral-900">
                          Discussion: Youth turnout forecast methodology
                        </div>
                        <div className="text-sm text-neutral-500">
                          References Claim #C-2042 · 12 messages · Open
                        </div>
                      </div>
                      <Badge className="bg-neutral-50 text-neutral-700">Open</Badge>
                    </Link>
                  </div>
                </Card>
              </div>

              {/* Summary Stats */}
              <Card className="border border-neutral-200 bg-neutral-50 p-6">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-700">
                  Article Summary
                </h3>
                <div className="prose prose-sm prose-neutral max-w-none">
                  <p>
                    This intelligence artifact tracks verified facts and
                    forecasts related to 2024 US election turnout. Claims are
                    structured to enable scoring and adjudication. Resolution
                    deadlines align with official certification timelines.
                  </p>
                </div>
              </Card>
            </article>

            {/* Sidebar */}
            <aside className="w-80">
              <div className="space-y-6">
                {/* Metadata */}
                <Card className="border border-neutral-200 p-6">
                  <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-700">
                    Metadata
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <div className="mb-1 font-medium text-neutral-900">
                        Artifact ID
                      </div>
                      <div className="text-neutral-600">{artifactId}</div>
                    </div>
                    <div>
                      <div className="mb-1 font-medium text-neutral-900">Lane</div>
                      <LaneBadge lane="Descriptive" />
                    </div>
                    <div>
                      <div className="mb-1 font-medium text-neutral-900">
                        Dossier
                      </div>
                      <Link
                        to={`/dossier/${dossierId}`}
                        className="text-neutral-600 hover:text-neutral-900"
                      >
                        US Voting Implementation Guide
                      </Link>
                    </div>
                    <div>
                      <div className="mb-1 font-medium text-neutral-900">
                        Version
                      </div>
                      <div className="text-neutral-600">v1.4</div>
                    </div>
                    <div>
                      <div className="mb-1 font-medium text-neutral-900">Tags</div>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="secondary">intelligence</Badge>
                        <Badge variant="secondary">turnout</Badge>
                        <Badge variant="secondary">forecasts</Badge>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Claim Quality Metrics */}
                <Card className="border border-neutral-200 p-6">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-700">
                      Claim Quality Metrics
                    </h3>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-neutral-400" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-xs">
                            Advisory signals only. Do not imply automatic
                            permissions or access rights.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-neutral-600">Resolution Rate</span>
                        <span className="font-semibold text-neutral-900">83%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-neutral-200">
                        <div className="h-1.5 w-[83%] rounded-full bg-green-500" />
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-neutral-600">Invalidation Rate</span>
                        <span className="font-semibold text-neutral-900">2%</span>
                      </div>
                      <div className="text-xs text-neutral-500">Low is better</div>
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-neutral-600">
                          Avg Time to Resolution
                        </span>
                        <span className="font-semibold text-neutral-900">18d</span>
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-neutral-600">Citation Density</span>
                        <span className="font-semibold text-neutral-900">
                          2.1 per claim
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Forecast Accuracy Metrics */}
                <Card className="border border-neutral-200 p-6">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-700">
                      Forecast Accuracy
                    </h3>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-neutral-400" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-xs">
                            Applies only to probabilistic forecasts. Calculated
                            post-resolution.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-neutral-600">Brier Score</span>
                        <span className="font-semibold text-neutral-900">0.18</span>
                      </div>
                      <div className="text-xs text-neutral-500">Lower is better</div>
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-neutral-600">Calibration</span>
                        <span className="font-semibold text-green-600">Good</span>
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-neutral-600">Skill vs Baseline</span>
                        <span className="font-semibold text-neutral-900">+12%</span>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Related Artifacts */}
                <Card className="border border-neutral-200 p-6">
                  <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-700">
                    Related Artifacts
                  </h3>
                  <div className="space-y-3">
                    <Link
                      to={`/dossier/${dossierId}/artifact/voter-reg`}
                      className="block text-sm text-neutral-600 hover:text-neutral-900"
                    >
                      <div className="flex items-start gap-2">
                        <ExternalLink className="mt-0.5 h-3 w-3" />
                        <span>Voter Registration Procedures</span>
                      </div>
                    </Link>
                  </div>
                </Card>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
