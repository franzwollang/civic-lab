import { Header } from "../components/header";
import { SidebarNav } from "../components/sidebar-nav";
import { LaneBadge, StatusBadge } from "../components/badges";
import { ArtifactCard } from "../components/cards";
import { Card } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { User, Clock, Tag } from "lucide-react";
import { useParams, Link } from "react-router";

export function DossierOverview() {
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
            <p className="mb-4 text-neutral-600">
              State-by-state procedures, legal requirements, and operational
              workflows for conducting elections in the United States.
            </p>
            <div className="flex items-center gap-6 text-sm text-neutral-600">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span>Steward: Mark Johnson</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>Updated 3 hours ago</span>
              </div>
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                <span className="rounded bg-neutral-100 px-2 py-0.5">elections</span>
                <span className="rounded bg-neutral-100 px-2 py-0.5">USA</span>
                <span className="rounded bg-neutral-100 px-2 py-0.5">procedures</span>
              </div>
            </div>
          </div>

          <div className="flex gap-8">
            {/* Main Content */}
            <div className="flex-1">
              <Tabs defaultValue="artifacts">
                <TabsList className="mb-6 bg-white">
                  <TabsTrigger value="artifacts">Artifacts</TabsTrigger>
                  <TabsTrigger value="threads">Threads</TabsTrigger>
                  <TabsTrigger value="rfcs">RFCs</TabsTrigger>
                  <TabsTrigger value="red-team">Red Team</TabsTrigger>
                  <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                </TabsList>

                <TabsContent value="artifacts">
                  <div className="space-y-6">
                    {/* Pinned Artifacts */}
                    <div>
                      <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-neutral-500">
                        Pinned
                      </h3>
                      <div className="space-y-2">
                        <ArtifactCard
                          id="overview"
                          dossierId={id || "1"}
                          title="Overview and Purpose"
                          description="High-level goals, scope, and intended audience for the US voting implementation guide."
                          isPinned
                          tags={["overview", "meta"]}
                        />
                        <ArtifactCard
                          id="voter-reg"
                          dossierId={id || "1"}
                          title="Voter Registration Procedures"
                          description="Step-by-step workflows for registering voters across all 50 states including ID requirements and deadlines."
                          isPinned
                          tags={["registration", "state-specific"]}
                        />
                      </div>
                    </div>

                    {/* All Artifacts */}
                    <div>
                      <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-neutral-500">
                        All Artifacts
                      </h3>
                      <div className="space-y-2">
                        <ArtifactCard
                          id="polling"
                          dossierId={id || "1"}
                          title="Polling Place Operations"
                          description="Opening procedures, voter check-in, ballot distribution, and closing protocols for election day."
                          tags={["operations", "election-day"]}
                        />
                        <ArtifactCard
                          id="provisional"
                          dossierId={id || "1"}
                          title="Provisional Ballot Handling"
                          description="When to issue provisional ballots, verification process, and counting procedures."
                          tags={["provisional", "ballots"]}
                        />
                        <ArtifactCard
                          id="absentee"
                          dossierId={id || "1"}
                          title="Absentee and Mail-In Voting"
                          description="Request process, signature verification, ballot tracking, and acceptance criteria."
                          tags={["absentee", "mail-in"]}
                        />
                        <ArtifactCard
                          id="early"
                          dossierId={id || "1"}
                          title="Early Voting Protocols"
                          description="Procedures for jurisdictions offering early in-person voting periods."
                          tags={["early-voting"]}
                        />
                        <ArtifactCard
                          id="security"
                          dossierId={id || "1"}
                          title="Chain of Custody & Security"
                          description="Physical security measures, transportation protocols, and audit procedures for ballots and equipment."
                          tags={["security", "audit"]}
                        />
                        <ArtifactCard
                          id="counting"
                          dossierId={id || "1"}
                          title="Vote Counting and Tabulation"
                          description="Central counting facility procedures, machine operation, and result certification."
                          tags={["counting", "results"]}
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="threads">
                  <Card className="border border-neutral-200 p-6">
                    <p className="text-center text-sm text-neutral-500">
                      Thread list view would appear here
                    </p>
                  </Card>
                </TabsContent>

                <TabsContent value="rfcs">
                  <Card className="border border-neutral-200 p-6">
                    <p className="text-center text-sm text-neutral-500">
                      RFC list view would appear here
                    </p>
                  </Card>
                </TabsContent>

                <TabsContent value="red-team">
                  <Card className="border border-neutral-200 p-6">
                    <p className="text-center text-sm text-neutral-500">
                      Red Team overview would appear here
                    </p>
                  </Card>
                </TabsContent>

                <TabsContent value="dashboard">
                  <Card className="border border-neutral-200 p-6">
                    <p className="mb-4 text-center text-sm text-neutral-500">
                      Dashboard metrics would appear here
                    </p>
                    <div className="text-center">
                      <Link to={`/dossier/${id}/dashboard`}>
                        <Button variant="default">View Full Dashboard</Button>
                      </Link>
                    </div>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>

            {/* Sidebar */}
            <aside className="w-80">
              <div className="space-y-6">
                {/* Key Metrics */}
                <Card className="border border-neutral-200 p-6">
                  <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-700">
                    Key Metrics
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <div className="mb-1 text-2xl font-bold text-neutral-900">
                        24
                      </div>
                      <div className="text-sm text-neutral-600">
                        Total Artifacts
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 text-2xl font-bold text-neutral-900">
                        15
                      </div>
                      <div className="text-sm text-neutral-600">
                        Active Threads
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 text-2xl font-bold text-neutral-900">
                        92%
                      </div>
                      <div className="text-sm text-neutral-600">
                        Claims Resolved
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <div className="h-2 w-24 rounded-full bg-neutral-200">
                          <div className="h-2 w-20 rounded-full bg-green-500" />
                        </div>
                        <span className="text-sm font-medium text-neutral-700">
                          83%
                        </span>
                      </div>
                      <div className="text-sm text-neutral-600">
                        Calibration Score
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Active RFCs */}
                <Card className="border border-neutral-200 p-6">
                  <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-700">
                    Active RFCs
                  </h3>
                  <div className="space-y-3">
                    <div className="border-l-2 border-amber-500 pl-3">
                      <div className="mb-1 flex items-center gap-2">
                        <StatusBadge status="RFC" />
                      </div>
                      <h4 className="text-sm font-medium text-neutral-900">
                        Update voter ID requirements
                      </h4>
                      <p className="text-xs text-neutral-500">2 revisions</p>
                    </div>
                    <div className="border-l-2 border-orange-500 pl-3">
                      <div className="mb-1 flex items-center gap-2">
                        <StatusBadge status="Review" />
                      </div>
                      <h4 className="text-sm font-medium text-neutral-900">
                        Add digital signature verification
                      </h4>
                      <p className="text-xs text-neutral-500">In review</p>
                    </div>
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
