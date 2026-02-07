import { Header } from "../components/header";
import { SidebarNav } from "../components/sidebar-nav";
import { LaneBadge } from "../components/badges";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  Info,
  TrendingUp,
  Target,
  CheckCircle2,
  AlertCircle,
  BarChart3,
} from "lucide-react";
import { useParams, Link } from "react-router";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip";

export function Dashboard() {
  const { id } = useParams();

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />
      <SidebarNav dossierId={id} currentPage="dossier" />

      <main className="ml-64 pt-16">
        <div className="mx-auto max-w-[1200px] px-8 py-8">
          {/* Dossier Header */}
          <div className="mb-8">
            <div className="mb-4 flex items-center gap-3">
              <LaneBadge lane="Prescriptive" />
              <span className="text-sm text-neutral-500">Dossier #{id}</span>
            </div>
            <h1 className="mb-3 text-3xl font-bold text-neutral-900">
              US Voting Implementation Guide
            </h1>
            <p className="text-neutral-600">Dashboard & Metrics</p>
          </div>

          <Tabs defaultValue="overview">
            <TabsList className="mb-6 bg-white">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="claim-quality">Claim Quality</TabsTrigger>
              <TabsTrigger value="forecast-accuracy">
                Forecast Accuracy
              </TabsTrigger>
              <TabsTrigger value="reputation">Reputation</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview">
              <div className="grid gap-6">
                {/* High-Level Stats */}
                <div className="grid grid-cols-4 gap-4">
                  <Card className="border border-neutral-200 p-6">
                    <div className="mb-2 text-3xl font-bold text-neutral-900">
                      24
                    </div>
                    <div className="text-sm text-neutral-600">
                      Total Artifacts
                    </div>
                  </Card>
                  <Card className="border border-neutral-200 p-6">
                    <div className="mb-2 text-3xl font-bold text-neutral-900">
                      156
                    </div>
                    <div className="text-sm text-neutral-600">Total Claims</div>
                  </Card>
                  <Card className="border border-neutral-200 p-6">
                    <div className="mb-2 text-3xl font-bold text-neutral-900">
                      15
                    </div>
                    <div className="text-sm text-neutral-600">Active RFCs</div>
                  </Card>
                  <Card className="border border-neutral-200 p-6">
                    <div className="mb-2 text-3xl font-bold text-neutral-900">
                      3
                    </div>
                    <div className="text-sm text-neutral-600">
                      Open Findings
                    </div>
                  </Card>
                </div>

                {/* Lane Distribution */}
                <Card className="border border-neutral-200 p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-neutral-900">
                      Artifact Lane Distribution
                    </h3>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-neutral-400" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-xs">
                            Manual artifacts must maintain lane hygiene: keep
                            Descriptive, Prescriptive, and Alignment separate.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <LaneBadge lane="Descriptive" />
                          <span className="text-sm text-neutral-600">
                            Intelligence & Forecasts
                          </span>
                        </div>
                        <span className="font-semibold text-neutral-900">
                          8 artifacts
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-neutral-200">
                        <div className="h-2 w-1/3 rounded-full bg-blue-500" />
                      </div>
                    </div>
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <LaneBadge lane="Prescriptive" />
                          <span className="text-sm text-neutral-600">
                            Strategy & Procedures
                          </span>
                        </div>
                        <span className="font-semibold text-neutral-900">
                          12 artifacts
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-neutral-200">
                        <div className="h-2 w-1/2 rounded-full bg-purple-500" />
                      </div>
                    </div>
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <LaneBadge lane="Alignment" />
                          <span className="text-sm text-neutral-600">
                            Migration Steps
                          </span>
                        </div>
                        <span className="font-semibold text-neutral-900">
                          4 artifacts
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-neutral-200">
                        <div className="h-2 w-[16.67%] rounded-full bg-green-500" />
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Recent Activity */}
                <Card className="border border-neutral-200 p-6">
                  <h3 className="mb-4 text-lg font-semibold text-neutral-900">
                    Recent Activity
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-start gap-3 border-l-2 border-green-500 pl-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
                      <div>
                        <div className="font-medium text-neutral-900">
                          RFC merged: Chain of custody procedures
                        </div>
                        <div className="text-neutral-500">2 hours ago</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 border-l-2 border-blue-500 pl-3">
                      <BarChart3 className="mt-0.5 h-4 w-4 text-blue-600" />
                      <div>
                        <div className="font-medium text-neutral-900">
                          Claim resolved: Pennsylvania mail ballot deadline
                        </div>
                        <div className="text-neutral-500">5 hours ago</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 border-l-2 border-orange-500 pl-3">
                      <AlertCircle className="mt-0.5 h-4 w-4 text-orange-600" />
                      <div>
                        <div className="font-medium text-neutral-900">
                          Red Team Finding: Voter ID ambiguity
                        </div>
                        <div className="text-neutral-500">1 day ago</div>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </TabsContent>

            {/* Claim Quality Tab */}
            <TabsContent value="claim-quality">
              <Card className="mb-6 border-l-4 border-l-blue-500 bg-blue-50 p-4">
                <div className="flex items-start gap-3">
                  <Info className="mt-0.5 h-5 w-5 text-blue-700" />
                  <div>
                    <h4 className="mb-1 font-semibold text-blue-900">
                      Claim Quality Metrics
                    </h4>
                    <p className="text-sm text-blue-800">
                      These metrics apply to <strong>Descriptive lane</strong>{" "}
                      artifacts only. They measure how well claims are
                      structured, cited, and resolved. Scores are advisory
                      signals and do not automatically confer permissions.
                    </p>
                  </div>
                </div>
              </Card>

              <div className="grid gap-6">
                <div className="grid grid-cols-2 gap-6">
                  <Card className="border border-neutral-200 p-6">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="font-semibold text-neutral-900">
                        Resolution Rate
                      </h3>
                      <Badge variant="secondary">Advisory</Badge>
                    </div>
                    <div className="mb-2 text-4xl font-bold text-neutral-900">
                      87%
                    </div>
                    <p className="mb-4 text-sm text-neutral-600">
                      136 of 156 claims resolved
                    </p>
                    <div className="h-2 w-full rounded-full bg-neutral-200">
                      <div className="h-2 w-[87%] rounded-full bg-green-500" />
                    </div>
                  </Card>

                  <Card className="border border-neutral-200 p-6">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="font-semibold text-neutral-900">
                        Invalidation Rate
                      </h3>
                      <Badge variant="secondary">Advisory</Badge>
                    </div>
                    <div className="mb-2 text-4xl font-bold text-neutral-900">
                      3%
                    </div>
                    <p className="mb-4 text-sm text-neutral-600">
                      5 of 156 claims invalidated (lower is better)
                    </p>
                    <div className="h-2 w-full rounded-full bg-neutral-200">
                      <div className="h-2 w-[3%] rounded-full bg-red-500" />
                    </div>
                  </Card>
                </div>

                <Card className="border border-neutral-200 p-6">
                  <h3 className="mb-4 font-semibold text-neutral-900">
                    Time to Resolution
                  </h3>
                  <div className="grid grid-cols-3 gap-6">
                    <div>
                      <div className="mb-1 text-sm text-neutral-600">Median</div>
                      <div className="text-2xl font-bold text-neutral-900">
                        14 days
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 text-sm text-neutral-600">Mean</div>
                      <div className="text-2xl font-bold text-neutral-900">
                        21 days
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 text-sm text-neutral-600">90th %ile</div>
                      <div className="text-2xl font-bold text-neutral-900">
                        45 days
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="border border-neutral-200 p-6">
                  <h3 className="mb-4 font-semibold text-neutral-900">
                    Citation Density
                  </h3>
                  <div className="mb-2 text-4xl font-bold text-neutral-900">
                    2.3 sources/claim
                  </div>
                  <p className="text-sm text-neutral-600">
                    Average number of sources cited per claim. Minimum
                    recommended: 2.0
                  </p>
                </Card>

                <Card className="border border-neutral-200 p-6">
                  <h3 className="mb-4 font-semibold text-neutral-900">
                    Claim Status Breakdown
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-600">Resolved (True)</span>
                      <span className="font-semibold text-green-600">
                        108 claims
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-600">Resolved (False)</span>
                      <span className="font-semibold text-red-600">
                        18 claims
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-600">Open</span>
                      <span className="font-semibold text-neutral-900">
                        20 claims
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-600">Source Conflict</span>
                      <span className="font-semibold text-orange-600">
                        5 claims
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-600">Ambiguous</span>
                      <span className="font-semibold text-amber-600">
                        3 claims
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-600">Invalidated</span>
                      <span className="font-semibold text-neutral-400">
                        2 claims
                      </span>
                    </div>
                  </div>
                </Card>
              </div>
            </TabsContent>

            {/* Forecast Accuracy Tab */}
            <TabsContent value="forecast-accuracy">
              <Card className="mb-6 border-l-4 border-l-purple-500 bg-purple-50 p-4">
                <div className="flex items-start gap-3">
                  <Target className="mt-0.5 h-5 w-5 text-purple-700" />
                  <div>
                    <h4 className="mb-1 font-semibold text-purple-900">
                      Forecast Accuracy Metrics
                    </h4>
                    <p className="text-sm text-purple-800">
                      These metrics apply only to{" "}
                      <strong>probabilistic forecasts</strong> within Descriptive
                      artifacts. Calculated post-resolution. Scores are advisory
                      signals and do not automatically confer permissions.
                    </p>
                  </div>
                </div>
              </Card>

              <div className="grid gap-6">
                <div className="grid grid-cols-2 gap-6">
                  <Card className="border border-neutral-200 p-6">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="font-semibold text-neutral-900">
                        Brier Score
                      </h3>
                      <Badge variant="secondary">Advisory</Badge>
                    </div>
                    <div className="mb-2 text-4xl font-bold text-neutral-900">
                      0.21
                    </div>
                    <p className="mb-4 text-sm text-neutral-600">
                      Lower is better (0 = perfect, 1 = worst)
                    </p>
                    <div className="text-sm text-green-600">
                      ▼ 0.03 improvement from last quarter
                    </div>
                  </Card>

                  <Card className="border border-neutral-200 p-6">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="font-semibold text-neutral-900">
                        Log Score
                      </h3>
                      <Badge variant="secondary">Advisory</Badge>
                    </div>
                    <div className="mb-2 text-4xl font-bold text-neutral-900">
                      -0.48
                    </div>
                    <p className="mb-4 text-sm text-neutral-600">
                      Higher is better (0 = perfect, -∞ = worst)
                    </p>
                    <div className="text-sm text-green-600">
                      ▲ 0.07 improvement from last quarter
                    </div>
                  </Card>
                </div>

                <Card className="border border-neutral-200 p-6">
                  <h3 className="mb-4 font-semibold text-neutral-900">
                    Calibration
                  </h3>
                  <div className="mb-4">
                    <Badge className="bg-green-100 text-green-700">
                      Well Calibrated
                    </Badge>
                  </div>
                  <p className="text-sm text-neutral-600">
                    When forecasters predict 70% probability, events occur close
                    to 70% of the time. This dossier shows good calibration
                    across confidence ranges.
                  </p>
                </Card>

                <Card className="border border-neutral-200 p-6">
                  <h3 className="mb-4 font-semibold text-neutral-900">
                    Sharpness
                  </h3>
                  <div className="mb-2 text-2xl font-bold text-neutral-900">
                    Moderate
                  </div>
                  <p className="text-sm text-neutral-600">
                    Measures confidence level (distance from 50%). Higher
                    sharpness indicates more decisive forecasts. This dossier
                    maintains moderate sharpness appropriate for electoral
                    forecasting.
                  </p>
                </Card>

                <Card className="border border-neutral-200 p-6">
                  <h3 className="mb-4 font-semibold text-neutral-900">
                    Skill vs Baseline
                  </h3>
                  <div className="mb-2 text-4xl font-bold text-green-600">
                    +14%
                  </div>
                  <p className="text-sm text-neutral-600">
                    Performance improvement compared to naive baseline (historical
                    base rates). Positive skill indicates forecasts add value
                    beyond simple trend extrapolation.
                  </p>
                </Card>

                <Card className="border border-neutral-200 p-6">
                  <h3 className="mb-4 font-semibold text-neutral-900">
                    Forecast Count by Status
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-600">
                        Resolved (Scorable)
                      </span>
                      <span className="font-semibold text-neutral-900">
                        42 forecasts
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-600">
                        Open (Pre-deadline)
                      </span>
                      <span className="font-semibold text-neutral-900">
                        18 forecasts
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-600">
                        Ambiguous (Unscoreable)
                      </span>
                      <span className="font-semibold text-amber-600">
                        3 forecasts
                      </span>
                    </div>
                  </div>
                </Card>
              </div>
            </TabsContent>

            {/* Reputation Tab */}
            <TabsContent value="reputation">
              <Card className="mb-6 border-l-4 border-l-neutral-500 bg-neutral-50 p-4">
                <div className="flex items-start gap-3">
                  <TrendingUp className="mt-0.5 h-5 w-5 text-neutral-700" />
                  <div>
                    <h4 className="mb-1 font-semibold text-neutral-900">
                      Reputation System
                    </h4>
                    <p className="text-sm text-neutral-700">
                      In non-scorable domains (Canon, Prescriptive, Alignment),
                      reputation is based on merged RFC contributions, peer
                      review outcomes, Red Team gates passed, and scoped
                      endorsements. All reputation is shown with provenance.
                    </p>
                  </div>
                </div>
              </Card>

              <div className="grid gap-6">
                <Card className="border border-neutral-200 p-6">
                  <h3 className="mb-4 text-lg font-semibold text-neutral-900">
                    Top Contributors (by merged RFCs)
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900 text-white">
                          <span className="text-sm font-semibold">MJ</span>
                        </div>
                        <div>
                          <div className="font-medium text-neutral-900">
                            Mark Johnson
                          </div>
                          <div className="text-sm text-neutral-500">
                            Dossier Steward
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-neutral-900">
                          23 RFCs merged
                        </div>
                        <div className="text-sm text-neutral-500">
                          8 high-impact
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-700 text-white">
                          <span className="text-sm font-semibold">AR</span>
                        </div>
                        <div>
                          <div className="font-medium text-neutral-900">
                            Alex Rivera
                          </div>
                          <div className="text-sm text-neutral-500">
                            Contributor
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-neutral-900">
                          18 RFCs merged
                        </div>
                        <div className="text-sm text-neutral-500">
                          5 high-impact
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-500 text-white">
                          <span className="text-sm font-semibold">JL</span>
                        </div>
                        <div>
                          <div className="font-medium text-neutral-900">
                            Jamie Lee
                          </div>
                          <div className="text-sm text-neutral-500">
                            Reviewer
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-neutral-900">
                          12 RFCs merged
                        </div>
                        <div className="text-sm text-neutral-500">
                          3 high-impact
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>

                <div className="grid grid-cols-2 gap-6">
                  <Card className="border border-neutral-200 p-6">
                    <h3 className="mb-4 font-semibold text-neutral-900">
                      Review Labor
                    </h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-600">
                          Red Team reviews completed
                        </span>
                        <span className="font-semibold text-neutral-900">14</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-600">
                          Adjudication assists
                        </span>
                        <span className="font-semibold text-neutral-900">8</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-600">
                          Findings mitigated
                        </span>
                        <span className="font-semibold text-neutral-900">11</span>
                      </div>
                    </div>
                  </Card>

                  <Card className="border border-neutral-200 p-6">
                    <h3 className="mb-4 font-semibold text-neutral-900">
                      Endorsements (Scoped)
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div>
                        <div className="mb-1 font-medium text-neutral-900">
                          Voting Systems (Canon)
                        </div>
                        <div className="text-neutral-600">
                          5 endorsements from domain experts
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 font-medium text-neutral-900">
                          US Election Law
                        </div>
                        <div className="text-neutral-600">
                          8 endorsements from legal reviewers
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
