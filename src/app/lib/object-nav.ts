/**
 * Hierarchy href helpers for Area → Collection → Dossier → leaf (M8 breadcrumbs).
 * Leaf hrefs reuse search helpers where possible.
 */

import {
  artifactHref,
  dossierHref,
  threadHref,
} from "@/lib/search";

export type AreaKind = "canon" | "manuals";

export type NavCrumb = {
  label: string;
  href?: string;
};

export function normalizeAreaKind(
  kind: string | null | undefined,
): AreaKind {
  return kind === "manuals" ? "manuals" : "canon";
}

/** Area entry routes (no /area/:id). */
export function areaHref(kind: AreaKind | string): string {
  return normalizeAreaKind(kind) === "manuals" ? "/manuals" : "/canon";
}

export function areaLabel(kind: AreaKind | string): string {
  return normalizeAreaKind(kind) === "manuals" ? "Manuals" : "Canon";
}

/** Infer area from Collection fields when area_kind is not on the wire. */
export function areaKindFromCollection(collection: {
  area_id?: string | null;
  country_code?: string | null;
}): AreaKind {
  if (collection.country_code) return "manuals";
  if (collection.area_id === "area-manuals") return "manuals";
  return "canon";
}

export function collectionHref(collectionId: string): string {
  return `/collection/${collectionId}`;
}

export { artifactHref, dossierHref, threadHref };

/** Area → Collection → … (last crumb is current page; omit href). */
export function buildHierarchyCrumbs(input: {
  area_kind: AreaKind | string;
  collection_id: string;
  collection_title: string;
  dossier_id?: string | null;
  dossier_title?: string | null;
  /** Extra leaf crumbs after dossier (e.g. artifact, thread). Last = current. */
  leaf?: NavCrumb[];
}): NavCrumb[] {
  const kind = normalizeAreaKind(input.area_kind);
  const crumbs: NavCrumb[] = [
    { label: areaLabel(kind), href: areaHref(kind) },
    {
      label: input.collection_title,
      href: collectionHref(input.collection_id),
    },
  ];

  if (input.dossier_id) {
    crumbs.push({
      label: input.dossier_title ?? input.dossier_id,
      href: dossierHref(input.dossier_id),
    });
  }

  if (input.leaf?.length) {
    crumbs.push(...input.leaf);
  }

  // Current page: strip href from final crumb
  const last = crumbs[crumbs.length - 1];
  if (last) {
    crumbs[crumbs.length - 1] = { label: last.label };
  }
  return crumbs;
}
