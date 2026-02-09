import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/layouts/docs/page";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { baseOptions } from "../../lib/layout.shared";
import {
  docsTree,
  getDocTitleFallback,
  loadDoc,
  resolveDocPath,
} from "../../lib/docs";

export function Docs() {
  const params = useParams();
  const slug = params["*"] ?? "";
  const slugs = useMemo(
    () =>
      slug
        .split("/")
        .map((part) => part.trim())
        .filter(Boolean),
    [slug],
  );

  const docPath = resolveDocPath(slugs);
  const [doc, setDoc] = useState<
    | {
        frontmatter: { title?: string; description?: string };
        toc?: unknown[];
        default: React.ComponentType<{ components?: typeof defaultMdxComponents }>;
      }
    | null
  >(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (!docPath) {
      setDoc(null);
      return;
    }
    setLoading(true);
    loadDoc(docPath)
      .then((data) => {
        if (mounted) setDoc(data);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [docPath]);

  const containerProps = { className: "min-h-screen bg-neutral-50" };

  if (!docPath) {
    return (
      <DocsLayout {...baseOptions} tree={docsTree} containerProps={containerProps}>
        <DocsPage>
          <DocsTitle>Document not found</DocsTitle>
          <DocsDescription>
            The requested doc could not be located. Check the URL or return to
            the docs index.
          </DocsDescription>
          <DocsBody>
            <p>Try the main docs index at /docs.</p>
          </DocsBody>
        </DocsPage>
      </DocsLayout>
    );
  }

  const MdxContent = doc?.default;
  const title = doc?.frontmatter?.title ?? getDocTitleFallback(slugs);
  const description = doc?.frontmatter?.description;

  return (
    <DocsLayout {...baseOptions} tree={docsTree} containerProps={containerProps}>
      <DocsPage toc={doc?.toc as [] | undefined}>
        <DocsTitle>{title}</DocsTitle>
        {description ? <DocsDescription>{description}</DocsDescription> : null}
        <DocsBody>
          {loading && !doc ? (
            <p>Loading documentation…</p>
          ) : MdxContent ? (
            <MdxContent components={defaultMdxComponents} />
          ) : (
            <p>Unable to render this document yet.</p>
          )}
        </DocsBody>
      </DocsPage>
    </DocsLayout>
  );
}
