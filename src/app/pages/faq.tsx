import { Navigate, useLocation } from "react-router";
import { faqArtifactPath } from "@/lib/faq";

/**
 * Legacy `/faq` bookmark → living Canon FAQ artifact
 * (`owner_merge_only` under canon-governance-1). Preserves hash so
 * About/home deep-links (#do-i-need-math, #two-channels, …) still resolve.
 */
export function Faq() {
  const { hash } = useLocation();
  return <Navigate to={`${faqArtifactPath()}${hash}`} replace />;
}
