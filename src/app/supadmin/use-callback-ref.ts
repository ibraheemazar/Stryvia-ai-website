"use client";

import { useEffect, useMemo, useRef } from "react";

// A stable function identity that always calls the latest callback. Keeps
// effect dependency lists honest without re-subscribing on every render.
export function useCallbackRef<T extends (...args: never[]) => unknown>(
  callback: T,
): T {
  const ref = useRef(callback);
  useEffect(() => {
    ref.current = callback;
  });
  return useMemo(() => ((...args) => ref.current(...args)) as T, []);
}
