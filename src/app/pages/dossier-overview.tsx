import { useEffect, useState } from "react";
import { Header } from "../components/header";
import { SidebarNav } from "../components/sidebar-nav";
import { StatusBadge } from "../components/badges";
import { ArtifactCard } from "../components/cards";
import { Card } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { Tag } from "lucide-react";
import { useParams, Link } from "react-router";
import {
  getDossier,
  getDossierArtifacts,
} from "../../api/client";
import type { ArtifactRow, DossierRow } from "../../doc/types";
import { artifactIdOf } from "../../doc/types";

/** Static fixture artifacts for dossiers that still lack seeded bodies. */
const FIXTURE_ARTIFACTS: Record<
  string,
  Array<{
    id: string;
    title: string;
    description: string;
    tags: string[];
    pinned?: boolean;
  }>
> = {
  "us-voting-1": [
    {
      id: "overview",
      title: "Overview and Purpose",
      description:
        "High-level goals, scope, and intended audience for the US voting implementation guide.",
      tags: ["overview", "meta"],
      pinned: true,
    },
    {
      id: "voter-reg",
      title: "Voter Registration Procedures",
      description:
        "Step-by-step workflows for registering voters across all 50 states including ID requirements and deadlines.",
      tags: ["registration", "state-specific"],
      pinned: true,
    },
    {
      id: "polling",
      title: "Polling Place Operations",
      description:
        "Opening procedures, voter check-in, ballot distribution, and closing protocols for election day.",
      tags: ["operations", "election-day"],
    },
    {
      id: "provisional",
      title: "Provisional Ballot Handling",
      description:
        "When to issue provisional ballots, verification process, and counting procedures.",
      tags: ["provisional", "ballots"],
    },
  ],
};

type LoadState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      dossier: DossierRow;
      artifacts: ArtifactRow[];
    };

export function DossierOverview() {
  const { id } = useParams();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!id) {
        setState({ status: "missing" });
        return;
      }
      try {
        const [dossier, artifacts] = await Promise.all([
          getDossier(id),
          getDossierArtifacts(id),
        ]);
        if (!cancelled) {
          setState({ status: "ready", dossier, artifacts });
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "";
          if (message.includes("404") || /not found/i.test(message)) {
            setState({ status: "missing" });
          } else {
            setState({
              status: "error",
              message: message || "Failed to load dossier",
            });
          }
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const fixtures = (id && FIXTURE_ARTIFACTS[id]) || [];

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />
      <SidebarNav dossierId={id} currentPage="dossier" />

      <main className="ml-64 pt-16">
        <div className="mx-auto max-w-[1200px] px-8 py-8">
          {state.status === "loading" && (
            <p className="text-sm text-neutral-500">Loading dossier…</p>
          )}
          {state.status === "missing" && (
            <Card className="border border-neutral-200 p-6">
              <h1 className="mb-2 text-xl font-semibold">Dossier not found</h1>
              <p className="mb-4 text-sm text-neutral-600">
                No seeded dossier matches <code>{id}</code>.
              </p>
              <Link to="/canon" className="text-sm underline">
                Browse Canon
              </Link>
            </Card>
          )}
          {state.status === "error" && (
            <Card className="border border-neutral-200 p-6">
              <h1 className="mb-2 text-xl font-semibold">Error</h1>
              <p className="text-sm text-neutral-600">{state.message}</p>
            </Card>
          )}
          {state.status === "ready" && (
            <>
              <div className="mb-8">
                <div className="mb-4 flex items-center gap-3">
                  <Link
                    to={`/collection/${state.dossier.collection_id}`}
                    className="text-sm text-neutral-500 hover:text-neutral-800"
                  >
                    ↑ Collection
                  </Link>
                  <span className="text-sm text-neutral-500">
                    Dossier #{state.dossier.dossier_id}
                  </span>
                </div>
                <h1 className="mb-3 text-3xl font-bold text-neutral-900">
                  {state.dossier.title}
                </h1>
                {state.dossier.summary && (
                  <p className="mb-4 text-neutral-600">{state.dossier.summary}</p>
                )}
                {state.dossier.tags.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-neutral-600">
                    <Tag className="h-4 w-4" />
                    {state.dossier.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded bg-neutral-100 px-2 py-0.5"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-8">
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
                        {state.artifacts.length > 0 && (
                          <div>
                            <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-neutral-500">
                              Seeded artifacts
                            </h3>
                            <div className="space-y-2">
                              {state.artifacts.map((a) => (
                                <ArtifactCard
                                  key={artifactIdOf(a)}
                                  id={a.slug || artifactIdOf(a)}
                                  dossierId={id || ""}
                                  title={a.title}
                                  description={`Revisioned document · ${artifactIdOf(a)}`}
                                  tags={[a.slug]}
                                  isPinned
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {fixtures.length > 0 && (
                          <div>
                            <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-neutral-500">
                              Fixture artifacts (not yet seeded)
                            </h3>
                            <div className="space-y-2">
                              {fixtures.map((f) => (
                                <ArtifactCard
                                  key={f.id}
                                  id={f.id}
                                  dossierId={id || ""}
                                  title={f.title}
                                  description={f.description}
                                  tags={f.tags}
                                  isPinned={f.pinned}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {state.artifacts.length === 0 && fixtures.length === 0 && (
                          <Card className="border border-neutral-200 p-6">
                            <p className="text-sm text-neutral-500">
                              No artifacts linked to this dossier yet.
                            </p>
                          </Card>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="threads">
                      <Card className="border border-neutral-200 p-6">
                        <p className="text-center text-sm text-neutral-500">
                          Thread list arrives with M5.
                        </p>
                      </Card>
                    </TabsContent>

                    <TabsContent value="rfcs">
                      <Card className="border border-neutral-200 p-6">
                        <p className="text-center text-sm text-neutral-500">
                          RFC list arrives with M5.
                        </p>
                      </Card>
                    </TabsContent>

                    <TabsContent value="red-team">
                      <Card className="border border-neutral-200 p-6">
                        <p className="text-center text-sm text-neutral-500">
                          Red Team overview arrives with M7.
                        </p>
                      </Card>
                    </TabsContent>

                    <TabsContent value="dashboard">
                      <Card className="border border-neutral-200 p-6">
                        <div className="text-center">
                          <Link to={`/dossier/${id}/dashboard`}>
                            <Button variant="default">View Full Dashboard</Button>
                          </Link>
                        </div>
                      </Card>
                    </TabsContent>
                  </Tabs>
                </div>

                <aside className="w-80">
                  <Card className="border border-neutral-200 p-6">
                    <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-700">
                      Counts
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <div className="mb-1 text-2xl font-bold text-neutral-900">
                          {state.artifacts.length + fixtures.length}
                        </div>
                        <div className="text-sm text-neutral-600">
                          Artifacts (seeded + fixture)
                        </div>
                      </div>
                      <div className="border-l-2 border-amber-500 pl-3">
                        <div className="mb-1 flex items-center gap-2">
                          <StatusBadge status="RFC" />
                        </div>
                        <h4 className="text-sm font-medium text-neutral-900">
                          Threads / RFCs — M5
                        </h4>
                      </div>
                    </div>
                  </Card>
                </aside>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
