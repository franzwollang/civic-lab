import { Navigate, useLocation } from "react-router";
import { aboutArtifactPath } from "@/lib/about";

/**
 * Legacy `/about` bookmark → living Canon About artifact
 * (R0 residual; Charter-like `owner_merge_only`). Preserves `#` deep links.
 */
export function About() {
  const { hash } = useLocation();
  return <Navigate to={`${aboutArtifactPath()}${hash}`} replace />;
}
