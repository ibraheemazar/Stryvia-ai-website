import "server-only";
import crypto from "node:crypto";

// Ad/analytics performance connectors. Every fetcher is hard-gated by the
// presence of its credentials: with no env, it reports `configured: false` and
// makes no calls (so nothing can break). Add the credentials and it pulls live
// data. No fabricated numbers, ever.

export type ChannelMetric = {
  provider: string;
  label: string;
  configured: boolean;
  metrics?: { spend?: number; impressions?: number; clicks?: number; conversions?: number };
  note?: string;
  error?: string;
};

// ---- Google service-account auth (GA4, Search Console) -------------------
async function googleAccessToken(scope: string): Promise<string | null> {
  const raw = process.env.GA4_CREDENTIALS_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  let creds: { client_email: string; private_key: string };
  try {
    creds = JSON.parse(raw);
  } catch {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: creds.client_email,
    scope,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64(header)}.${b64(claim)}`;
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(unsigned)
    .sign(creds.private_key.replace(/\\n/g, "\n"), "base64url");
  const jwt = `${unsigned}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { access_token?: string };
  return data.access_token ?? null;
}

async function fetchMeta(): Promise<ChannelMetric> {
  const token = process.env.META_ACCESS_TOKEN;
  const account = process.env.META_AD_ACCOUNT_ID;
  if (!token || !account) return { provider: "meta_ads", label: "Meta Ads", configured: false };
  try {
    const url = `https://graph.facebook.com/v21.0/act_${account}/insights?fields=spend,impressions,clicks&date_preset=last_30d&access_token=${token}`;
    const res = await fetch(url);
    const json = (await res.json()) as { data?: { spend?: string; impressions?: string; clicks?: string }[] };
    const d = json.data?.[0];
    return {
      provider: "meta_ads",
      label: "Meta Ads",
      configured: true,
      metrics: {
        spend: d?.spend ? Number(d.spend) : 0,
        impressions: d?.impressions ? Number(d.impressions) : 0,
        clicks: d?.clicks ? Number(d.clicks) : 0,
      },
    };
  } catch (err) {
    return { provider: "meta_ads", label: "Meta Ads", configured: true, error: String(err) };
  }
}

async function fetchGA4(): Promise<ChannelMetric> {
  const property = process.env.GA4_PROPERTY_ID;
  if (!property || !process.env.GA4_CREDENTIALS_JSON) {
    return { provider: "ga4", label: "Google Analytics 4", configured: false };
  }
  try {
    const token = await googleAccessToken("https://www.googleapis.com/auth/analytics.readonly");
    if (!token) return { provider: "ga4", label: "Google Analytics 4", configured: true, error: "auth failed" };
    const res = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${property}:runReport`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
          metrics: [{ name: "sessions" }, { name: "conversions" }],
        }),
      },
    );
    const json = (await res.json()) as { rows?: { metricValues?: { value: string }[] }[] };
    const row = json.rows?.[0]?.metricValues;
    return {
      provider: "ga4",
      label: "Google Analytics 4",
      configured: true,
      metrics: {
        clicks: row?.[0] ? Number(row[0].value) : 0,
        conversions: row?.[1] ? Number(row[1].value) : 0,
      },
      note: "sessions / conversions",
    };
  } catch (err) {
    return { provider: "ga4", label: "Google Analytics 4", configured: true, error: String(err) };
  }
}

async function fetchSearchConsole(): Promise<ChannelMetric> {
  const site = process.env.SEARCH_CONSOLE_SITE;
  if (!site || !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return { provider: "search_console", label: "Search Console", configured: false };
  }
  try {
    const token = await googleAccessToken("https://www.googleapis.com/auth/webmasters.readonly");
    if (!token) return { provider: "search_console", label: "Search Console", configured: true, error: "auth failed" };
    const end = new Date().toISOString().slice(0, 10);
    const start = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const res = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: start, endDate: end }),
      },
    );
    const json = (await res.json()) as { rows?: { clicks: number; impressions: number }[] };
    const r = json.rows?.[0];
    return {
      provider: "search_console",
      label: "Search Console",
      configured: true,
      metrics: { clicks: r?.clicks ?? 0, impressions: r?.impressions ?? 0 },
      note: "organic search",
    };
  } catch (err) {
    return { provider: "search_console", label: "Search Console", configured: true, error: String(err) };
  }
}

async function fetchGoogleAds(): Promise<ChannelMetric> {
  const dev = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const cid = process.env.GOOGLE_ADS_CLIENT_ID;
  const secret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const refresh = process.env.GOOGLE_ADS_REFRESH_TOKEN;
  const customer = process.env.GOOGLE_ADS_CUSTOMER_ID;
  if (!dev || !cid || !secret || !refresh || !customer) {
    return { provider: "google_ads", label: "Google Ads", configured: false };
  }
  try {
    const tokRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: cid,
        client_secret: secret,
        refresh_token: refresh,
      }),
    });
    const tok = (await tokRes.json()) as { access_token?: string };
    if (!tok.access_token) return { provider: "google_ads", label: "Google Ads", configured: true, error: "auth failed" };

    const res = await fetch(
      `https://googleads.googleapis.com/v18/customers/${customer}/googleAds:searchStream`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tok.access_token}`,
          "developer-token": dev,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query:
            "SELECT metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions FROM customer WHERE segments.date DURING LAST_30_DAYS",
        }),
      },
    );
    const json = (await res.json()) as { results?: { metrics?: Record<string, string> }[] }[] | { results?: { metrics?: Record<string, string> }[] };
    const results = Array.isArray(json) ? json.flatMap((b) => b.results ?? []) : json.results ?? [];
    let spend = 0,
      impressions = 0,
      clicks = 0,
      conversions = 0;
    for (const r of results) {
      const m = r.metrics || {};
      spend += Number(m.costMicros || 0) / 1e6;
      impressions += Number(m.impressions || 0);
      clicks += Number(m.clicks || 0);
      conversions += Number(m.conversions || 0);
    }
    return {
      provider: "google_ads",
      label: "Google Ads",
      configured: true,
      metrics: { spend, impressions, clicks, conversions },
    };
  } catch (err) {
    return { provider: "google_ads", label: "Google Ads", configured: true, error: String(err) };
  }
}

export async function getPerformance(): Promise<ChannelMetric[]> {
  return Promise.all([fetchMeta(), fetchGoogleAds(), fetchGA4(), fetchSearchConsole()]);
}
