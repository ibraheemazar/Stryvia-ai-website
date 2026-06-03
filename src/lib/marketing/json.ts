// Robust JSON extraction from a model reply: tolerates code fences and any
// surrounding prose by locating the first balanced {…} or […] and parsing it.
// This is the difference between "the button does nothing" and reliable output.

export function stripFences(s: string): string {
  return s
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
}

export function extractJson<T = unknown>(text: string): T | null {
  if (!text) return null;
  const s = stripFences(text);
  try {
    return JSON.parse(s) as T;
  } catch {
    /* fall through to a balanced-bracket scan */
  }
  const start = s.search(/[[{]/);
  if (start === -1) return null;
  const open = s[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(s.slice(start, i + 1)) as T;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}
