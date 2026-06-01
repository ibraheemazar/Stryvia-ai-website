export type ClassValue =
  | string
  | number
  | null
  | false
  | undefined
  | ClassValue[];

// Minimal class combiner — no external dependency. Flattens, drops falsy.
export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  for (const input of inputs) {
    if (!input) continue;
    if (Array.isArray(input)) {
      const nested = cn(...input);
      if (nested) out.push(nested);
    } else {
      out.push(String(input));
    }
  }
  return out.join(" ");
}

export function isValidEmail(email: string): boolean {
  // Pragmatic, not RFC-exhaustive: enough to catch obvious mistakes.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
