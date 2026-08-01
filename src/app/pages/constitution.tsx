import { Navigate } from "react-router";
import { charterArtifactPath } from "@/lib/charter";

/**
 * Legacy `/constitution` bookmark → living Canon Charter artifact
 * (CONCEPT §9.3, `owner_merge_only`).
 */
export function Constitution() {
  return <Navigate to={charterArtifactPath()} replace />;
}
