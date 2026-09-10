import { useEffect, useState } from "react";
import { Header } from "../components/header";
import { SidebarNav } from "../components/sidebar-nav";
import { StatusBadge } from "../components/badges";
import { ArtifactCard } from "../components/cards";
import { ClaimListItem } from "../components/claim-list-item";
import { Card } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { Tag } from "lucide-react";
import { useParams, Link } from "react-router";
import {
  getArtifactClaims,
  getDossier,
  getDossierArtifacts,
  getDossierThreads,
} from "../../api/client";
import type {
  ArtifactRow,
  ClaimRow,
  DossierRow,
  ThreadRow,
} from "../../doc/types";
import { artifactIdOf } from "../../doc/types";
import { ObjectBreadcrumbs } from "../components/object-breadcrumbs";
import {
  areaKindFromCollection,
  buildHierarchyCrumbs,
} from "../lib/object-nav";

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

type LoadState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      dossier: DossierRow;
      artifacts: ArtifactRow[];
      threads: ThreadRow[];
    };

type DossierClaimGroup = {
  artifact: ArtifactRow;
  claims: ClaimRow[];
};

export function DossierOverview() {
  const { id } = useParams();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [claimGroups, setClaimGroups] = useState<DossierClaimGroup[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [claimsError, setClaimsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!id) {
        setState({ status: "missing" });
        return;
      }
      try {
        const [dossier, artifacts, threads] = await Promise.all([
          getDossier(id),
          getDossierArtifacts(id),
          getDossierThreads(id),
        ]);
        if (!cancelled) {
          setState({ status: "ready", dossier, artifacts, threads });
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

  useEffect(() => {
    let cancelled = false;
    async function loadClaims() {
      if (state.status !== "ready") {
        setClaimGroups([]);
        return;
      }
      setClaimsLoading(true);
      setClaimsError(null);
      try {
        const groups = await Promise.all(
          state.artifacts.map(async (artifact) => {
            const claims = await getArtifactClaims(artifactIdOf(artifact));
            return { artifact, claims };
          }),
        );
        if (!cancelled) {
          setClaimGroups(groups.filter((g) => g.claims.length > 0));
        }
      } catch (err) {
        if (!cancelled) {
          setClaimsError(
            err instanceof Error ? err.message : "Failed to load claims",
          );
          setClaimGroups([]);
        }
      } finally {
        if (!cancelled) setClaimsLoading(false);
      }
    }
    void loadClaims();
    return () => {
      cancelled = true;
    };
  }, [state]);

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />
      <SidebarNav
        dossierId={id}
        collectionId={
          state.status === "ready" ? state.dossier.collection_id : undefined
        }
        currentPage="dossier"
      />

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
                <ObjectBreadcrumbs
                  crumbs={buildHierarchyCrumbs({
                    area_kind:
                      state.dossier.area_kind ??
                      areaKindFromCollection(state.dossier),
                    collection_id: state.dossier.collection_id,
                    collection_title:
                      state.dossier.collection_title ?? "Collection",
                    dossier_id: state.dossier.dossier_id,
                    dossier_title: state.dossier.title,
                  })}
                />
                <p className="mb-4 text-sm text-neutral-500">
                  Dossier #{state.dossier.dossier_id}
                </p>
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
                      <TabsTrigger value="claims">Claims</TabsTrigger>
                      <TabsTrigger value="red-team">Red Team</TabsTrigger>
                      <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                    </TabsList>

                    <TabsContent value="artifacts">
                      <div className="space-y-6">
                        {state.artifacts.length > 0 ? (
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
                        ) : (
                          <Card className="border border-neutral-200 p-6">
                            <p className="text-sm text-neutral-500">
                              No artifacts linked to this dossier yet.
                            </p>
                          </Card>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="threads">
                      {state.threads.filter((t) => t.state !== "rfc").length >
                      0 ? (
                        <div className="space-y-2">
                          {state.threads
                            .filter((t) => t.state !== "rfc")
                            .map((t) => (
                              <Link
                                key={t.thread_id}
                                to={`/thread/${t.thread_id}`}
                                className="block"
                              >
                                <Card className="border border-neutral-200 p-4 transition-colors hover:border-neutral-400">
                                  <div className="mb-1 flex items-center gap-2">
                                    <StatusBadge
                                      status={threadStatusLabel(t.state)}
                                    />
                                    <span className="text-xs text-neutral-500">
                                      {t.post_count ?? t.posts?.length ?? 0}{" "}
                                      posts
                                    </span>
                                  </div>
                                  <h3 className="text-sm font-medium text-neutral-900">
                                    {t.title}
                                  </h3>
                                  <p className="mt-1 text-xs text-neutral-500">
                                    {t.thread_id}
                                    {t.targets && t.targets.length > 0
                                      ? ` · ${t.targets
                                          .map(
                                            (x) =>
                                              `${x.target_kind}:${x.target_id}`,
                                          )
                                          .join(", ")}`
                                      : ""}
                                  </p>
                                </Card>
                              </Link>
                            ))}
                        </div>
                      ) : (
                        <Card className="border border-neutral-200 p-6">
                          <p className="text-center text-sm text-neutral-500">
                            No open discussion threads in this dossier yet.
                          </p>
                        </Card>
                      )}
                    </TabsContent>

                    <TabsContent value="rfcs">
                      {state.threads.filter((t) => t.state === "rfc").length >
                      0 ? (
                        <div className="space-y-2">
                          {state.threads
                            .filter((t) => t.state === "rfc")
                            .map((t) => (
                              <Link
                                key={t.thread_id}
                                to={`/thread/${t.thread_id}/rfc`}
                                className="block"
                              >
                                <Card className="border border-neutral-200 p-4 transition-colors hover:border-neutral-400">
                                  <div className="mb-1 flex items-center gap-2">
                                    <StatusBadge status="RFC" />
                                    {t.merge_artifact_id && (
                                      <span className="text-xs text-neutral-500">
                                        merge → {t.merge_artifact_id}
                                      </span>
                                    )}
                                  </div>
                                  <h3 className="text-sm font-medium text-neutral-900">
                                    {t.title}
                                  </h3>
                                  <p className="mt-1 text-xs text-neutral-500">
                                    {t.thread_id} · leaf RFC · RevSets on detail
                                  </p>
                                </Card>
                              </Link>
                            ))}
                        </div>
                      ) : (
                        <Card className="border border-neutral-200 p-6">
                          <p className="text-center text-sm text-neutral-500">
                            No RFC threads in this dossier yet.
                          </p>
                        </Card>
                      )}
                    </TabsContent>

                    <TabsContent value="claims">
                      {claimsLoading && (
                        <p className="text-sm text-neutral-500">
                          Loading claims…
                        </p>
                      )}
                      {claimsError && (
                        <Card className="border border-neutral-200 p-6">
                          <p className="text-sm text-red-700" role="alert">
                            {claimsError}
                          </p>
                        </Card>
                      )}
                      {!claimsLoading &&
                        !claimsError &&
                        claimGroups.length === 0 && (
                          <Card className="border border-neutral-200 p-6">
                            <p className="text-center text-sm text-neutral-500">
                              No claims in this dossier yet. Author claims on an
                              artifact page.
                            </p>
                          </Card>
                        )}
                      {!claimsLoading && claimGroups.length > 0 && (
                        <div className="space-y-8">
                          {claimGroups.map(({ artifact, claims }) => (
                            <div key={artifactIdOf(artifact)}>
                              <div className="mb-3 flex items-baseline justify-between gap-3">
                                <h3 className="text-sm font-semibold text-neutral-900">
                                  {artifact.title}
                                </h3>
                                <Link
                                  to={`/dossier/${id}/artifact/${artifact.slug}`}
                                  className="text-xs text-neutral-600 underline-offset-2 hover:underline"
                                >
                                  Open artifact →
                                </Link>
                              </div>
                              <div className="space-y-3">
                                {claims.map((c) => (
                                  <ClaimListItem
                                    key={c.claim_id}
                                    claim={c}
                                    artifactTitle={artifact.slug}
                                  />
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="red-team">
                      <Card className="border border-neutral-200 p-6">
                        <p className="text-center text-sm text-neutral-500">
                          Red Team Critical / recent Findings live on the{" "}
                          <Link
                            className="underline"
                            to={`/collection/${state.dossier.collection_id}`}
                          >
                            Collection dashboard
                          </Link>
                          ; thread timelines cover Candidate→Finding.
                        </p>
                      </Card>
                    </TabsContent>

                    <TabsContent value="dashboard">
                      <Card className="border border-neutral-200 p-6">
                        <div className="text-center">
                          <p className="mb-4 text-sm text-neutral-600">
                            Live CONCEPT §11 panels live on the Collection splash
                            (claims, Red Team, reputation, audit).
                          </p>
                          <Link
                            to={`/collection/${state.dossier.collection_id}`}
                          >
                            <Button variant="default">
                              Open Collection dashboard
                            </Button>
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
                          {state.artifacts.length}
                        </div>
                        <div className="text-sm text-neutral-600">Artifacts</div>
                      </div>
                      <div>
                        <div className="mb-1 text-2xl font-bold text-neutral-900">
                          {state.threads.length}
                        </div>
                        <div className="text-sm text-neutral-600">Threads</div>
                      </div>
                      <div>
                        <div className="mb-1 text-2xl font-bold text-neutral-900">
                          {claimGroups.reduce(
                            (n, g) => n + g.claims.length,
                            0,
                          )}
                        </div>
                        <div className="text-sm text-neutral-600">Claims</div>
                      </div>
                      <div className="border-l-2 border-amber-500 pl-3">
                        <div className="mb-1 flex items-center gap-2">
                          <StatusBadge status="RFC" />
                        </div>
                        <h4 className="text-sm font-medium text-neutral-900">
                          {
                            state.threads.filter((t) => t.state === "rfc")
                              .length
                          }{" "}
                          RFCs
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
