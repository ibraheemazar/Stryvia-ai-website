import "server-only";
import { getLabSettings } from "../env";
import { azureProvider } from "./azure";
import { elevenLabsProvider } from "./elevenlabs";
import { openAiProvider } from "./openai";
import { SttError, type SttProvider } from "./types";

export * from "./types";

/** The configured provider, or null when the browser fallback is in use. */
export function getSttProvider(): SttProvider | null {
  const { stt } = getLabSettings();
  switch (stt.provider) {
    case "elevenlabs":
      if (!stt.elevenlabsKey) throw new SttError("not_configured", "ELEVENLABS_API_KEY missing");
      return elevenLabsProvider(stt.elevenlabsKey);
    case "openai":
      if (!stt.openaiKey) throw new SttError("not_configured", "OPENAI_API_KEY missing");
      return openAiProvider(stt.openaiKey);
    case "azure":
      if (!stt.azureKey || !stt.azureRegion) throw new SttError("not_configured", "AZURE_SPEECH_KEY / AZURE_SPEECH_REGION missing");
      return azureProvider(stt.azureKey, stt.azureRegion);
    default:
      return null;
  }
}

export const ACCEPTED_AUDIO = new Set(["audio/webm", "audio/webm;codecs=opus", "audio/mp4", "audio/m4a", "audio/x-m4a", "audio/wav", "audio/x-wav", "audio/mpeg", "audio/ogg", "audio/ogg;codecs=opus"]);
