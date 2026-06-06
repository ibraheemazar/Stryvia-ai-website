// Template variables: a prompt is written once with {{placeholders}} and only
// the blanks change on copy. This is the core of the "stop rewriting the same
// prompt" problem. Detection runs server-side on every save so the stored
// `variables` array always matches the body.

const VAR_RE = /\{\{\s*([^{}]+?)\s*\}\}/g;

// Distinct variable names in the order they first appear.
export function extractVariables(body: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of body.matchAll(VAR_RE)) {
    const name = m[1].trim();
    if (name && !seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

// Substitute {{name}} with the supplied value; unfilled variables are left as
// the empty string so the copied text never carries raw placeholders.
export function fillVariables(body: string, values: Record<string, string>): string {
  return body.replace(VAR_RE, (_, raw) => {
    const name = String(raw).trim();
    const v = values[name];
    return v == null ? "" : v;
  });
}
