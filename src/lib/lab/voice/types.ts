// Voice transcription provider contract (brief §2 UX, §6). Audio never
// touches disk or the database; it is forwarded once to the provider and the
// transcript comes back as editable text.

export type TranscribeInput = {
  audio: Buffer;
  mime: string;
  /** Session language: steers the provider's language/dialect hint. */
  language: "en" | "ar";
  /** ISO country of the visitor, used to pick an Arabic dialect locale where the provider supports it. */
  country?: string | null;
};

export type TranscribeResult = {
  text: string;
  /** Raw provider text before our light normalisation. */
  raw: string;
  provider: string;
  durationMs: number;
  detectedLanguage?: string | null;
};

export interface SttProvider {
  id: "elevenlabs" | "openai" | "azure";
  transcribe(input: TranscribeInput): Promise<TranscribeResult>;
}

export class SttError extends Error {
  constructor(public code: "not_configured" | "provider" | "timeout" | "unsupported", message: string) {
    super(message);
    this.name = "SttError";
  }
}

/** Map a visitor's country to the closest Arabic locale a provider offers. */
export function arabicLocaleFor(country?: string | null): string {
  switch ((country ?? "").toUpperCase()) {
    case "SA":
      return "ar-SA";
    case "AE":
      return "ar-AE";
    case "KW":
      return "ar-KW";
    case "QA":
      return "ar-QA";
    case "BH":
      return "ar-BH";
    case "OM":
      return "ar-OM";
    case "JO":
      return "ar-JO";
    case "LB":
      return "ar-LB";
    case "SY":
      return "ar-SY";
    case "PS":
      return "ar-PS";
    case "IQ":
      return "ar-IQ";
    case "EG":
      return "ar-EG";
    case "MA":
      return "ar-MA";
    case "DZ":
      return "ar-DZ";
    case "TN":
      return "ar-TN";
    case "LY":
      return "ar-LY";
    case "YE":
      return "ar-YE";
    default:
      return "ar-SA";
  }
}

export function normaliseTranscript(text: string): string {
  return text.replace(/\s+/g, " ").replace(/\s+([،,.؟?!])/g, "$1").trim();
}
