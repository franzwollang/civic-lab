import { createBrowserRouter } from "react-router";
import { Home } from "./pages/home";
import { DossierOverview } from "./pages/dossier-overview";
import { ArtifactPage } from "./pages/artifact-page";
import { DescriptiveArtifact } from "./pages/descriptive-artifact";
import { Dashboard } from "./pages/dashboard";
import { ThreadPage } from "./pages/thread-page";
import { RfcThreadPage } from "./pages/rfc-thread-page";
import { RedTeamReview } from "./pages/red-team-review";
import { SpecCompliance } from "./pages/spec-compliance";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Home,
  },
  {
    path: "/spec-compliance",
    Component: SpecCompliance,
  },
  {
    path: "/dossier/:id",
    Component: DossierOverview,
  },
  {
    path: "/dossier/:id/dashboard",
    Component: Dashboard,
  },
  {
    path: "/dossier/:dossierId/artifact/:artifactId",
    Component: ArtifactPage,
  },
  {
    path: "/dossier/:dossierId/artifact-descriptive/:artifactId",
    Component: DescriptiveArtifact,
  },
  {
    path: "/thread/:id",
    Component: ThreadPage,
  },
  {
    path: "/thread/:id/rfc",
    Component: RfcThreadPage,
  },
  {
    path: "/dossier/:dossierId/red-team/:reviewId",
    Component: RedTeamReview,
  },
]);