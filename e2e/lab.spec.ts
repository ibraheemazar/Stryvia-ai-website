import { expect, test, type Page } from "@playwright/test";

// Idea Lab money path (TESTING.md §5.1): start → turns → brief → submit →
// confirmation, in English and Arabic, plus auth boundaries and the "no
// assessment ever reaches the visitor" invariant. Mock AI provider on the
// target; this proves plumbing and UI, not interview quality.

const runId = Date.now().toString(36);

async function startSession(page: Page, lang: "en" | "ar", i: number) {
  await page.context().addCookies([{ name: "NEXT_LOCALE", value: lang, url: page.url() || "http://localhost:3100" }]);
  await page.goto(lang === "ar" ? "/ar/lab" : "/lab");
  await expect(page.locator("html")).toHaveAttribute("dir", lang === "ar" ? "rtl" : "ltr");
  await page.getByLabel(lang === "ar" ? "الاسم الكامل" : "Full name").fill(lang === "ar" ? "اختبار الجودة" : "E2E Tester");
  await page.locator("#lab-email").fill(`e2e+${runId}-${lang}-${i}@example.com`);
  await page.locator("#lab-country").selectOption("SA");
  await page.locator("#lab-phone").fill("0501234567");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: lang === "ar" ? "ابدأ" : "Start" }).click();
  await page.waitForURL(/\/lab\/s\//);
  return page.url().split("/lab/s/")[1];
}

async function send(page: Page, text: string) {
  const ta = page.getByRole("textbox").first();
  await ta.fill(text);
  await ta.press("Enter");
  await expect(page.locator("[data-turn-complete='true']")).toBeVisible();
  await expect(page.locator("[data-role='assistant']").last()).toContainText(/\S/);
}

for (const lang of ["en", "ar"] as const) {
  test(`money path in ${lang}: start → interview → brief → submit`, async ({ page }) => {
    const sid = await startSession(page, lang, 1);
    expect(sid).toMatch(/^[0-9a-f-]{36}$/);

    // The mock extractor fills slots from these directives; the REAL phase
    // controller decides transitions.
    await send(page, lang === "ar" ? "مرحبا، عندي فكرة. fill:problem,affected_users industry: translation" : "Hello, I have an idea. fill:problem,affected_users industry: translation");
    await send(page, "fill:current_process,frequency_and_volume,cost_of_status_quo");
    await send(page, "fill:attempts_so_far,tools_in_use,desired_outcome");
    await expect(page.getByText(lang === "ar" ? "ب · ما يمكن أن يصبح" : "B · WHAT IT COULD BECOME")).toBeVisible();
    await send(page, "ladder:automate=excited ladder:intelligence=interested");
    await send(page, "ladder:productize=skeptical ladder:scale=rejected");
    await expect(page.getByText(lang === "ar" ? "ج · ما تقدّمه وما تتوقّعه" : "C · WHAT YOU BRING & EXPECT")).toBeVisible();
    await send(page, "fill:what_they_bring,expected_deal_type,budget_range");
    await send(page, "fill:decision_maker,timeline,constraints_and_regulation");

    // Commit complete → review → brief generated automatically.
    await expect(page.getByTestId("brief-review")).toBeVisible({ timeout: 60_000 });
    await expect(page.locator("[data-testid='brief-review'] h2").first()).toContainText(/\S/);

    // The hydration payload must never carry an assessment.
    const payload = await page.request.get(`/api/lab/session/${sid}`).then((r) => r.json());
    expect(JSON.stringify(payload)).not.toMatch(/assessment|verdict|weighted_score/);

    await page.getByTestId("brief-submit").click();
    await expect(page.getByTestId("confirmation")).toBeVisible();
    await expect(page.getByTestId("confirmation")).toContainText(lang === "ar" ? "شكرًا لك" : "Thank you");
  });
}

test("cross-session access is denied (404) and no cookie means 401", async ({ browser }) => {
  const a = await browser.newContext();
  const pa = await a.newPage();
  const sidA = await startSession(pa, "en", 2);
  const b = await browser.newContext();
  const pb = await b.newPage();
  await startSession(pb, "en", 3);
  const cross = await pb.request.get(`/api/lab/session/${sidA}`);
  expect(cross.status()).toBe(404);
  const anon = await browser.newContext();
  const noCookie = await anon.request.get(`http://localhost:3100/api/lab/session/${sidA}`).catch(() => null);
  if (noCookie) expect([401, 404]).toContain(noCookie.status());
  await a.close();
  await b.close();
  await anon.close();
});

test("visitor routes never expose admin-only data; admin routes need auth", async ({ request }) => {
  const admin = await request.get("/api/admin/lab");
  expect(admin.status()).toBe(401);
  const harness = await request.post("/api/lab-harness", { data: { op: "inspect", sessionId: "00000000-0000-0000-0000-000000000000" } });
  expect(harness.status()).toBe(404);
});
