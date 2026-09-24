#!/usr/bin/env node
// Real-sample benchmark of speech-to-text providers for Arabic dialects
// (docs/lab/VOICE_PROVIDER_COMPARISON.md). Runs only for providers whose key
// is present in the environment; skips the rest and says so.
//
//   ELEVENLABS_API_KEY=… OPENAI_API_KEY=… AZURE_SPEECH_KEY=… AZURE_SPEECH_REGION=… node scripts/lab/stt-bench.mjs
//
// Samples: scripts/lab/stt-samples/<name>.(webm|mp4|m4a|wav|mp3) + <name>.txt (reference)
// Optional dialect tag in the file name: gulf-*, levant-*, mixed-*.

import fs from "node:fs";
import path from "node:path";

const dir = path.resolve("scripts/lab/stt-samples");
const out = path.resolve("scripts/lab/stt-bench-results.md");
if (!fs.existsSync(dir)) {
  console.error(`No samples folder at ${dir}. Add clips + reference .txt files first (see the comparison doc).`);
  process.exit(1);
}

const clips = fs
  .readdirSync(dir)
  .filter((f) => /\.(webm|mp4|m4a|wav|mp3|ogg)$/i.test(f))
  .map((f) => ({
    name: f.replace(/\.[^.]+$/, ""),
    file: path.join(dir, f),
    mime: { webm: "audio/webm", mp4: "audio/mp4", m4a: "audio/mp4", wav: "audio/wav", mp3: "audio/mpeg", ogg: "audio/ogg" }[f.split(".").pop().toLowerCase()],
    dialect: (f.match(/^(gulf|levant|mixed)/i)?.[1] ?? "other").toLowerCase(),
  }))
  .filter((c) => fs.existsSync(path.join(dir, `${c.name}.txt`)));

if (clips.length === 0) {
  console.error("No clips with reference transcripts found.");
  process.exit(1);
}

// ---- Arabic-aware normalisation + WER ----
function normalise(s) {
  return s
    .replace(/[ً-ْٰـ]/g, "") // diacritics, tatweel
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}
function wer(ref, hyp) {
  const r = normalise(ref);
  const h = normalise(hyp);
  const d = Array.from({ length: r.length + 1 }, (_, i) => [i, ...Array(h.length).fill(0)]);
  for (let j = 1; j <= h.length; j += 1) d[0][j] = j;
  for (let i = 1; i <= r.length; i += 1) {
    for (let j = 1; j <= h.length; j += 1) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1));
    }
  }
  return r.length ? d[r.length][h.length] / r.length : 0;
}

// ---- providers (same request shapes as src/lib/lab/voice/*) ----
const providers = [];
if (process.env.ELEVENLABS_API_KEY) {
  providers.push({
    id: "elevenlabs",
    async run(c) {
      const fd = new FormData();
      fd.append("file", new Blob([fs.readFileSync(c.file)], { type: c.mime }), path.basename(c.file));
      fd.append("model_id", "scribe_v1");
      fd.append("language_code", "ara");
      const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY }, body: fd });
      if (!res.ok) throw new Error(`elevenlabs ${res.status}`);
      return (await res.json()).text ?? "";
    },
  });
}
if (process.env.OPENAI_API_KEY) {
  providers.push({
    id: "openai",
    async run(c) {
      const fd = new FormData();
      fd.append("file", new Blob([fs.readFileSync(c.file)], { type: c.mime }), path.basename(c.file));
      fd.append("model", "gpt-4o-transcribe");
      fd.append("language", "ar");
      const res = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: fd });
      if (!res.ok) throw new Error(`openai ${res.status}`);
      return (await res.json()).text ?? "";
    },
  });
}
if (process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION) {
  providers.push({
    id: "azure",
    async run(c) {
      const fd = new FormData();
      fd.append("audio", new Blob([fs.readFileSync(c.file)], { type: c.mime }), path.basename(c.file));
      const locale = c.dialect === "levant" ? "ar-LB" : "ar-SA";
      fd.append("definition", JSON.stringify({ locales: [locale, "en-US"] }));
      const res = await fetch(`https://${process.env.AZURE_SPEECH_REGION}.api.cognitive.microsoft.com/speechtotext/transcriptions:transcribe?api-version=2024-11-15`, {
        method: "POST",
        headers: { "Ocp-Apim-Subscription-Key": process.env.AZURE_SPEECH_KEY },
        body: fd,
      });
      if (!res.ok) throw new Error(`azure ${res.status}`);
      const json = await res.json();
      return (json.combinedPhrases ?? []).map((p) => p.text).join(" ");
    },
  });
}

if (providers.length === 0) {
  console.error("No provider keys found (ELEVENLABS_API_KEY / OPENAI_API_KEY / AZURE_SPEECH_KEY+REGION). Nothing measured.");
  process.exit(2);
}

const results = [];
for (const p of providers) {
  for (const c of clips) {
    const ref = fs.readFileSync(path.join(dir, `${c.name}.txt`), "utf8");
    const t0 = Date.now();
    try {
      const hyp = await p.run(c);
      results.push({ provider: p.id, clip: c.name, dialect: c.dialect, wer: wer(ref, hyp), ms: Date.now() - t0, hyp });
      console.log(`${p.id.padEnd(11)} ${c.name.padEnd(28)} WER ${(results.at(-1).wer * 100).toFixed(1).padStart(5)}%  ${Date.now() - t0} ms`);
    } catch (err) {
      results.push({ provider: p.id, clip: c.name, dialect: c.dialect, wer: null, ms: Date.now() - t0, error: String(err) });
      console.log(`${p.id.padEnd(11)} ${c.name.padEnd(28)} ERROR ${err}`);
    }
  }
}

const median = (xs) => {
  const s = xs.filter((x) => x != null).sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : null;
};
const lines = [`# STT bench results — ${new Date().toISOString()}`, "", `Clips: ${clips.length} · Providers: ${providers.map((p) => p.id).join(", ")}`, "", "| Provider | Median WER (all) | Gulf | Levant | Mixed | Median latency | Errors |", "|---|---:|---:|---:|---:|---:|---:|"];
for (const p of providers) {
  const rs = results.filter((r) => r.provider === p.id);
  const f = (d) => {
    const m = median(rs.filter((r) => (d ? r.dialect === d : true)).map((r) => r.wer));
    return m == null ? "—" : `${(m * 100).toFixed(1)}%`;
  };
  lines.push(`| ${p.id} | ${f()} | ${f("gulf")} | ${f("levant")} | ${f("mixed")} | ${median(rs.map((r) => r.ms))} ms | ${rs.filter((r) => r.error).length} |`);
}
lines.push("", "## Per clip", "", "| Provider | Clip | Dialect | WER | ms |", "|---|---|---|---:|---:|");
for (const r of results) lines.push(`| ${r.provider} | ${r.clip} | ${r.dialect} | ${r.wer == null ? "error" : `${(r.wer * 100).toFixed(1)}%`} | ${r.ms} |`);
fs.writeFileSync(out, lines.join("\n") + "\n");
console.log(`\nWrote ${out}`);
