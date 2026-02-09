import type { Root, Folder, Item, Node } from "fumadocs-core/page-tree";
import collections from "../../.source/browser";

const rawEntries = collections.docs.raw;
const docPaths = Object.keys(rawEntries).map((path) =>
  path.startsWith("./") ? path.slice(2) : path,
);
const docPathSet = new Set(docPaths);

const titleFromSlug = (slug: string) =>
  slug
    .split("-")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");

const getOrCreateFolder = (
  root: Root,
  folderMap: Map<string, Folder>,
  pathParts: string[],
) => {
  let currentPath = "";
  let parent: Folder | Root = root;

  for (const part of pathParts) {
    currentPath = currentPath ? `${currentPath}/${part}` : part;
    let folder = folderMap.get(currentPath);
    if (!folder) {
      folder = {
        type: "folder",
        name: titleFromSlug(part),
        children: [],
      };
      folderMap.set(currentPath, folder);
      parent.children.push(folder);
    }
    parent = folder;
  }

  return parent as Folder;
};

const buildDocsTree = () => {
  const root: Root = {
    name: "Docs",
    children: [],
  };
  const folderMap = new Map<string, Folder>();
  let rootIndex: Item | null = null;

  docPaths.forEach((docPath) => {
    const withoutExt = docPath.replace(/\.(md|mdx)$/i, "");
    const parts = withoutExt.split("/");
    const filename = parts[parts.length - 1];
    const isIndex = filename === "index";
    const slugs = isIndex ? parts.slice(0, -1) : parts;
    const url = `/docs${slugs.length ? `/${slugs.join("/")}` : ""}`;

    const item: Item = {
      type: "page",
      name: titleFromSlug(isIndex ? slugs[slugs.length - 1] ?? "Docs" : filename),
      url,
    };

    if (slugs.length === 0) {
      rootIndex = item;
      return;
    }

    if (isIndex) {
      const folder = getOrCreateFolder(root, folderMap, slugs);
      folder.index = item;
      return;
    }

    const parentPath = slugs.slice(0, -1);
    if (parentPath.length === 0) {
      root.children.push(item);
      return;
    }

    const folder = getOrCreateFolder(root, folderMap, parentPath);
    folder.children.push(item);
  });

  if (rootIndex) {
    root.children.unshift(rootIndex);
  }

  return root;
};

export const docsTree = buildDocsTree();

export const resolveDocPath = (slugs: string[]) => {
  if (slugs.length === 0) return "index.mdx";
  const directMdx = `${slugs.join("/")}.mdx`;
  const directMd = `${slugs.join("/")}.md`;
  const indexMdx = `${slugs.join("/")}/index.mdx`;
  const indexMd = `${slugs.join("/")}/index.md`;

  if (docPathSet.has(directMdx)) return directMdx;
  if (docPathSet.has(directMd)) return directMd;
  if (docPathSet.has(indexMdx)) return indexMdx;
  if (docPathSet.has(indexMd)) return indexMd;

  return null;
};

export const loadDoc = async (docPath: string) => {
  const loader = rawEntries[docPath];
  if (!loader) return null;
  return loader();
};

export const getDocTitleFallback = (slugs: string[]) => {
  if (slugs.length === 0) return "Civic Lab Docs";
  return titleFromSlug(slugs[slugs.length - 1]);
};
