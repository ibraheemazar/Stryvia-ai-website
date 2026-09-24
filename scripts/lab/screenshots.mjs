#!/usr/bin/env node
// Mobile + desktop screenshots of the Idea Lab for checkpoint evidence
// (brief Phase 3 checkpoint; RTL.md §7 "open it and look"). Uses the
// preinstalled Chromium via Playwright.
//
//   BASE_URL=https://<preview> node scripts/lab/screenshots.mjs [--out docs/lab/checkpoint-3] [--devices iphone13,desktop] [--langs en,ar]

import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "@playwright/test";

const args = process.argv.slice(2);
const OUT = args.includes("--out") ? args[args.indexOf("--out") + 1] : "docs/lab/checkpoint-3";
const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const EMAIL = process.env.DEMO_EMAIL || "idea-lab-screens@example.com";
const CONSENT_VERSION = process.env.CONSENT_VERSION || "2026-09-v2";
fs.mkdirSync(OUT, { recursive: true });

// Prefer the preinstalled Chromium when Playwright's own download is absent.
const PREINSTALLED = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const executablePath = process.env.CHROMIUM_PATH || (fs.existsSync(PREINSTALLED) ? PREINSTALLED : undefined);
const browser = await chromium.launch({ executablePath });

// Navigate and retry until the page has actually hydrated (`ready` selector
// present). A flaky network can return the HTML but drop a JS chunk, which
// shows Next's generic "Application error" instead of the Lab page.
async function gotoRetry(page, url, tries = 5, ready = "main") {
  for (let i = 1; i <= tries; i += 1) {
    try {
      await page.goto(url, { waitUntil: "load", timeout: 45_000 });
      await page.locator(ready).first().waitFor({ timeout: 20_000 });
      await page.waitForTimeout(1200);
      const body = (await page.textContent("body")) || "";
      if (/Application error: a client-side exception/.test(body)) throw new Error("chunk load failed (Application error)");
      const styled = await page.evaluate(() => Array.from(document.styleSheets).some((sheet) => sheet.href && sheet.href.includes("/_next/static/css")));
      if (!styled) throw new Error("stylesheet did not load");
      return true;
    } catch (err) {
      console.log(`  retry ${i}/${tries} for ${url}: ${String(err).split("\n")[0]}`);
      await page.waitForTimeout(1500 * i);
    }
  }
  return false;
}

// The interview screen is ready when the composer exists, or when the page
// settled on an explicit unavailable/denied state (both are valid evidence).
const INTERVIEW_READY = "textarea, [data-lab-state='unavailable'], [data-lab-state='denied']";

async function shoot(ctx, url, name, opts = {}) {
  const page = await ctx.newPage();
  try {
    if (!(await gotoRetry(page, `${BASE}${url}`))) return console.log(`! ${name} skipped (navigation failed)`);
    if (opts.after) await opts.after(page);
    await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: opts.fullPage ?? true });
    console.log(`✓ ${name}`);
  } catch (err) {
    console.log(`! ${name}: ${String(err).split("\n")[0]}`);
  } finally {
    await page.close();
  }
}

// --devices iphone13,desktop (default both) lets a slow network run one pass at a time.
const ONLY = args.includes("--devices") ? args[args.indexOf("--devices") + 1].split(",") : ["iphone13", "desktop"];
const DEVICES = [["iphone13", devices["iPhone 13"]], ["desktop", { viewport: { width: 1280, height: 900 } }]].filter(([l]) => ONLY.includes(l));
const LANGS = args.includes("--langs") ? args[args.indexOf("--langs") + 1].split(",") : ["en", "ar"];
for (const [label, device] of DEVICES) {
  for (const lang of LANGS) {
    const ctx = await browser.newContext({ ...device, locale: lang === "ar" ? "ar-SA" : "en-US", ignoreHTTPSErrors: true, colorScheme: "dark", reducedMotion: "reduce" });
    await ctx.addCookies([{ name: "NEXT_LOCALE", value: lang, url: BASE }]);
    const prefix = lang === "ar" ? "/ar" : "";
    await shoot(ctx, `${prefix}/lab`, `${label}-${lang}-landing`);
    await shoot(ctx, `${prefix}/lab/resume`, `${label}-${lang}-resume`, { fullPage: false });
    await shoot(ctx, `${prefix}/lab/privacy`, `${label}-${lang}-privacy`, { fullPage: false });

    // Start a real session through the API so the interview screen renders
    // with a message; then capture the first assistant reply (or the graceful
    // error state if the model is unavailable).
    const page = await ctx.newPage();
    const start = await page.request.post(`${BASE}/api/lab/start`, {
      data: { name: lang === "ar" ? "نورة العلي" : "Nora Al-Ali", email: EMAIL.replace("@", `+${label}-${lang}@`), phone: "0501234567", country: "SA", company: lang === "ar" ? "مكتب الأمانة" : "Al-Amana Office", role: null, language: lang, consent: true, consentVersion: CONSENT_VERSION, turnstileToken: null, website: "" },
    });
    const started = await start.json();
    if (started.ok) {
      try {
        if (!(await gotoRetry(page, `${BASE}${started.url}`, 6, INTERVIEW_READY))) throw new Error("navigation failed");
        await page.screenshot({ path: path.join(OUT, `${label}-${lang}-interview-empty.png`), fullPage: false });
        const ta = page.locator("textarea").first();
        if ((await ta.count()) === 0) throw new Error("composer not rendered (unavailable/denied state captured instead)");
        await ta.fill(lang === "ar" ? "أدير مكتب ترجمة صغير في الرياض والطلبات تأتي على WhatsApp ونسعّرها يدويًا." : "I run a small translation office in Riyadh; requests arrive on WhatsApp and we quote by hand.");
        await ta.press("Enter");
        await page.locator("[data-turn-complete='true']").waitFor({ timeout: 90_000 }).catch(() => undefined);
        await page.waitForTimeout(800);
        await page.screenshot({ path: path.join(OUT, `${label}-${lang}-interview.png`), fullPage: false });
        console.log(`✓ ${label}-${lang}-interview`);
      } catch (err) {
        console.log(`! ${label}-${lang}-interview: ${String(err).split("\n")[0]}`);
      }
    } else {
      console.log(`! start failed for ${label}-${lang}: ${JSON.stringify(started)}`);
    }
    await page.close();
    await ctx.close();
  }
}
await browser.close();
console.log(`Saved to ${OUT}`);
