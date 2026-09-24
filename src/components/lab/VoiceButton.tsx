"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

// Voice input (brief §2 UX, §3 Phase 3). Two paths behind one button:
//  - provider mode: MediaRecorder → POST /api/lab/session/:id/transcribe
//  - browser mode: Web Speech API dictation (no key needed, no audio leaves the
//    page through us — it goes to the browser vendor's service)
// The transcript is placed in the composer for the visitor to correct (§2).

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function getRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function VoiceButton({
  sessionId,
  language,
  provider,
  disabled,
  onTranscript,
}: {
  sessionId: string;
  language: "en" | "ar";
  provider: "browser" | "server";
  disabled?: boolean;
  onTranscript: (text: string, raw: string) => void;
}) {
  const t = useTranslations("lab.session");
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [supported, setSupported] = useState(true);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (provider === "browser") setSupported(Boolean(getRecognition()));
    else setSupported(typeof window !== "undefined" && "MediaRecorder" in window && Boolean(navigator.mediaDevices?.getUserMedia));
  }, [provider]);

  async function start() {
    if (provider === "browser") {
      const Rec = getRecognition();
      if (!Rec) return setSupported(false);
      const rec = new Rec();
      rec.lang = language === "ar" ? "ar-SA" : "en-US";
      rec.interimResults = false;
      rec.continuous = true;
      let finalText = "";
      rec.onresult = (e) => {
        const parts: string[] = [];
        for (let i = 0; i < e.results.length; i += 1) parts.push(e.results[i][0].transcript);
        finalText = parts.join(" ").trim();
      };
      rec.onend = () => {
        setRecording(false);
        if (finalText) onTranscript(finalText, finalText);
      };
      rec.onerror = () => setRecording(false);
      recRef.current = rec;
      rec.start();
      setRecording(true);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "";
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        setRecording(false);
        setBusy(true);
        try {
          const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
          const fd = new FormData();
          fd.append("audio", blob, "note.webm");
          fd.append("language", language);
          const res = await fetch(`/api/lab/session/${sessionId}/transcribe`, { method: "POST", body: fd, credentials: "same-origin" });
          const data = (await res.json()) as { ok: boolean; text?: string; raw?: string };
          if (data.ok && data.text) onTranscript(data.text, data.raw ?? data.text);
        } catch {
          /* surfaced by composer state */
        } finally {
          setBusy(false);
        }
      };
      mediaRef.current = mr;
      mr.start();
      setRecording(true);
      // Hard stop at the configured maximum length.
      setTimeout(() => mr.state === "recording" && mr.stop(), 120_000);
    } catch {
      setSupported(false);
    }
  }

  function stop() {
    if (provider === "browser") recRef.current?.stop();
    else if (mediaRef.current?.state === "recording") mediaRef.current.stop();
  }

  if (!supported) {
    return (
      <span className="hidden text-sv-label text-sv-text-3 sm:inline" title={t("voiceUnsupported")}>
        {t("voiceUnsupported")}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={recording ? stop : start}
      disabled={disabled || busy}
      aria-pressed={recording}
      aria-label={recording ? t("voiceStop") : t("voiceStart")}
      title={recording ? t("voiceStop") : t("voiceStart")}
      className={cn(
        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-sv-sm border transition-colors",
        recording ? "border-sv-danger bg-sv-danger/15 text-sv-danger" : "border-sv-line text-sv-text-2 hover:border-sv-green-line hover:text-sv-green",
        (disabled || busy) && "opacity-50",
      )}
    >
      {busy ? <span className="sv-live-dot" aria-hidden /> : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <rect x="9" y="3" width="6" height="12" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </svg>
      )}
    </button>
  );
}
