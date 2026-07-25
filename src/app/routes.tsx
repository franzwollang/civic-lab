import { createBrowserRouter, Navigate } from "react-router";
import { Home } from "./pages/home";
import { DossierOverview } from "./pages/dossier-overview";
import { ArtifactPage } from "./pages/artifact-page";
import { DescriptiveArtifact } from "./pages/descriptive-artifact";
import { Dashboard } from "./pages/dashboard";
import { ThreadPage } from "./pages/thread-page";
import { RfcThreadPage } from "./pages/rfc-thread-page";
import { RedTeamReview } from "./pages/red-team-review";
import { TestEditor, ArtifactEditorPage } from "./pages/test-editor";
import { TestPreview } from "./pages/test-preview";
import { About } from "./pages/about";
import { Faq } from "./pages/faq";
import { Constitution } from "./pages/constitution";
import { Docs } from "./pages/docs";
import {
  CanonIndex,
  CollectionSplash,
} from "./pages/collection-splash";
import { ManualsIndex } from "./pages/manuals-index";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Home,
  },
  {
    path: "/home",
    Component: Home,
  },
  {
    path: "/about",
    Component: About,
  },
  {
    path: "/faq",
    Component: Faq,
  },
  {
    path: "/constitution",
    Component: Constitution,
  },
  {
    path: "/docs/*",
    Component: Docs,
  },
  {
    path: "/canon",
    Component: CanonIndex,
  },
  {
    path: "/manuals",
    Component: ManualsIndex,
  },
  {
    path: "/collection/:collectionId",
    Component: CollectionSplash,
  },
  {
    path: "/test/editor",
    Component: TestEditor,
  },
  {
    path: "/test/editor/:artifactId",
    Component: TestEditor,
  },
  {
    path: "/test/preview/:pageId",
    Component: TestPreview,
  },
  // Legacy entry IDs that were Collection stand-ins, not dossiers.
  {
    path: "/dossier/canon-1",
    element: <Navigate to="/canon" replace />,
  },
  {
    path: "/dossier/manual-us-1",
    element: <Navigate to="/manuals" replace />,
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
    path: "/dossier/:dossierId/artifact/:artifactId/edit",
    Component: ArtifactEditorPage,
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
