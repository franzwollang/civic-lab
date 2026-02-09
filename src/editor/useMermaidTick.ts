import { useEffect, useState } from "react";

import { subscribeMermaidUpdates } from "@/editor/mermaid";

export function useMermaidTick(): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    return subscribeMermaidUpdates(() => setTick((t) => t + 1));
  }, []);

  return tick;
}

