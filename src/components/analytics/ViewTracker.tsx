"use client";

import { useEffect } from "react";
import { track, type SvEvent } from "@/lib/analytics";

// Fires a content-view event once on mount (Decisions §6 content analytics).
// Used on capability, industry, and scenario surfaces so the content dashboard
// reflects what actually pulls attention.
export function ViewTracker({
  event,
  properties,
}: {
  event: SvEvent;
  properties?: Record<string, unknown>;
}) {
  useEffect(() => {
    track(event, properties);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
