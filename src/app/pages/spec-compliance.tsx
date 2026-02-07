import { Header } from "../components/header";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { CheckCircle2, Circle, Info } from "lucide-react";
import { Link } from "react-router";

export function SpecCompliance() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />

      <main className="mx-auto max-w-[1200px] px-8 py-12">
        <div className="mb-8">
          <h1 className="mb-4 text-4xl font-bold text-neutral-900">
            Spec Compliance Checklist
          </h1>
          <p className="text-neutral-600">
            Comprehensive audit of the Civic Lab prototype against product
            specifications. This checklist documents all implemented features,
            refinements, and improvements.
          </p>
        </div>

        <div className="space-y-6">
          {/* Core Concepts */}
          <Card className="border border-neutral-200 p-6">
            <h2 className="mb-4 text-xl font-semibold text-neutral-900">
              Core Concepts Implementation
            </h2>
            <div className="space-y-3">
              <ComplianceItem
                status="complete"
                title="Dossier as primary container with subforum"
                description="Dossier Overview page includes Artifacts, Threads, RFCs, Red Team, and Dashboard tabs"
                link="/dossier/us-voting-1"
              />
              <ComplianceItem
                status="complete"
                title="Artifacts as structured pages within dossiers"
                description="Artifact pages with lane badges, metadata, linked threads, and content rendering"
                link="/dossier/us-voting-1/artifact/provisional"
              />
              <ComplianceItem
                status="complete"
                title="Threads as primary discussion mechanism"
                description="Thread pages show timeline, targets, and actions (Nominate for RFC, Flag Finding)"
                link="/thread/thread-1"
              />
              <ComplianceItem
                status="complete"
                title="Thread promotion to RFC with revision mechanics"
                description="RFC pages include scope, intent, acceptance criteria, revision sets, and decision widget"
                link="/thread/thread-1/rfc"
              />
              <ComplianceItem
                status="complete"
                title="Red Team as global independent authority"
                description="Red Team Review page with governance notice, findings filter, and severity tracking"
                link="/dossier/us-voting-1/red-team/1"
              />
              <ComplianceItem
                status="complete"
                title="Scorable Claims for Descriptive lane"
                description="Claim row component with type, probability/confidence, deadline, resolution criteria, and status"
                link="/dossier/us-voting-1/artifact-descriptive/turnout-intel"
              />
            </div>
          </Card>

          {/* Lane Hygiene */}
          <Card className="border border-neutral-200 p-6">
            <h2 className="mb-4 text-xl font-semibold text-neutral-900">
              Country Manual Lane Hygiene
            </h2>
            <div className="space-y-3">
              <ComplianceItem
                status="complete"
                title="Prominent lane badges with tooltips"
                description="Descriptive, Prescriptive, and Alignment badges appear at top of all artifact pages with explanatory tooltips"
              />
              <ComplianceItem
                status="complete"
                title="Lane-specific UI elements for Descriptive artifacts"
                description="Descriptive artifacts show Claims section with structured claim rows, resolution tracking, and adjudication request action"
                link="/dossier/us-voting-1/artifact-descriptive/turnout-intel"
              />
              <ComplianceItem
                status="complete"
                title="Lane distribution visualization"
                description="Dashboard shows lane breakdown with counts and percentages"
                link="/dossier/us-voting-1/dashboard"
              />
            </div>
          </Card>

          {/* Metrics */}
          <Card className="border border-neutral-200 p-6">
            <h2 className="mb-4 text-xl font-semibold text-neutral-900">
              Metrics Presentation
            </h2>
            <div className="space-y-3">
              <ComplianceItem
                status="complete"
                title="Claim Quality metrics (Descriptive lane)"
                description="Resolution rate, invalidation rate, time-to-resolution, citation density, ambiguity rate"
                link="/dossier/us-voting-1/dashboard"
              />
              <ComplianceItem
                status="complete"
                title="Forecast Accuracy metrics (probabilistic forecasts)"
                description="Brier score, log score, calibration, sharpness, skill vs baseline"
                link="/dossier/us-voting-1/dashboard"
              />
              <ComplianceItem
                status="complete"
                title="Advisory labeling on all metrics"
                description="Tooltips and notices clarify metrics are advisory only, do not confer automatic permissions"
              />
              <ComplianceItem
                status="complete"
                title="Metrics link to underlying claims"
                description="Dashboard includes claim status breakdown and links to artifact pages with full claim details"
              />
            </div>
          </Card>

          {/* Reputation */}
          <Card className="border border-neutral-200 p-6">
            <h2 className="mb-4 text-xl font-semibold text-neutral-900">
              Reputation System
            </h2>
            <div className="space-y-3">
              <ComplianceItem
                status="complete"
                title="Reputation based on merged RFCs"
                description="Dashboard reputation tab shows top contributors by merged RFCs with impact weighting"
                link="/dossier/us-voting-1/dashboard"
              />
              <ComplianceItem
                status="complete"
                title="Peer review and red team outcomes"
                description="Review labor section tracks Red Team reviews completed, adjudication assists, findings mitigated"
              />
              <ComplianceItem
                status="complete"
                title="Scoped endorsements with provenance"
                description="Endorsements shown by domain/scope with counts from specific reviewer groups"
              />
              <ComplianceItem
                status="complete"
                title="Provenance shown for all reputation signals"
                description="All reputation metrics include source information (merged RFCs, review types, endorsement sources)"
              />
            </div>
          </Card>

          {/* Governance */}
          <Card className="border border-neutral-200 p-6">
            <h2 className="mb-4 text-xl font-semibold text-neutral-900">
              Global vs Local Governance
            </h2>
            <div className="space-y-3">
              <ComplianceItem
                status="complete"
                title="Country stewards moderate per-country manuals"
                description="Dossier header shows steward attribution (Mark Johnson as US Manual steward)"
              />
              <ComplianceItem
                status="complete"
                title="Red Team as global authority"
                description="Prominent governance notice on Red Team page: 'Red Team is global and independent. Findings cannot be overridden by country stewards.'"
                link="/dossier/us-voting-1/red-team/1"
              />
              <ComplianceItem
                status="complete"
                title="Adjudicators as global authority"
                description="Request Adjudication action on Descriptive artifacts, separate from merge/RFC workflows"
                link="/dossier/us-voting-1/artifact-descriptive/turnout-intel"
              />
              <ComplianceItem
                status="complete"
                title="Separation of powers (adjudicators don't merge)"
                description="Adjudication button separate from RFC nomination, governance notice clarifies distinct authorities"
              />
            </div>
          </Card>

          {/* UI Components */}
          <Card className="border border-neutral-200 p-6">
            <h2 className="mb-4 text-xl font-semibold text-neutral-900">
              Reusable Components
            </h2>
            <div className="space-y-3">
              <ComplianceItem
                status="complete"
                title="Dossier card"
                description="Includes lane badge, title, description, steward, last updated, artifact count, thread count"
              />
              <ComplianceItem
                status="complete"
                title="Artifact card"
                description="Shows title, description, tags, pinned indicator, clickable to artifact page"
              />
              <ComplianceItem
                status="complete"
                title="Thread list row"
                description="Displays title, status badge, author, message count, last activity"
              />
              <ComplianceItem
                status="complete"
                title="Finding card"
                description="Shows severity badge, status, title, description, likelihood, colored border"
              />
              <ComplianceItem
                status="complete"
                title="Claim row"
                description="Type badge, statement, confidence/probability, deadline/as-of, resolution criteria, status with icon, source count"
              />
              <ComplianceItem
                status="complete"
                title="RevSet row"
                description="Version number, author, timestamp, description, current indicator, view diff and set current buttons"
              />
              <ComplianceItem
                status="complete"
                title="Lane, Status, and Severity badges"
                description="Consistent color-coded badges across all pages with proper semantic colors"
              />
            </div>
          </Card>

          {/* Navigation & UX */}
          <Card className="border border-neutral-200 p-6">
            <h2 className="mb-4 text-xl font-semibold text-neutral-900">
              Navigation & User Experience
            </h2>
            <div className="space-y-3">
              <ComplianceItem
                status="complete"
                title="Coherent navigation flow"
                description="Home → Dossier → Artifact → Thread → RFC → Red Team all connected with proper breadcrumbs and links"
              />
              <ComplianceItem
                status="complete"
                title="Dossier as main hub"
                description="Dossier Overview includes all tabs: Artifacts | Threads | RFCs | Red Team | Dashboard"
                link="/dossier/us-voting-1"
              />
              <ComplianceItem
                status="complete"
                title="Artifact pages show linked threads/RFCs"
                description="Prominent Linked Threads & RFCs section before content, showing references and current status"
                link="/dossier/us-voting-1/artifact/provisional"
              />
              <ComplianceItem
                status="complete"
                title="RFC pages show all required elements"
                description="RFC header (scope/intent/acceptance), revision sets with diff buttons, review checklist, decision widget"
                link="/thread/thread-1/rfc"
              />
              <ComplianceItem
                status="complete"
                title="Red Team review supports filtering"
                description="Toggle between: Findings only | Findings + responses | All discussion"
                link="/dossier/us-voting-1/red-team/1"
              />
              <ComplianceItem
                status="complete"
                title="Thread-first architecture"
                description="Start Thread and Nominate for RFC actions prominent on artifact pages, no per-page comment sections"
              />
            </div>
          </Card>

          {/* Microcopy & Tooltips */}
          <Card className="border border-neutral-200 p-6">
            <h2 className="mb-4 text-xl font-semibold text-neutral-900">
              Microcopy & Guidance
            </h2>
            <div className="space-y-3">
              <ComplianceItem
                status="complete"
                title="Lane explanation tooltips"
                description="Info icons next to lane badges explain Descriptive, Prescriptive, and Alignment purposes"
              />
              <ComplianceItem
                status="complete"
                title="Metrics advisory notices"
                description="All metric sections include tooltips: 'Advisory signals only. Do not imply automatic permissions.'"
              />
              <ComplianceItem
                status="complete"
                title="Descriptive artifact requirements notice"
                description="Blue callout explains claim structure requirements, timestamping, resolution criteria, adjudication process"
                link="/dossier/us-voting-1/artifact-descriptive/turnout-intel"
              />
              <ComplianceItem
                status="complete"
                title="Red Team governance notice"
                description="Red banner explains global authority, independence from stewards, and adjudicator separation"
                link="/dossier/us-voting-1/red-team/1"
              />
              <ComplianceItem
                status="complete"
                title="RFC mechanics explanation"
                description="Tooltip on RFC page header explains RFC enables revision mechanics and review workflows"
              />
            </div>
          </Card>

          {/* Style & Aesthetic */}
          <Card className="border border-neutral-200 p-6">
            <h2 className="mb-4 text-xl font-semibold text-neutral-900">
              Engineering Lab Aesthetic
            </h2>
            <div className="space-y-3">
              <ComplianceItem
                status="complete"
                title="Neutral color palette"
                description="Primary neutrals (whites, grays) with subtle accent colors for state (amber for RFC, red for critical findings)"
              />
              <ComplianceItem
                status="complete"
                title="Clean grid and whitespace"
                description="Consistent spacing, clear sections, generous padding, subtle dividers"
              />
              <ComplianceItem
                status="complete"
                title="Strong typographic hierarchy"
                description="Clear heading levels, consistent font weights, readable line heights"
              />
              <ComplianceItem
                status="complete"
                title="Minimal ornamentation"
                description="Simple tables and cards, no flashy visuals, restrained icons, lab notebook feel"
              />
              <ComplianceItem
                status="complete"
                title="Desktop-first 1440px width"
                description="All pages optimized for 1440px viewport with proper max-width containers"
              />
              <ComplianceItem
                status="complete"
                title="Professional, non-gamified tone"
                description="Serious UI language, no gamification elements, focus on precision and structure"
              />
            </div>
          </Card>

          {/* Summary */}
          <Card className="border-2 border-green-600 bg-green-50 p-6">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-1 h-6 w-6 text-green-700" />
              <div>
                <h2 className="mb-2 text-xl font-semibold text-green-900">
                  Compliance Summary
                </h2>
                <p className="mb-4 text-green-800">
                  All core requirements from the product specification have been
                  implemented and refined. The prototype now includes:
                </p>
                <ul className="list-inside list-disc space-y-1 text-sm text-green-800">
                  <li>Complete information architecture (Dossier, Artifact, Thread, RFC, Red Team)</li>
                  <li>Scorable claims system for Descriptive lane with claim rows and metrics</li>
                  <li>Separate Claim Quality and Forecast Accuracy metric families</li>
                  <li>Prominent lane tagging with hygiene enforcement</li>
                  <li>Governance indicators (Red Team global authority, Adjudicators)</li>
                  <li>Thread-first architecture with linked threads on artifacts</li>
                  <li>RFC revision sets with diff previews</li>
                  <li>Reputation system with provenance</li>
                  <li>Comprehensive microcopy and tooltips</li>
                  <li>Engineering lab aesthetic with clean typography and neutral palette</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}

interface ComplianceItemProps {
  status: "complete" | "partial" | "missing";
  title: string;
  description: string;
  link?: string;
}

function ComplianceItem({ status, title, description, link }: ComplianceItemProps) {
  const icon = status === "complete" ? (
    <CheckCircle2 className="h-5 w-5 text-green-600" />
  ) : (
    <Circle className="h-5 w-5 text-neutral-400" />
  );

  const content = (
    <div className="flex items-start gap-3">
      {icon}
      <div className="flex-1">
        <div className="mb-1 font-medium text-neutral-900">{title}</div>
        <div className="text-sm text-neutral-600">{description}</div>
      </div>
      {link && (
        <Badge variant="secondary" className="text-xs">
          View
        </Badge>
      )}
    </div>
  );

  if (link) {
    return (
      <Link
        to={link}
        className="block rounded-lg border border-neutral-200 p-3 transition-colors hover:bg-neutral-50"
      >
        {content}
      </Link>
    );
  }

  return <div className="rounded-lg border border-neutral-200 p-3">{content}</div>;
}
