#!/usr/bin/env node
// Marketing smoke-test "bot". Exercises every admin marketing endpoint and the
// pure client logic, then prints a pass/fail report. AI endpoints are slow
// (Opus); the bot waits and reports timing so you can see they're live, not
// stuck.
//
// Usage:
//   BASE_URL=https://www.stryvia.ai ADMIN_TOKEN=<supabase access token> \
//     node scripts/marketing-smoke.mjs
//
// Get ADMIN_TOKEN: sign in at /supadmin, open devtools console, run:
//   (await window.supabase?.auth?.getSession?.())?.data?.session?.access_token
// or copy the Bearer token from any /api/admin/* request in the Network tab.

const BASE_URL = process.env.BASE_URL || "https://www.stryvia.ai";
const TOKEN = process.env.ADMIN_TOKEN || "";

let pass = 0;
let fail = 0;
const results = [];

function ok(name, detail) {
  pass++;
  results.push(`✅ ${name}${detail ? ` — ${detail}` : ""}`);
}
function bad(name, detail) {
  fail++;
  results.push(`❌ ${name}${detail ? ` — ${detail}` : ""}`);
}

async function call(path, init) {
  const t0 = Date.now();
  const res = await fetch(`${BASE_URL}/api/admin/marketing${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  const ms = Date.now() - t0;
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* non-json */
  }
  return { status: res.status, ms, body };
}

// ---- Pure logic checks (no network) --------------------------------------
function testPureLogic() {
  // UTM builder
  try {
    const u = new URL("https://stryvia.ai");
    u.searchParams.set("utm_source", "meta");
    u.searchParams.set("utm_medium", "cpc");
    if (u.toString() === "https://stryvia.ai/?utm_source=meta&utm_medium=cpc")
      ok("UTM builder assembles tracked link");
    else bad("UTM builder", u.toString());
  } catch (e) {
    bad("UTM builder", String(e));
  }

  // Two-proportion z-test sanity: big, clearly-different samples → high confidence
  const normalCdf = (z) => {
    const x = z / Math.SQRT2;
    const t = 1 / (1 + 0.3275911 * Math.abs(x));
    const y =
      1 -
      ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
        t *
        Math.exp(-x * x);
    const erf = x >= 0 ? y : -y;
    return 0.5 * (1 + erf);
  };
  const conf = (cC, cV, vC, vV) => {
    const p = (cC + vC) / (cV + vV);
    const se = Math.sqrt(p * (1 - p) * (1 / cV + 1 / vV));
    const z = Math.abs(vC / vV - cC / cV) / se;
    return Math.round((2 * normalCdf(z) - 1) * 100);
  };
  const c = conf(50, 1000, 150, 1000); // 5% vs 15% on 1000 each
  if (c >= 95) ok("A/B significance flags a clear winner", `${c}% confidence`);
  else bad("A/B significance", `expected >=95, got ${c}`);
}

// ---- Endpoint checks ------------------------------------------------------
async function testEndpoints() {
  if (!TOKEN) {
    results.push("⚠️  No ADMIN_TOKEN set — skipping live endpoint checks (pure logic only).");
    return;
  }

  // Read sections
  for (const section of ["home", "segments", "automations", "content", "performance", "learnings"]) {
    try {
      const r = await call(`?section=${section}`);
      if (r.status === 200 && r.body?.ok !== false) ok(`GET ?section=${section}`, `${r.ms}ms`);
      else bad(`GET ?section=${section}`, `status ${r.status} ${JSON.stringify(r.body)?.slice(0, 120)}`);
    } catch (e) {
      bad(`GET ?section=${section}`, String(e));
    }
  }

  // AI: email draft
  try {
    const r = await call("/email", {
      method: "POST",
      body: JSON.stringify({ action: "draft", brief: "Launch announcement for new product leads", tone: "warm" }),
    });
    if (r.body?.ok && Array.isArray(r.body.subjects) && r.body.body)
      ok("AI: email draft", `${r.body.subjects.length} subjects, ${r.ms}ms`);
    else bad("AI: email draft", `status ${r.status} ${JSON.stringify(r.body)?.slice(0, 160)}`);
  } catch (e) {
    bad("AI: email draft", String(e));
  }

  // AI: build automation
  try {
    const r = await call("/automations", {
      method: "POST",
      body: JSON.stringify({ action: "ai_build", goal: "When a finance lead comes in, send an intro email and Slack the team." }),
    });
    if (r.body?.ok && r.body.spec?.name && Array.isArray(r.body.spec.actions))
      ok("AI: build automation", `"${r.body.spec.name}", ${r.body.spec.actions.length} actions, ${r.ms}ms`);
    else bad("AI: build automation", `status ${r.status} ${JSON.stringify(r.body)?.slice(0, 160)}`);
  } catch (e) {
    bad("AI: build automation", String(e));
  }

  // AI: suggest automations
  try {
    const r = await call("/automations", { method: "POST", body: JSON.stringify({ action: "suggest" }) });
    if (r.body?.ok && Array.isArray(r.body.specs)) ok("AI: suggest automations", `${r.body.specs.length} suggestions, ${r.ms}ms`);
    else bad("AI: suggest automations", `status ${r.status} ${JSON.stringify(r.body)?.slice(0, 160)}`);
  } catch (e) {
    bad("AI: suggest automations", String(e));
  }

  // AI: landing variants
  try {
    const r = await call("/landing", {
      method: "POST",
      body: JSON.stringify({ action: "ai_variants", goal: "Get founders to book a build session", locale: "en" }),
    });
    if (r.body?.ok && Array.isArray(r.body.variants) && r.body.variants.length === 2 && r.body.variants[0].headline)
      ok("AI: landing variants", `2 variants + hypothesis, ${r.ms}ms`);
    else bad("AI: landing variants", `status ${r.status} ${JSON.stringify(r.body)?.slice(0, 160)}`);
  } catch (e) {
    bad("AI: landing variants", String(e));
  }

  // Segments preview (audience resolver)
  try {
    const r = await call("/segments", { method: "POST", body: JSON.stringify({ action: "preview", rules: {} }) });
    if (r.body?.ok && typeof r.body.count === "number") ok("Segments preview", `${r.body.count} leads, ${r.ms}ms`);
    else bad("Segments preview", `status ${r.status} ${JSON.stringify(r.body)?.slice(0, 120)}`);
  } catch (e) {
    bad("Segments preview", String(e));
  }
}

(async () => {
  console.log(`\n🤖 Marketing smoke test → ${BASE_URL}\n`);
  testPureLogic();
  await testEndpoints();
  console.log(results.join("\n"));
  console.log(`\n${pass} passed, ${fail} failed.\n`);
  process.exit(fail > 0 ? 1 : 0);
})();
