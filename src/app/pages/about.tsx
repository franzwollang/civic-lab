import { Navigate, useLocation } from "react-router";
import { aboutArtifactPath } from "@/lib/about";

/**
 * Legacy `/about` bookmark → living Canon About artifact
 * (`owner_merge_only` under canon-governance-1). Preserves hash so
 * home deep-links (#two-channels, #workflow, …) still resolve.
 */
export function About() {
  const { hash } = useLocation();
  return <Navigate to={`${aboutArtifactPath()}${hash}`} replace />;
}
