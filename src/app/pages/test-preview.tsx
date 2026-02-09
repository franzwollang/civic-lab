import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";

import { Header } from "../components/header";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";

import { getPage, getRevisions } from "@/api/client";
import type { PageRevisionRow, PageRow } from "@/doc/types";

type SlateNode = {
  type?: string;
  text?: string;
  id?: string;
  children?: SlateNode[];
};

function renderNodes(nodes: SlateNode[]): React.ReactNode {
  return nodes.map((node, index) => {
    if (node.text) {
      return node.text;
    }

    const children = node.children ? renderNodes(node.children) : null;
    const key = node.id ?? `node-${index}`;

    switch (node.type) {
      case "h1":
        return (
          <h1 key={key} className="mb-4 text-3xl font-semibold text-neutral-900">
            {children}
          </h1>
        );
      case "h2":
        return (
          <h2 key={key} className="mb-3 text-2xl font-semibold text-neutral-900">
            {children}
          </h2>
        );
      case "h3":
        return (
          <h3 key={key} className="mb-2 text-lg font-semibold text-neutral-900">
            {children}
          </h3>
        );
      case "p":
      default:
        return (
          <p key={key} className="mb-4 text-sm leading-7 text-neutral-700">
            {children}
          </p>
        );
    }
  });
}

export function TestPreview() {
  const { pageId } = useParams();
  const [page, setPage] = useState<PageRow | null>(null);
  const [revisions, setRevisions] = useState<PageRevisionRow[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const latestRevision = revisions[0];

  const content = useMemo(() => {
    if (!latestRevision) return [];
    const value = latestRevision.content_json;
    return Array.isArray(value) ? (value as SlateNode[]) : [];
  }, [latestRevision]);

  useEffect(() => {
    const load = async () => {
      if (!pageId) return;
      setStatus("loading");
      setError(null);
      try {
        const [pageData, revisionsData] = await Promise.all([
          getPage(pageId),
          getRevisions(pageId),
        ]);
        setPage(pageData);
        setRevisions(revisionsData);
        setStatus("idle");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load preview");
        setStatus("error");
      }
    };

    void load();
  }, [pageId]);

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />

      <main className="mx-auto flex max-w-[1200px] flex-col gap-6 px-8 py-10">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-neutral-900">
              {page?.title || "Preview"}
            </h1>
            <p className="text-sm text-neutral-500">
              Read-only preview of the latest revision.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/test/editor"
              className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
            >
              Back to editor
            </Link>
            <Badge variant="secondary">
              {latestRevision ? "Latest" : "No revisions"}
            </Badge>
          </div>
        </div>

        {status === "loading" && (
          <Card className="border border-neutral-200 bg-white p-6 text-sm text-neutral-500">
            Loading preview...
          </Card>
        )}

        {error && (
          <Card className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </Card>
        )}

        {status === "idle" && latestRevision && (
          <Card className="border border-neutral-200 bg-white p-8">
            {renderNodes(content)}
          </Card>
        )}

        {status === "idle" && !latestRevision && !error && (
          <Card className="border border-neutral-200 bg-white p-6 text-sm text-neutral-500">
            No revisions available to preview.
          </Card>
        )}
      </main>
    </div>
  );
}
