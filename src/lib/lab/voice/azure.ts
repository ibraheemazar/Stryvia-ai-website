import "server-only";
import { SttError, arabicLocaleFor, normaliseTranscript, type SttProvider, type TranscribeInput, type TranscribeResult } from "./types";

// Azure AI Speech — fast transcription REST API. Supports explicit Arabic
// locales (ar-SA, ar-AE, ar-LB, ar-EG…) which is why it is in the comparison.
// Docs: https://learn.microsoft.com/azure/ai-services/speech-service/fast-transcription-create
export function azureProvider(key: string, region: string): SttProvider {
  return {
    id: "azure",
    async transcribe(input: TranscribeInput): Promise<TranscribeResult> {
      const started = Date.now();
      const locale = input.language === "ar" ? arabicLocaleFor(input.country) : "en-US";
      const fd = new FormData();
      fd.append("audio", new Blob([new Uint8Array(input.audio)], { type: input.mime }), "note.webm");
      fd.append(
        "definition",
        JSON.stringify({ locales: input.language === "ar" ? [locale, "en-US"] : ["en-US", "ar-SA"], profanityFilterMode: "None" }),
      );
      let res: Response;
      try {
        res = await fetch(`https://${region}.api.cognitive.microsoft.com/speechtotext/transcriptions:transcribe?api-version=2024-11-15`, {
          method: "POST",
          headers: { "Ocp-Apim-Subscription-Key": key },
          body: fd,
          signal: AbortSignal.timeout(60_000),
        });
      } catch (err) {
        throw new SttError((err as Error).name === "TimeoutError" ? "timeout" : "provider", (err as Error).message);
      }
      if (!res.ok) throw new SttError("provider", `azure ${res.status}`);
      const json = (await res.json()) as { combinedPhrases?: Array<{ text: string }>; phrases?: Array<{ locale?: string }> };
      const raw = (json.combinedPhrases ?? []).map((p) => p.text).join(" ");
      return { text: normaliseTranscript(raw), raw, provider: "azure", durationMs: Date.now() - started, detectedLanguage: json.phrases?.[0]?.locale ?? null };
    },
  };
}
