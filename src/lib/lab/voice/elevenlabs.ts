import "server-only";
import { SttError, normaliseTranscript, type SttProvider, type TranscribeInput, type TranscribeResult } from "./types";

// ElevenLabs Scribe (speech-to-text). Multipart upload; language code hint.
// Docs: https://elevenlabs.io/docs/api-reference/speech-to-text/convert
export function elevenLabsProvider(apiKey: string, modelId = "scribe_v1"): SttProvider {
  return {
    id: "elevenlabs",
    async transcribe(input: TranscribeInput): Promise<TranscribeResult> {
      const started = Date.now();
      const fd = new FormData();
      fd.append("file", new Blob([new Uint8Array(input.audio)], { type: input.mime }), "note.webm");
      fd.append("model_id", modelId);
      fd.append("language_code", input.language === "ar" ? "ara" : "eng");
      fd.append("tag_audio_events", "false");
      fd.append("diarize", "false");
      let res: Response;
      try {
        res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
          method: "POST",
          headers: { "xi-api-key": apiKey },
          body: fd,
          signal: AbortSignal.timeout(60_000),
        });
      } catch (err) {
        throw new SttError((err as Error).name === "TimeoutError" ? "timeout" : "provider", (err as Error).message);
      }
      if (!res.ok) throw new SttError("provider", `elevenlabs ${res.status}`);
      const json = (await res.json()) as { text?: string; language_code?: string };
      const raw = json.text ?? "";
      return { text: normaliseTranscript(raw), raw, provider: "elevenlabs", durationMs: Date.now() - started, detectedLanguage: json.language_code ?? null };
    },
  };
}
