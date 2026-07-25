import { useEffect, useMemo, useState } from "react";
import { Header } from "../components/header";
import { SidebarNav } from "../components/sidebar-nav";
import { LaneBadge } from "../components/badges";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { ExternalLink, MessageSquare, GitBranch, Info, Pencil } from "lucide-react";
import { useParams, Link } from "react-router";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip";
import {
  ArtifactDocumentBody,
  useArtifactDocument,
} from "@/doc/ArtifactDocumentBody";
import { artifactIdOf } from "@/doc/types";
import type { ArtifactRow, DossierRow } from "@/doc/types";
import { getDossier, getDossierArtifacts } from "@/api/client";
import { laneForDossier } from "../lib/dossier-display";

export function ArtifactPage() {
  const { dossierId, artifactId } = useParams();
  const doc = useArtifactDocument(artifactId);
  const [dossier, setDossier] = useState<DossierRow | null>(null);
  const [related, setRelated] = useState<ArtifactRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function loadRelated() {
      if (!dossierId) {
        setDossier(null);
        setRelated([]);
        return;
      }
      try {
        const [d, artifacts] = await Promise.all([
          getDossier(dossierId),
          getDossierArtifacts(dossierId),
        ]);
        if (!cancelled) {
          setDossier(d);
          setRelated(artifacts);
        }
      } catch {
        if (!cancelled) {
          setDossier(null);
          setRelated([]);
        }
      }
    }
    void loadRelated();
    return () => {
      cancelled = true;
    };
  }, [dossierId]);

  const title = useMemo(() => {
    if (doc.status === "ready") return doc.artifact.title;
    return artifactId ?? "Artifact";
  }, [doc, artifactId]);

  const updatedLabel = useMemo(() => {
    if (doc.status === "ready") {
      const d = new Date(doc.revision.created_at);
      return `Revision ${doc.revision.revision_id.slice(0, 8)} · ${d.toLocaleDateString()}`;
    }
    return null;
  }, [doc]);

  const showLive = doc.status === "ready";
  const lane = dossier ? laneForDossier(dossier) : null;

  const relatedFiltered = useMemo(() => {
    const currentSlug =
      doc.status === "ready" ? doc.artifact.slug : artifactId;
    const currentId =
      doc.status === "ready" ? artifactIdOf(doc.artifact) : artifactId;
    return related.filter((r) => {
      const id = artifactIdOf(r);
      return r.slug !== currentSlug && id !== currentId;
    });
  }, [related, doc, artifactId]);

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />
      <SidebarNav dossierId={dossierId} currentPage="artifact" />

      <main className="ml-64 pt-16">
        <div className="mx-auto max-w-[1200px] px-8 py-8">
          <div className="flex gap-8">
            <article className="flex-1">
              <div className="mb-6">
                <div className="mb-2 text-sm text-neutral-500">
                  <Link
                    to={`/dossier/${dossierId}`}
                    className="hover:text-neutral-700"
                  >
                    ↑ Dossier
                  </Link>{" "}
                  / Artifact
                </div>
                <div className="mb-4 flex items-center gap-3">
                  {lane && (
                    <>
                      <LaneBadge lane={lane} />
                      {lane === "Prescriptive" && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-4 w-4 text-neutral-400" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="text-xs">
                                <strong>Prescriptive Lane:</strong> Contains
                                objective-conditional strategy and procedures
                                attributed to an actor/owner. Focus on actionable
                                plans.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </>
                  )}
                  {showLive && (
                    <Badge variant="secondary">Live revision</Badge>
                  )}
                </div>
                <h1 className="mb-4 text-3xl font-bold text-neutral-900">
                  {title}
                </h1>
                {updatedLabel && (
                  <div className="flex items-center gap-4 text-sm text-neutral-600">
                    <span>{updatedLabel}</span>
                    {showLive && (
                      <>
                        <span>·</span>
                        <span>Author: {doc.revision.author}</span>
                        <span>·</span>
                        <Link
                          to={`/test/preview/${artifactIdOf(doc.artifact)}`}
                          className="text-neutral-700 underline-offset-2 hover:underline"
                        >
                          Open test preview
                        </Link>
                      </>
                    )}
                  </div>
                )}
              </div>

              {showLive && (
                <div className="mb-8 flex gap-3">
                  <Link
                    to={`/dossier/${dossierId}/artifact/${artifactIdOf(doc.artifact)}/edit`}
                  >
                    <Button variant="default" size="sm">
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                  </Link>
                  <Link to="/thread/thread-1">
                    <Button variant="outline" size="sm">
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Start Thread
                    </Button>
                  </Link>
                  <Link to="/thread/thread-1/rfc">
                    <Button variant="outline" size="sm">
                      <GitBranch className="mr-2 h-4 w-4" />
                      Nominate for RFC
                    </Button>
                  </Link>
                </div>
              )}

              {doc.status === "loading" && (
                <Card className="border border-neutral-200 bg-white p-8 text-sm text-neutral-500">
                  Loading artifact document…
                </Card>
              )}

              {doc.status === "error" && (
                <Card className="border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
                  Could not load artifact ({doc.message}).
                </Card>
              )}

              {doc.status === "missing" && (
                <Card className="border border-neutral-200 bg-white p-6">
                  <h2 className="mb-2 text-lg font-semibold text-neutral-900">
                    Artifact not found
                  </h2>
                  <p className="mb-4 text-sm text-neutral-600">
                    No seeded artifact matches <code>{artifactId}</code> in this
                    dossier.
                  </p>
                  <Link
                    to={`/dossier/${dossierId}`}
                    className="text-sm underline"
                  >
                    Back to dossier
                  </Link>
                </Card>
              )}

              {doc.status === "ready" && (
                <Card className="border border-neutral-200 bg-white p-8">
                  <ArtifactDocumentBody load={doc} />
                </Card>
              )}
            </article>

            <aside className="w-80">
              <div className="space-y-6">
                <Card className="border border-neutral-200 p-6">
                  <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-700">
                    Metadata
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <div className="mb-1 font-medium text-neutral-900">
                        Artifact ID
                      </div>
                      <div className="text-neutral-600">
                        {showLive ? artifactIdOf(doc.artifact) : artifactId}
                      </div>
                    </div>
                    {showLive && (
                      <div>
                        <div className="mb-1 font-medium text-neutral-900">
                          Slug
                        </div>
                        <div className="text-neutral-600">
                          {doc.artifact.slug}
                        </div>
                      </div>
                    )}
                    <div>
                      <div className="mb-1 font-medium text-neutral-900">
                        Dossier
                      </div>
                      <Link
                        to={`/dossier/${dossierId}`}
                        className="text-neutral-600 hover:text-neutral-900"
                      >
                        {dossier?.title ?? dossierId}
                      </Link>
                    </div>
                    {showLive && (
                      <div>
                        <div className="mb-1 font-medium text-neutral-900">
                          Version
                        </div>
                        <div className="text-neutral-600">
                          {doc.revision.revision_id.slice(0, 8)}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>

                {showLive && doc.sections.length > 0 && (
                  <Card className="border border-neutral-200 p-6">
                    <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-700">
                      Sections
                    </h3>
                    <ul className="space-y-2 text-sm">
                      {doc.sections.map((section) => (
                        <li
                          key={section.stable_key}
                          className={
                            section.level === 2
                              ? "font-medium text-neutral-900"
                              : "pl-3 text-neutral-600"
                          }
                        >
                          <span className="text-neutral-400">
                            {section.stable_key}
                          </span>
                          <span className="mx-1 text-neutral-300">·</span>
                          {section.title}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-xs text-neutral-500">
                      Stable keys from heading block ids (Section plan; DB sync
                      deferred).
                    </p>
                  </Card>
                )}

                {relatedFiltered.length > 0 && (
                  <Card className="border border-neutral-200 p-6">
                    <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-700">
                      Related Artifacts
                    </h3>
                    <div className="space-y-3">
                      {relatedFiltered.map((r) => (
                        <Link
                          key={artifactIdOf(r)}
                          to={`/dossier/${dossierId}/artifact/${r.slug}`}
                          className="block text-sm text-neutral-600 hover:text-neutral-900"
                        >
                          <div className="flex items-start gap-2">
                            <ExternalLink className="mt-0.5 h-3 w-3" />
                            <span>{r.title}</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </Card>
                )}

                {showLive && (
                  <Card className="border border-neutral-200 p-6">
                    <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-neutral-700">
                      Threads & claims
                    </h3>
                    <p className="text-xs text-neutral-500">
                      Linked threads, RFCs, and claims arrive with M5–M6.
                    </p>
                  </Card>
                )}
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
