import "server-only";

// Lead/intent score: a deterministic 0–100 from real signals (no model call, so
// it's free to compute for every row on every load). Higher = hotter, so sales
// works the strongest intent first.

type ScoreInput = {
  converted?: boolean;
  status?: string | null;
  updated_at?: string | null;
  analysis?: { sentiment?: string; requests?: unknown[] } | null;
};

export function scoreConversation(c: ScoreInput): number {
  let s = 0;
  if (c.converted) s += 40;
  switch (c.status) {
    case "scoped":
    case "converted":
      s += 25;
      break;
    case "escalated":
      s += 15;
      break;
    case "active":
      s += 5;
      break;
  }
  const a = c.analysis;
  if (a) {
    if (a.sentiment === "positive") s += 15;
    else if (a.sentiment === "mixed") s += 5;
    else if (a.sentiment === "negative") s -= 5;
    const reqs = Array.isArray(a.requests) ? a.requests.length : 0;
    s += Math.min(20, reqs * 5);
  }
  if (c.updated_at && Date.now() - new Date(c.updated_at).getTime() < 7 * 86400000) s += 10;
  return Math.max(0, Math.min(100, s));
}
