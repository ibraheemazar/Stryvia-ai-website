import "server-only";
import { SttError, normaliseTranscript, type SttProvider, type TranscribeInput, type TranscribeResult } from "./types";

// OpenAI audio transcription (gpt-4o-transcribe). Multipart upload; ISO-639-1 language hint.
// Docs: https://platform.openai.com/docs/api-reference/audio/createTranscription
export function openAiProvider(apiKey: string, model = "gpt-4o-transcribe"): SttProvider {
  return {
    id: "openai",
    async transcribe(input: TranscribeInput): Promise<TranscribeResult> {
      const started = Date.now();
      const fd = new FormData();
      fd.append("file", new Blob([new Uint8Array(input.audio)], { type: input.mime }), "note.webm");
      fd.append("model", model);
      fd.append("language", input.language);
      fd.append("response_format", "json");
      let res: Response;
      try {
        res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: fd,
          signal: AbortSignal.timeout(60_000),
        });
      } catch (err) {
        throw new SttError((err as Error).name === "TimeoutError" ? "timeout" : "provider", (err as Error).message);
      }
      if (!res.ok) throw new SttError("provider", `openai ${res.status}`);
      const json = (await res.json()) as { text?: string };
      const raw = json.text ?? "";
      return { text: normaliseTranscript(raw), raw, provider: "openai", durationMs: Date.now() - started };
    },
  };
}
