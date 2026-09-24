#!/usr/bin/env node
// Scripted end-to-end demo of the Idea Lab over HTTP (checkpoint evidence).
// Plays a fixed persona against a deployed or local instance, using the real
// AI on the server side, and saves transcript + brief to docs/lab/<out>/.
//
//   BASE_URL=https://<preview>.vercel.app node scripts/lab/demo-session.mjs translator-en
//   BASE_URL=http://localhost:3000 node scripts/lab/demo-session.mjs ngo-ar --out docs/lab/checkpoint-1
//
// Needs no API key locally. Costs the deployment's Anthropic key one session.

import fs from "node:fs";
import path from "node:path";

const RS = "\x1e";
const [, , personaId = "translator-en", ...rest] = process.argv;
const outDir = rest.includes("--out") ? rest[rest.indexOf("--out") + 1] : "docs/lab/checkpoint-1";
const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const EMAIL = process.env.DEMO_EMAIL || "idea-lab-demo@example.com";

const PERSONAS = {
  "translator-en": {
    name: "Nora Al-Ali",
    phone: "0501234567",
    country: "SA",
    company: "Al-Amana Translation Office",
    role: "Owner",
    language: "en",
    answers: [
      "I run a small certified translation office in Riyadh. Clients send us documents on WhatsApp, we count the words manually, quote them, translate, and send back. It is slow and I lose clients while I am still quoting.",
      "It is me and three translators. I do all the quoting myself, usually in the evening. About 40 to 60 requests a month, mostly legal and commercial documents, contracts, certificates.",
      "Each quote takes me 15 to 20 minutes with Word and Excel. When I am slow, maybe 1 in 5 clients goes to another office. Once we mis-counted a 40 page contract and lost around 3,000 riyals.",
      "We tried a shared Google Sheet and a WhatsApp Business catalogue. Neither solved the counting or the back-and-forth. We use Word, Excel, WhatsApp and a Gmail account.",
      "I want clients to get a price in minutes without me, and to know exactly what is in progress. Ideally the translators pick up work from a queue.",
      "Yes, automating the intake and quoting is exactly what I need first. The word count and the price table are simple rules.",
      "An AI first draft for the translator to review would save time on commercial documents, but for certified legal translations a human must do the work and stamp it. So partially, yes.",
      "Interesting. There are hundreds of small offices like mine in Saudi and the Gulf with the same WhatsApp chaos. I never thought of selling it to them, but I know at least ten owners personally.",
      "A marketplace of certified translators sounds big. I would need to think about who guarantees quality. I am not against it but it is not where I would start.",
      "I bring 12 years in the field, a certification, about 200 active clients, and I know the other office owners. No capital beyond a small budget. I have all our past quotes and documents as data.",
      "I would prefer a paid build for my office first, and I am open to a partnership if it becomes a product for other offices. I do not expect anything for free.",
      "For my own tool, around 30 to 50 thousand riyals is what I can decide alone, this year. I decide, it is my company. No licensing issue for the software itself; the certified translation stamp stays with a licensed translator.",
    ],
  },
  "ngo-ar": {
    name: "سارة الحربي",
    phone: "0559876543",
    country: "SA",
    company: "جمعية إحسان الخيرية",
    role: "مديرة البرامج",
    language: "ar",
    answers: [
      "أنا مديرة برامج في جمعية خيرية في جدة. نستقبل طلبات المساعدة من الأسر عبر الهاتف وواتساب، ونسجّلها يدويًا في ملفات إكسل، ثم لجنة تدرس الحالة وتقرّر. العملية بطيئة والأسر تنتظر أسابيع.",
      "لدينا خمس موظفات في قسم الاستقبال ولجنة من ثلاثة أعضاء. نستقبل نحو 300 طلب شهريًا، ويزيد في رمضان إلى 800.",
      "كل طلب يأخذ تقريبًا ساعة من الموظفة بين الاتصال وإدخال البيانات والتحقق من المستندات. أحيانًا تتكرر الحالة عند موظفتَين ونصرف مساعدة مرتَين. المتبرعون يسألون عن الأثر ولا نملك أرقامًا سريعة.",
      "جرّبنا نموذج Google Forms وبرنامج محاسبي، لكن الموظفات رجعن للإكسل لأنه أسهل. نستخدم إكسل وواتساب والبريد، ونظام محاسبة قديم.",
      "أريد أن تصل الطلبات مرتّبة وموثّقة إلى اللجنة خلال يومين، وأن أعرف حالة أي أسرة بضغطة، وأن أعطي المتبرعين تقريرًا شهريًا واضحًا.",
      "نعم، أتمتة الاستقبال والتحقق من التكرار هي أول شيء. هذا سيوفّر نصف وقت القسم.",
      "فكرة أن يساعد الذكاء الاصطناعي في تلخيص الحالة وترتيب الأولوية جيدة، لكن القرار النهائي يجب أن يبقى للجنة، وحساسية بيانات الأسر مهمة جدًا.",
      "صراحة، كل الجمعيات التي أعرفها في المنطقة تعاني نفس الشيء. نحن أعضاء في شبكة تضم أكثر من 40 جمعية. لو صار الحل جاهزًا لهم سيشتركون بسرعة.",
      "التوسّع إلى منصة إقليمية ممكن نظريًا، لكن لكل دولة أنظمة مختلفة للجمعيات. أفضّل التركيز على السعودية أولًا.",
      "أقدّم خبرتي في العمل الخيري منذ 9 سنوات، وعلاقاتي مع 40 جمعية في الشبكة، وبيانات ثلاث سنوات من الحالات بشكل مجهّل. لا نملك رأس مال للتقنية، لكن لدينا ميزانية تشغيلية.",
      "نتوقّع بناءً مدفوعًا للجمعية أولًا، ونحن مستعدون لنكون الشريك الأول الذي يعرّف الحل على الجمعيات الأخرى. لا نتوقّع شيئًا مجانيًا.",
      "الميزانية التي يمكن أن يوافق عليها مجلس الإدارة هذا العام بين 60 و 100 ألف ريال. القرار لمجلس الإدارة وأنا أعرض عليه. نخضع لأنظمة المركز الوطني لتنمية القطاع غير الربحي وحماية البيانات الشخصية، ولدينا ترخيص ساري.",
    ],
  },
};

const persona = PERSONAS[personaId];
if (!persona) {
  console.error(`Unknown persona ${personaId}. Options: ${Object.keys(PERSONAS).join(", ")}`);
  process.exit(1);
}

let cookie = "";
function headers(extra = {}) {
  return { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}), ...extra };
}
function captureCookie(res) {
  const set = res.headers.get("set-cookie");
  if (set) cookie = set.split(";")[0];
}

async function readStream(res) {
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let all = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    all += dec.decode(value, { stream: true });
  }
  const idx = all.indexOf(RS);
  const text = idx === -1 ? all : all.slice(0, idx);
  let meta = {};
  try {
    meta = idx === -1 ? {} : JSON.parse(all.slice(idx + 1));
  } catch {
    meta = { error: true, code: "no_meta" };
  }
  return { text, meta };
}

const log = [];
const t0 = Date.now();
function line(s) {
  console.log(s);
  log.push(s);
}

const start = await fetch(`${BASE}/api/lab/start`, {
  method: "POST",
  headers: headers(),
  body: JSON.stringify({
    name: persona.name,
    email: EMAIL,
    phone: persona.phone,
    country: persona.country,
    company: persona.company,
    role: persona.role,
    language: persona.language,
    consent: true,
    consentVersion: process.env.CONSENT_VERSION || "2026-09-v1",
    turnstileToken: null,
    website: "",
  }),
});
captureCookie(start);
const started = await start.json();
if (!started.ok) {
  console.error("start failed", start.status, started);
  process.exit(1);
}
const sid = started.sessionId;
line(`# Demo session ${personaId} — ${sid}`);
line(`BASE ${BASE} · started ${new Date().toISOString()}`);

let phase = "intro";
for (let i = 0; i < persona.answers.length; i += 1) {
  const content = persona.answers[i];
  line(`\n**VISITOR (${i + 1})**: ${content}`);
  const res = await fetch(`${BASE}/api/lab/session/${sid}/turn`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ content, inputMode: "text", clientTurnId: `demo-${sid}-${i}-${Date.now()}` }),
  });
  if (!res.ok) {
    line(`!! turn ${i + 1} HTTP ${res.status}: ${await res.text()}`);
    if (res.status === 409) break;
    continue;
  }
  const { text, meta } = await readStream(res);
  line(`**STRYVIA AI**: ${text.trim()}`);
  line(`_meta: phase=${meta.phase} progress=${meta.progress} error=${meta.error ?? false}${meta.options ? " options=" + JSON.stringify(meta.options) : ""}_`);
  phase = meta.phase;
  if (phase === "review" || meta.ended) break;
}

line(`\n## Finish → brief`);
const fin = await fetch(`${BASE}/api/lab/session/${sid}/finish`, { method: "POST", headers: headers() });
const finJson = await fin.json();
line(`finish HTTP ${fin.status}: ${finJson.ok ? `brief v${finJson.brief.version} (${finJson.brief.language})` : JSON.stringify(finJson)}`);

const hydrate = await (await fetch(`${BASE}/api/lab/session/${sid}`, { headers: headers() })).json();
const briefContent = hydrate.brief?.content;
if (briefContent) {
  line(`\n## Brief`);
  line("```json");
  line(JSON.stringify(briefContent, null, 2));
  line("```");
}

const printRes = await fetch(`${BASE}${persona.language === "ar" ? "/ar" : ""}/lab/s/${sid}/brief`, { headers: headers(), redirect: "manual" });
const printHtml = printRes.status === 200 ? await printRes.text() : null;

if (process.env.SUBMIT !== "false") {
  const sub = await fetch(`${BASE}/api/lab/session/${sid}/submit`, { method: "POST", headers: headers() });
  line(`\nsubmit HTTP ${sub.status}: ${await sub.text()}`);
}

const dur = Math.round((Date.now() - t0) / 1000);
line(`\n_Total wall time ${dur}s · visitor turns sent ${Math.min(persona.answers.length, log.filter((l) => l.startsWith("**VISITOR")).length)} · final phase ${phase}_`);

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, `${personaId}.md`), log.join("\n") + "\n");
if (printHtml) fs.writeFileSync(path.join(outDir, `${personaId}.brief.html`), printHtml);
console.log(`\nSaved ${outDir}/${personaId}.md${printHtml ? ` and ${personaId}.brief.html` : ""}`);
