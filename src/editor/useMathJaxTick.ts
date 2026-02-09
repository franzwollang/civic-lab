import { useEffect, useState } from "react";

import { subscribeMathJaxUpdates } from "@/editor/mathjax";

/**
 * Re-render hook for components that directly call MathJax helpers
 * (`renderTexToSvgHtml` / `validateTexWithMathJax`), which resolve async and
 * notify via `subscribeMathJaxUpdates`.
 */
export function useMathJaxTick(): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    return subscribeMathJaxUpdates(() => setTick((t) => t + 1));
  }, []);

  return tick;
}

