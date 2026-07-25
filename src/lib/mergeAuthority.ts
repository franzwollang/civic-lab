/**
 * CONCEPT §3.4 — Merge authority follows the artifact's Collection.
 *
 * | Artifact location | Who may decide a leaf RFC |
 * | Canon, routine    | Editors (Owner always)    |
 * | Canon, restricted | Owner only (`owner_merge_only`; Critical-AR → M7) |
 * | Country Manual    | Stewards of that Collection (Owner meta-veto) |
 *
 * Thread home dossier never overrides this table.
 */
import {
  PROTOTYPE_USERS,
  type PrototypeRole,
  type PrototypeUser,
  getPrototypeUser,
} from "../app/lib/prototype-users";

export type AreaKind = "canon" | "manuals";

export type MergeAuthorityClass =
  | "manual_steward"
  | "canon_editor"
  | "canon_owner_only";

export type MergeAuthorityContext = {
  artifact_id: string;
  collection_id: string;
  area_id: string;
  area_kind: AreaKind;
  country_code: string | null;
  owner_merge_only: boolean;
  /** Critical Finding / Accepted Risk path deferred to M7. */
  authority_class: MergeAuthorityClass;
  required_roles: PrototypeRole[];
};

export function classifyMergeAuthority(input: {
  area_kind: string;
  owner_merge_only: boolean;
}): MergeAuthorityClass {
  if (input.area_kind === "manuals") return "manual_steward";
  if (input.owner_merge_only) return "canon_owner_only";
  return "canon_editor";
}

export function requiredRolesForClass(
  authorityClass: MergeAuthorityClass,
): PrototypeRole[] {
  switch (authorityClass) {
    case "manual_steward":
      return ["steward", "owner"];
    case "canon_editor":
      return ["editor", "owner"];
    case "canon_owner_only":
      return ["owner"];
  }
}

export function describeAuthorityClass(
  authorityClass: MergeAuthorityClass,
): string {
  switch (authorityClass) {
    case "manual_steward":
      return "Country Manual — Collection stewards (Owner may veto)";
    case "canon_editor":
      return "Canon routine — editors (Owner may merge)";
    case "canon_owner_only":
      return "Canon restricted — Owner only";
  }
}

export function userMayDecide(
  user: PrototypeUser | undefined,
  authorityClass: MergeAuthorityClass,
): boolean {
  if (!user) return false;
  const required = requiredRolesForClass(authorityClass);
  return required.some((role) => user.roles.includes(role));
}

export function actorMayDecide(
  authorId: string | undefined,
  authorityClass: MergeAuthorityClass,
): boolean {
  if (!authorId) return false;
  return userMayDecide(getPrototypeUser(authorId), authorityClass);
}

/** Prototype users who currently satisfy the authority class (global roles). */
export function allowedPrototypeUserIds(
  authorityClass: MergeAuthorityClass,
): string[] {
  return PROTOTYPE_USERS.filter((u) => userMayDecide(u, authorityClass)).map(
    (u) => u.id,
  );
}

export function buildMergeAuthoritySummary(
  ctx: MergeAuthorityContext,
): {
  artifact_id: string;
  collection_id: string;
  area_kind: AreaKind;
  authority_class: MergeAuthorityClass;
  required_roles: PrototypeRole[];
  description: string;
  allowed_user_ids: string[];
} {
  return {
    artifact_id: ctx.artifact_id,
    collection_id: ctx.collection_id,
    area_kind: ctx.area_kind,
    authority_class: ctx.authority_class,
    required_roles: ctx.required_roles,
    description: describeAuthorityClass(ctx.authority_class),
    allowed_user_ids: allowedPrototypeUserIds(ctx.authority_class),
  };
}
