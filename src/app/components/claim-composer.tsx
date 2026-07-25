import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createClaim } from "../../api/client";
import type { ClaimRow, SectionRow } from "../../doc/types";
import {
  legalProfilesForOwner,
  validateClaimAgainstOwner,
  type ClaimOwnerContext,
  type ClaimProfile,
  type EmpiricalType,
  type CanonScope,
} from "../../lib/claimLegality";
import { useActingUserOptional } from "../lib/acting-user";
import { ActingAsHint } from "./acting-as-hint";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Textarea } from "./ui/textarea";

function parseApiError(err: unknown): string {
  if (!(err instanceof Error)) return "Failed to create claim";
  const raw = err.message.trim();
  try {
    const parsed = JSON.parse(raw) as {
      error?: { message?: string };
      message?: string;
    };
    if (parsed.error?.message) return parsed.error.message;
    if (parsed.message) return parsed.message;
  } catch {
    // not JSON
  }
  return raw || "Failed to create claim";
}

type ClaimComposerProps = {
  artifactId: string;
  ownerContext: ClaimOwnerContext;
  sections?: SectionRow[];
  enabled?: boolean;
  onCreated?: (claim: ClaimRow) => void;
};

export function ClaimComposer({
  artifactId,
  ownerContext,
  sections = [],
  enabled = true,
  onCreated,
}: ClaimComposerProps) {
  const legalProfiles = useMemo(
    () => legalProfilesForOwner(ownerContext),
    [ownerContext],
  );

  const { userId: authorId } = useActingUserOptional();
  const [profile, setProfile] = useState<ClaimProfile>(
    legalProfiles[0] ?? "empirical",
  );
  const [text, setText] = useState("");
  const [empiricalType, setEmpiricalType] = useState<EmpiricalType>("fact");
  const [scope, setScope] = useState<CanonScope>("global");
  const [probability, setProbability] = useState("0.5");
  const [deadline, setDeadline] = useState("");
  const [resolutionCriteria, setResolutionCriteria] = useState("");
  const [preferredSources, setPreferredSources] = useState("");
  const [canonCitations, setCanonCitations] = useState("");
  const [sectionId, setSectionId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (legalProfiles.length === 0) return;
    if (!legalProfiles.includes(profile)) {
      setProfile(legalProfiles[0]);
    }
  }, [legalProfiles, profile]);

  if (legalProfiles.length === 0) {
    return (
      <Card className="border border-neutral-200 bg-neutral-50 p-4">
        <p className="text-sm text-neutral-600">
          This artifact cannot own claims
          {ownerContext.lane === "prescriptive"
            ? " (Manual Prescriptive cites claims but does not host claim rows)."
            : "."}
        </p>
      </Card>
    );
  }

  function resetForm() {
    setText("");
    setEmpiricalType("fact");
    setScope("global");
    setProbability("0.5");
    setDeadline("");
    setResolutionCriteria("");
    setPreferredSources("");
    setCanonCitations("");
    setSectionId("");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !enabled || submitting) return;

    const sources = preferredSources
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const citations = canonCitations
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const probNum =
      profile === "empirical" && empiricalType === "forecast"
        ? Number(probability)
        : null;

    const draft = {
      profile,
      text: trimmed,
      empirical_type: profile === "empirical" ? empiricalType : null,
      scope:
        profile === "empirical" && ownerContext.area_kind === "canon"
          ? scope
          : null,
      probability: probNum,
      resolution_criteria: resolutionCriteria.trim() || null,
      preferred_sources: sources,
      canon_citations: citations,
    };

    const check = validateClaimAgainstOwner(ownerContext, draft);
    if (!check.ok) {
      setError(check.error.message);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const claim = await createClaim({
        artifact_id: artifactId,
        section_id: sectionId || null,
        profile,
        text: trimmed,
        empirical_type: draft.empirical_type,
        scope: draft.scope,
        probability: draft.probability,
        deadline:
          profile === "empirical" &&
          empiricalType === "forecast" &&
          deadline.trim()
            ? new Date(deadline.trim()).toISOString()
            : null,
        resolution_criteria: draft.resolution_criteria,
        preferred_sources: sources,
        canon_citations: citations,
        author_id: authorId,
      });
      resetForm();
      onCreated?.(claim);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = enabled && !submitting && text.trim().length > 0;
  const isCanonEmpirical =
    profile === "empirical" && ownerContext.area_kind === "canon";
  const isForecast = profile === "empirical" && empiricalType === "forecast";

  return (
    <Card className="border border-neutral-200 bg-white p-4">
      <form onSubmit={onSubmit} className="space-y-3">
        <ActingAsHint requireCapability="author_claims" capabilityLabel="author claims" />

        {legalProfiles.length > 1 && (
          <div className="space-y-1.5">
            <Label
              htmlFor="claim-profile"
              className="text-xs uppercase tracking-wider text-neutral-500"
            >
              Profile
            </Label>
            <Select
              value={profile}
              onValueChange={(v) => setProfile(v as ClaimProfile)}
              disabled={!enabled || submitting}
            >
              <SelectTrigger id="claim-profile" className="w-full bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {legalProfiles.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {profile === "empirical" && (
          <div className="space-y-1.5">
            <Label
              htmlFor="claim-empirical-type"
              className="text-xs uppercase tracking-wider text-neutral-500"
            >
              Empirical type
            </Label>
            <Select
              value={empiricalType}
              onValueChange={(v) => setEmpiricalType(v as EmpiricalType)}
              disabled={!enabled || submitting}
            >
              <SelectTrigger
                id="claim-empirical-type"
                className="w-full bg-white"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fact">fact</SelectItem>
                <SelectItem value="forecast">forecast</SelectItem>
                <SelectItem value="model">model</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {isCanonEmpirical && (
          <div className="space-y-1.5">
            <Label
              htmlFor="claim-scope"
              className="text-xs uppercase tracking-wider text-neutral-500"
            >
              Canon scope
            </Label>
            <Select
              value={scope}
              onValueChange={(v) => setScope(v as CanonScope)}
              disabled={!enabled || submitting}
            >
              <SelectTrigger id="claim-scope" className="w-full bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">global</SelectItem>
                <SelectItem value="regional">regional</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {isForecast && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label
                htmlFor="claim-probability"
                className="text-xs uppercase tracking-wider text-neutral-500"
              >
                Probability (0.01–0.99)
              </Label>
              <Input
                id="claim-probability"
                type="number"
                min={0.01}
                max={0.99}
                step={0.01}
                value={probability}
                onChange={(e) => setProbability(e.target.value)}
                disabled={!enabled || submitting}
                className="bg-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="claim-deadline"
                className="text-xs uppercase tracking-wider text-neutral-500"
              >
                Deadline (optional)
              </Label>
              <Input
                id="claim-deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                disabled={!enabled || submitting}
                className="bg-white"
              />
            </div>
          </div>
        )}

        {profile === "requirement" && (
          <div className="space-y-1.5">
            <Label
              htmlFor="claim-canon-citations"
              className="text-xs uppercase tracking-wider text-neutral-500"
            >
              Canon citations (artifact ids)
            </Label>
            <Input
              id="claim-canon-citations"
              value={canonCitations}
              onChange={(e) => setCanonCitations(e.target.value)}
              placeholder="page-001"
              disabled={!enabled || submitting}
              className="bg-white"
            />
          </div>
        )}

        {sections.length > 0 && (
          <div className="space-y-1.5">
            <Label
              htmlFor="claim-section"
              className="text-xs uppercase tracking-wider text-neutral-500"
            >
              Section (optional)
            </Label>
            <Select
              value={sectionId || "__none__"}
              onValueChange={(v) => setSectionId(v === "__none__" ? "" : v)}
              disabled={!enabled || submitting}
            >
              <SelectTrigger id="claim-section" className="w-full bg-white">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {sections.map((s) => (
                  <SelectItem key={s.section_id} value={s.section_id}>
                    {s.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1.5">
          <Label
            htmlFor="claim-text"
            className="text-xs uppercase tracking-wider text-neutral-500"
          >
            Claim text
          </Label>
          <Textarea
            id="claim-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="State the claim…"
            rows={3}
            disabled={!enabled || submitting}
            className="bg-white"
          />
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="claim-resolution"
            className="text-xs uppercase tracking-wider text-neutral-500"
          >
            Resolution criteria (optional)
          </Label>
          <Textarea
            id="claim-resolution"
            value={resolutionCriteria}
            onChange={(e) => setResolutionCriteria(e.target.value)}
            placeholder="How will this be scored or checked?"
            rows={2}
            disabled={!enabled || submitting}
            className="bg-white"
          />
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="claim-sources"
            className="text-xs uppercase tracking-wider text-neutral-500"
          >
            Preferred sources (optional, comma-separated)
          </Label>
          <Input
            id="claim-sources"
            value={preferredSources}
            onChange={(e) => setPreferredSources(e.target.value)}
            placeholder="OECD, national election authorities"
            disabled={!enabled || submitting}
            className="bg-white"
          />
        </div>

        {error && (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end">
          <Button type="submit" size="sm" disabled={!canSubmit}>
            {submitting ? "Creating…" : "Create claim"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
