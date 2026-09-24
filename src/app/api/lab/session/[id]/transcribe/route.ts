import type { NextRequest } from "next/server";
import { LAB_LIMITS } from "@/config/lab.config";
import { labEvent } from "@/lib/lab/events";
import { json, ownerOr, withLabRoute } from "@/lib/lab/http";
import { hashKey, isRateLimited } from "@/lib/lab/rate-limit";
import { logAiCall } from "@/lib/lab/store";
import { ACCEPTED_AUDIO, SttError, getSttProvider } from "@/lib/lab/voice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Voice note → text (brief §2 UX). Audio is forwarded to the configured
// provider and discarded; only the transcript returns, and only after the
// visitor has corrected and sent it does it get stored with the message.
export const POST = withLabRoute<{ id: string }>("lab.session.transcribe", async (req: NextRequest, { params, requestId }) => {
  const owner = await ownerOr(req, params.id);
  if (!owner.ok) return owner.res!;
  const { session } = owner;
  if (session.status !== "in_progress") return json({ ok: false, error: "not_in_progress" }, 409);
  if (await isRateLimited(hashKey("transcribe", session.id), LAB_LIMITS.transcribePerSessionPerMinute, 60)) {
    return json({ ok: false, error: "rate_limited" }, 429);
  }
  let provider;
  try {
    provider = getSttProvider();
  } catch (err) {
    return json({ ok: false, error: "voice_unavailable", code: err instanceof SttError ? err.code : "unknown" }, 503);
  }
  if (!provider) return json({ ok: false, error: "voice_browser_only" }, 501);

  const form = await req.formData().catch(() => null);
  const file = form?.get("audio");
  const language = form?.get("language") === "ar" ? "ar" : "en";
  if (!(file instanceof Blob)) return json({ ok: false, error: "no_audio" }, 400);
  const mime = (file.type || "audio/webm").toLowerCase();
  if (!ACCEPTED_AUDIO.has(mime)) return json({ ok: false, error: "unsupported_type" }, 415);
  if (file.size > LAB_LIMITS.maxAudioBytes) return json({ ok: false, error: "too_large" }, 413);

  const audio = Buffer.from(await file.arrayBuffer());
  const started = Date.now();
  try {
    const result = await provider.transcribe({ audio, mime, language, country: session.country });
    await logAiCall({
      session_id: session.id,
      purpose: "transcribe",
      actor: "visitor",
      model: provider.id,
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
      latency_ms: Date.now() - started,
      cost_usd: 0,
      ok: true,
    });
    return json({ ok: true, text: result.text.slice(0, 4000), raw: result.raw.slice(0, 4000), provider: result.provider, detectedLanguage: result.detectedLanguage ?? null });
  } catch (err) {
    const code = err instanceof SttError ? err.code : "unknown";
    await logAiCall({ session_id: session.id, purpose: "transcribe", actor: "visitor", model: provider.id, input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0, latency_ms: Date.now() - started, cost_usd: 0, ok: false, error_code: code });
    await labEvent("transcribe.failed", "warn", { sessionId: session.id, requestId, payload: { provider: provider.id, code } });
    return json({ ok: false, error: "transcribe_failed", code }, 502);
  }
});
