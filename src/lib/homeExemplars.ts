/**
 * Stable live-corpus tour links for the home preamble (OPEN_ISSUES §5).
 * Paths must resolve against seeded ids under prisma/seed/.
 */

export const HOME_EXEMPLARS = [
  {
    id: "canon-collection",
    label: "Canon Collection",
    href: "/collection/collection-canon",
  },
  {
    id: "us-collection",
    label: "US Manuals Collection",
    href: "/collection/collection-us",
  },
  {
    id: "us-dossier",
    label: "US Voting dossier",
    href: "/dossier/us-voting-1",
  },
  {
    id: "open-thread",
    label: "Open thread",
    href: "/thread/thread-us-provisional-open",
  },
  {
    id: "live-rfc",
    label: "Live RFC",
    href: "/thread/thread-us-voter-reg-rfc/rfc",
  },
  {
    id: "red-team-finding",
    label: "Red Team finding",
    href: "/thread/thread-us-voter-reg-rfc/rfc#finding-finding-us-voter-reg-critical",
  },
] as const;

export type HomeExemplarId = (typeof HOME_EXEMPLARS)[number]["id"];

/** Required path prefixes / fragments for smoke regression. */
export const HOME_EXEMPLAR_REQUIRED_HREFS = [
  "/collection/collection-canon",
  "/collection/collection-us",
  "/dossier/us-voting-1",
  "/thread/thread-us-provisional-open",
  "/thread/thread-us-voter-reg-rfc/rfc",
  "finding-finding-us-voter-reg-critical",
] as const;
