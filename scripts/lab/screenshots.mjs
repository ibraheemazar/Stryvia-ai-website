#!/usr/bin/env node
// Mobile + desktop screenshots of the Idea Lab for checkpoint evidence
// (brief Phase 3 checkpoint; RTL.md §7 "open it and look"). Uses the
// preinstalled Chromium via Playwright.
//
//   BASE_URL=https://<preview> node scripts/lab/screenshots.mjs [--out docs/lab/checkpoint-3]

import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "@playwright/test";

const args = process.argv.slice(2);
const OUT = args.includes("--out") ? args[args.indexOf("--out") + 1] : "docs/lab/checkpoint-3";
const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const EMAIL = process.env.DEMO_EMAIL || "idea-lab-screens@example.com";
const CONSENT_VERSION = process.env.CONSENT_VERSION || "2026-09-v2";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

async function shoot(ctx, url, name, opts = {}) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle" });
  if (opts.after) await opts.after(page);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: opts.fullPage ?? true });
  await page.close();
  console.log(`✓ ${name}`);
}

for (const [label, device] of [["iphone13", devices["iPhone 13"]], ["desktop", { viewport: { width: 1280, height: 900 } }]]) {
  for (const lang of ["en", "ar"]) {
    const ctx = await browser.newContext({ ...device, locale: lang === "ar" ? "ar-SA" : "en-US" });
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
      await page.goto(`${BASE}${started.url}`, { waitUntil: "networkidle" });
      await page.screenshot({ path: path.join(OUT, `${label}-${lang}-interview-empty.png`), fullPage: false });
      const ta = page.getByRole("textbox").first();
      await ta.fill(lang === "ar" ? "أدير مكتب ترجمة صغير في الرياض والطلبات تأتي على WhatsApp ونسعّرها يدويًا." : "I run a small translation office in Riyadh; requests arrive on WhatsApp and we quote by hand.");
      await ta.press("Enter");
      await page.locator("[data-turn-complete='true']").waitFor({ timeout: 90_000 }).catch(() => undefined);
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(OUT, `${label}-${lang}-interview.png`), fullPage: false });
      console.log(`✓ ${label}-${lang}-interview`);
    } else {
      console.log(`! start failed for ${label}-${lang}: ${JSON.stringify(started)}`);
    }
    await page.close();
    await ctx.close();
  }
}
await browser.close();
console.log(`Saved to ${OUT}`);
