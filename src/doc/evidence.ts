export type LocatorKind =
  | "page"
  | "timestamp"
  | "section"
  | "url_fragment"
  | "other";

export type Locator = {
  kind: LocatorKind;
  value: string;
};

export type AttributionEntity = {
  id: string;
  type: "url" | "book" | "paper" | "report" | "other";
  title: string;
  authors: string[];
  publisher?: string;
  date_published?: string;
  url?: string;
  accessed_at?: string;
  immutable_ref?: string | null;
  notes?: string;
};

export type AttributionRegistry = {
  version: number;
  items: AttributionEntity[];
};

export type TermScope =
  | { kind: "global"; ref?: string }
  | { kind: "dossier"; ref: string }
  | { kind: "country"; ref: string };

export type TermAlias = {
  lang: string;
  text: string;
  transliteration?: string | null;
};

export type TermEntity = {
  id: string;
  scope: TermScope;
  type: "local_alias" | "platform_construct" | "disambiguation";
  /**
   * Keep this binary for now.
   * "accepted" is stable enough to depend on; "tentative" is still being refined.
   */
  status: "tentative" | "accepted";
  canonical_label_en: string;
  aliases: TermAlias[];
  definition_en: string;
  disambiguation_en?: string;
  see_also_term_ids?: string[];
  notes?: string;
};

export type TermRegistry = {
  version: number;
  items: TermEntity[];
};

export type EvidenceRegistry = {
  attributions: AttributionRegistry;
  terms: TermRegistry;
};
