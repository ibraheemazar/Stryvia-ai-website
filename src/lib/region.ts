// Data residency truth (Decisions §7). The Trust and Privacy copy must match
// the region actually selected at build time. These read public env values so
// the copy never promises more than the infrastructure delivers.

export function isInKingdom(): boolean {
  return process.env.NEXT_PUBLIC_DATA_IN_KINGDOM === "true";
}

export function dataRegionLabel(): string {
  return process.env.NEXT_PUBLIC_DATA_REGION || "the nearest available region";
}
