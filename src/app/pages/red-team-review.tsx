import { Header } from "../components/header";
import { SidebarNav } from "../components/sidebar-nav";
import { FindingCard } from "../components/cards";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { SeverityBadge } from "../components/badges";
import { ToggleGroup, ToggleGroupItem } from "../components/ui/toggle-group";
import { Shield, AlertTriangle } from "lucide-react";
import { useParams, Link } from "react-router";
import { useState } from "react";

export function RedTeamReview() {
  const { dossierId, reviewId } = useParams();
  const [filter, setFilter] = useState("findings");

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />
      <SidebarNav dossierId={dossierId} currentPage="red-team" />

      <main className="ml-64 pt-16">
        <div className="mx-auto max-w-[1400px] px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                <Shield className="h-5 w-5 text-red-700" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-neutral-900">
                  Red Team Review
                </h1>
                <div className="text-sm text-neutral-500">
                  Review #{reviewId} ·{" "}
                  <Link
                    to={`/dossier/${dossierId}`}
                    className="hover:text-neutral-700"
                  >
                    US Voting Implementation Guide
                  </Link>
                </div>
              </div>
            </div>

            {/* Governance Notice */}
            <Card className="mb-6 border-l-4 border-l-red-600 bg-red-50 p-4">
              <div className="flex items-start gap-3">
                <Shield className="mt-0.5 h-5 w-5 text-red-700" />
                <div>
                  <h4 className="mb-1 font-semibold text-red-900">
                    Global Red Team Authority
                  </h4>
                  <p className="text-sm text-red-800">
                    Red Team is <strong>global and independent</strong>. Red Team findings cannot be overridden by country stewards. Only Red Team members can resolve findings through mitigation or acceptance. Adjudicators have separate authority over claim resolution.
                  </p>
                </div>
              </div>
            </Card>

            <p className="mb-6 text-neutral-600">
              Red Team reviews identify gaps, ambiguities, and vulnerabilities in
              dossier artifacts. Findings are categorized by severity and tracked
              through resolution.
            </p>

            {/* Filter Toggle */}
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-neutral-700">
                View:
              </span>
              <ToggleGroup
                type="single"
                value={filter}
                onValueChange={(value) => value && setFilter(value)}
                className="bg-white"
              >
                <ToggleGroupItem value="findings" className="text-sm">
                  Findings only
                </ToggleGroupItem>
                <ToggleGroupItem value="with-responses" className="text-sm">
                  Findings + responses
                </ToggleGroupItem>
                <ToggleGroupItem value="all" className="text-sm">
                  All discussion
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          <div className="flex gap-8">
            {/* Main Content */}
            <div className="flex-1 space-y-6">
              {/* Critical Finding */}
              <FindingCard
                id="RT-042"
                title="Chain of custody gap in provisional ballot handling"
                description="Section 4.2 of Provisional Ballot Handling artifact lacks explicit procedure for transferring provisional ballots between polling site and central counting facility. No specification of required personnel, documentation standards, or incident reporting for transport phase. This creates potential vulnerability in ballot security chain."
                severity="Critical"
                likelihood="High"
                status="Open"
              />

              {/* Detailed Finding View */}
              <Card className="border-l-4 border-l-orange-500 border-t border-r border-b border-neutral-200 p-6">
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100">
                      <AlertTriangle className="h-5 w-5 text-orange-700" />
                    </div>
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <Badge className="bg-orange-50 text-orange-700">
                          High
                        </Badge>
                        <Badge className="bg-orange-50 text-orange-700">
                          Open
                        </Badge>
                        <span className="text-sm text-neutral-500">
                          Finding #RT-043
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold text-neutral-900">
                        Ambiguous voter ID requirements for absentee voters
                      </h3>
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="mb-1 text-neutral-900">Likelihood: High</div>
                    <div className="text-neutral-500">Identified 2 days ago</div>
                  </div>
                </div>

                <div className="mb-4 space-y-3 text-sm text-neutral-700">
                  <p>
                    <strong>Location:</strong> Absentee and Mail-In Voting
                    artifact, Section 3.1 and Appendix B
                  </p>
                  <p>
                    <strong>Issue:</strong> Section 3.1 states that "acceptable
                    forms of identification include state-issued ID, driver's
                    license, or last 4 digits of SSN" but Appendix B lists
                    different requirements including passport and utility bills
                    which are not mentioned in 3.1.
                  </p>
                  <p>
                    <strong>Impact:</strong> Election officials in different
                    jurisdictions may apply inconsistent standards for accepting
                    or rejecting absentee ballots based on which part of the
                    artifact they reference. This could lead to eligible voters
                    having ballots rejected or ineligible voters having ballots
                    accepted.
                  </p>
                  <p>
                    <strong>Recommendation:</strong> Reconcile Section 3.1 and
                    Appendix B to provide a single, comprehensive list of
                    acceptable ID forms. Consider creating a state-by-state matrix
                    if requirements legitimately vary by jurisdiction.
                  </p>
                </div>

                <div className="mb-4 rounded-lg bg-neutral-50 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-neutral-600">
                      Related Threads
                    </span>
                  </div>
                  <div className="space-y-1">
                    <Link
                      to="/thread/thread-2"
                      className="block text-sm text-neutral-700 hover:text-neutral-900"
                    >
                      → Discussion: Voter ID standardization
                    </Link>
                  </div>
                </div>

                {filter !== "findings" && (
                  <div className="space-y-4 border-t border-neutral-200 pt-4">
                    <div className="text-sm font-medium text-neutral-700">
                      Responses (2)
                    </div>
                    <div className="space-y-3">
                      <div className="rounded-lg bg-neutral-50 p-4">
                        <div className="mb-2 flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-700 text-xs font-semibold text-white">
                            MJ
                          </div>
                          <div>
                            <div className="text-sm font-medium text-neutral-900">
                              Mark Johnson
                            </div>
                            <div className="text-xs text-neutral-500">
                              1 day ago
                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-neutral-700">
                          Good catch. Appendix B was added later and we didn't
                          properly reconcile it with 3.1. Will create an RFC to
                          fix this.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </Card>

              {/* Med Severity Finding */}
              <FindingCard
                id="RT-044"
                title="Incomplete audit trail for ballot spoilage"
                description="Polling Place Operations artifact describes how to handle spoiled ballots but doesn't specify logging requirements. Recommend adding explicit requirement to record voter ID, timestamp, and reason code in poll book."
                severity="Med"
                likelihood="Medium"
                status="Open"
              />

              {/* Low Severity Finding */}
              <Card className="border-l-4 border-l-neutral-400 border-t border-r border-b border-neutral-200 p-4">
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-neutral-100 text-neutral-700">Low</Badge>
                    <Badge className="bg-green-100 text-green-700">
                      Mitigated
                    </Badge>
                    <span className="text-xs text-neutral-500">
                      Finding #RT-045
                    </span>
                  </div>
                  <div className="text-xs text-neutral-500">
                    Likelihood: Low
                  </div>
                </div>
                <h4 className="mb-2 font-semibold text-neutral-900">
                  Typo in voter registration form reference
                </h4>
                <p className="mb-3 text-sm text-neutral-600">
                  Voter Registration Procedures references form "EAC-VR-2024" but
                  the correct current form is "EAC-VR-2025". Updated in revision
                  committed on Feb 2.
                </p>
                <div className="text-xs text-neutral-500">
                  Resolved by: Mark Johnson · 3 days ago
                </div>
              </Card>
            </div>

            {/* Candidate Findings Sidebar */}
            <aside className="w-80">
              <Card className="border-2 border-amber-500 bg-amber-50 p-6">
                <div className="mb-4 flex items-center gap-2">
                  <Shield className="h-5 w-5 text-amber-700" />
                  <h3 className="font-semibold text-amber-900">
                    Candidate Findings
                  </h3>
                </div>
                <div className="mb-4 rounded bg-amber-100 px-3 py-2 text-xs text-amber-800">
                  <strong>RT members only:</strong> These are flagged issues under
                  review. Not yet official findings.
                </div>

                <div className="space-y-4">
                  <div className="rounded-lg border border-amber-300 bg-white p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="border-amber-400 text-amber-700"
                      >
                        Candidate
                      </Badge>
                    </div>
                    <h4 className="mb-2 text-sm font-semibold text-neutral-900">
                      Unclear observer access rules
                    </h4>
                    <p className="mb-2 text-xs text-neutral-600">
                      Section 2.4 doesn't specify minimum distance observers must
                      maintain from ballot processing.
                    </p>
                    <div className="text-xs text-neutral-500">
                      Flagged by: Taylor Kim
                    </div>
                  </div>

                  <div className="rounded-lg border border-amber-300 bg-white p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="border-amber-400 text-amber-700"
                      >
                        Candidate
                      </Badge>
                    </div>
                    <h4 className="mb-2 text-sm font-semibold text-neutral-900">
                      Missing reference to accessibility standards
                    </h4>
                    <p className="mb-2 text-xs text-neutral-600">
                      Polling Place Operations should reference ADA compliance
                      requirements from Canon.
                    </p>
                    <div className="text-xs text-neutral-500">
                      Flagged by: Jamie Lee
                    </div>
                  </div>
                </div>

                <Button variant="outline" size="sm" className="mt-4 w-full">
                  Submit New Candidate
                </Button>
              </Card>

              {/* Summary Stats */}
              <Card className="mt-6 border border-neutral-200 p-6">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-700">
                  Review Summary
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-600">Critical</span>
                    <span className="font-semibold text-red-600">1 open</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-600">High</span>
                    <span className="font-semibold text-orange-600">1 open</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-600">Medium</span>
                    <span className="font-semibold text-yellow-600">1 open</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-600">Low</span>
                    <span className="text-green-600">1 mitigated</span>
                  </div>
                  <div className="border-t border-neutral-200 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-neutral-900">Total</span>
                      <span className="font-semibold text-neutral-900">
                        4 findings
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}