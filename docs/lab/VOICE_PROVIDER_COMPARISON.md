# Voice transcription for the Idea Lab — provider comparison

**Status: desk research, not yet measured.** The brief (§6) asks for a comparison on real Gulf and Levantine Arabic samples before a provider is wired in. No provider key exists in this project yet, so the accuracy columns below are from the vendors' own documentation and public evaluations, not from our clips. `npm run lab:stt-bench` runs the real test the moment keys exist (protocol at the bottom). Until then the Lab uses the **browser's built-in dictation** (Web Speech API), which costs nothing and sends audio to the browser vendor (Apple/Google), not to us.

What matters for this product, in order: (1) Gulf + Levantine dialect accuracy on phone-quality audio, (2) Arabic/English code-switching in one sentence, (3) latency for 20–60 s notes, (4) data handling (audio must not be retained; region), (5) price.

| Provider / model | Arabic dialects | Code-switching | Explicit locale hint | Latency (60 s clip) | Audio retention | Region options | Price (per hour of audio) | Notes |
|---|---|---|---|---|---|---|---|---|
| **ElevenLabs Scribe** | Arabic supported as one language; vendor reports strong results on dialectal speech; no per-dialect model | Handles mixed-language audio; language auto-detected per file | Language code only (`ara`) | Batch, typically a few seconds | Configurable; enterprise ZDR available | US/EU | ≈ $0.40 | Simple API, good default. Dialect claims are unverified by us. |
| **OpenAI gpt-4o-transcribe** | Arabic supported; MSA strong, dialect quality reported as good but variable | Good on mixed AR/EN | ISO-639-1 (`ar`) only | Batch, few seconds; streaming variant exists | Not retained by default under API terms (30-day abuse monitoring) | US only | ≈ $0.36 (gpt-4o-transcribe), ≈ $0.18 (mini) | Many Arabic users report it as the most robust general model; no dialect control. |
| **Azure AI Speech (fast transcription)** | Explicit locales: `ar-SA`, `ar-AE`, `ar-KW`, `ar-QA`, `ar-BH`, `ar-OM`, `ar-JO`, `ar-LB`, `ar-SY`, `ar-PS`, `ar-IQ`, `ar-EG`, `ar-MA`… | Multi-locale detection in one request | Yes — the only one with per-country Arabic | Seconds | Not retained (fast transcription is stateless) | UAE North / Qatar Central / EU / US | ≈ $0.36 (standard), lower with commitment tiers | Best data-residency story (Gulf regions) and the only real dialect targeting. Accuracy on colloquial speech is the open question. |
| Deepgram Nova-3 | Arabic listed with limited dialect coverage; historically weaker on dialects | Some | `ar` only | Very fast | Not retained | US/EU | ≈ $0.26 | Speed/price leader; not recommended as first choice for Gulf dialect until measured. |
| Speechmatics | Arabic with "Gulf/Levantine/Egyptian"-aware acoustic models in their enhanced tier | Good bilingual support | `ar` | Seconds | Configurable | EU/US | ≈ $0.30–0.80 depending on tier | Strong Arabic reputation in broadcast; enterprise-oriented onboarding. |

## Recommendation (provisional, to be confirmed by the bench)

1. **Start with Azure AI Speech** if Gulf data residency matters to the trust story (it does — the consent text promises careful handling): UAE North region, explicit `ar-SA`/`ar-AE`/`ar-LB` locales, stateless fast transcription. Adapter: `src/lib/lab/voice/azure.ts`.
2. **Otherwise ElevenLabs Scribe** for the simplest integration and vendor-claimed dialect robustness. Adapter: `src/lib/lab/voice/elevenlabs.ts`.
3. Keep **OpenAI gpt-4o-transcribe** as the accuracy benchmark in the bench run; if it clearly wins on our clips, use it and accept US-only processing (disclose it in the consent text).

Switching is one env var (`LAB_STT_PROVIDER`) plus the provider key; no code change. Whatever is chosen, the visitor always sees the transcript as editable text before sending, and the audio is discarded after transcription.

## Bench protocol (`scripts/lab/stt-bench.mjs`)

- Put 25 clips in `scripts/lab/stt-samples/`: 10 Gulf (Saudi/Emirati/Kuwaiti speakers), 10 Levantine (Lebanese/Jordanian/Syrian), 5 code-switched (Arabic with English product/tool names and numbers). Phone recordings, 15–45 s, some background noise. Each clip gets a human reference transcript `clip.txt` beside it.
- The script sends each clip to every provider with a key present, computes word error rate (WER) against the reference with Arabic normalisation (alef/taa-marbuta/diacritics folded, digits unified), records latency, and writes `scripts/lab/stt-bench-results.md` with a per-provider table and per-dialect breakdown.
- Decision rule: pick the lowest median WER on Gulf + Levantine; tie-break on code-switch WER, then latency, then region.
