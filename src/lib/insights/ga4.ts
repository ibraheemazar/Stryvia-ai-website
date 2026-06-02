import "server-only";
import { googleAccessToken } from "@/lib/marketing/performance";

// Rich GA4 reporting for the admin analytics deep-dive. Pulls several reports
// from the GA4 Data API (overview KPIs, per-page, acquisition, events,
// devices, and a daily trend) in one pass. Hard-gated on credentials: with no
// GA4 env it reports configured:false and makes no calls. No fabricated data.

export type Ga4Range = "7d" | "30d" | "90d";

export type Ga4Insights = {
  configured: boolean;
  error?: string;
  range: Ga4Range;
  overview: {
    activeUsers: number;
    newUsers: number;
    sessions: number;
    screenPageViews: number;
    conversions: number;
    engagementRate: number; // 0..1
    averageSessionDuration: number; // seconds
    eventCount: number;
  };
  trend: { date: string; sessions: number; users: number; conversions: number }[];
  pages: { path: string; title: string; views: number; users: number; conversions: number; avgEngagement: number }[];
  acquisition: { channel: string; sessions: number; users: number; conversions: number }[];
  events: { name: string; count: number }[];
  devices: { device: string; sessions: number }[];
};

const RANGE_START: Record<Ga4Range, string> = {
  "7d": "7daysAgo",
  "30d": "30daysAgo",
  "90d": "90daysAgo",
};

type GaRow = { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] };
type GaResponse = { rows?: GaRow[]; metricHeaders?: { name: string }[] };

function num(v: string | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function runReport(
  property: string,
  token: string,
  body: Record<string, unknown>,
): Promise<GaResponse> {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${property}:runReport`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throw new Error(`GA4 report ${res.status}`);
  return (await res.json()) as GaResponse;
}

function emptyOverview(): Ga4Insights["overview"] {
  return {
    activeUsers: 0,
    newUsers: 0,
    sessions: 0,
    screenPageViews: 0,
    conversions: 0,
    engagementRate: 0,
    averageSessionDuration: 0,
    eventCount: 0,
  };
}

export async function getGa4Insights(range: Ga4Range = "30d"): Promise<Ga4Insights> {
  const property = process.env.GA4_PROPERTY_ID;
  const base: Ga4Insights = {
    configured: false,
    range,
    overview: emptyOverview(),
    trend: [],
    pages: [],
    acquisition: [],
    events: [],
    devices: [],
  };
  if (!property || !process.env.GA4_CREDENTIALS_JSON) return base;

  try {
    const token = await googleAccessToken("https://www.googleapis.com/auth/analytics.readonly");
    if (!token) return { ...base, configured: true, error: "auth failed" };

    const dateRanges = [{ startDate: RANGE_START[range], endDate: "today" }];

    const [overviewR, trendR, pagesR, acqR, eventsR, devicesR] = await Promise.all([
      runReport(property, token, {
        dateRanges,
        metrics: [
          { name: "activeUsers" },
          { name: "newUsers" },
          { name: "sessions" },
          { name: "screenPageViews" },
          { name: "conversions" },
          { name: "engagementRate" },
          { name: "averageSessionDuration" },
          { name: "eventCount" },
        ],
      }),
      runReport(property, token, {
        dateRanges,
        dimensions: [{ name: "date" }],
        metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "conversions" }],
        orderBys: [{ dimension: { dimensionName: "date" } }],
        limit: 100,
      }),
      runReport(property, token, {
        dateRanges,
        dimensions: [{ name: "pagePath" }, { name: "pageTitle" }],
        metrics: [
          { name: "screenPageViews" },
          { name: "activeUsers" },
          { name: "conversions" },
          { name: "userEngagementDuration" },
        ],
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        limit: 25,
      }),
      runReport(property, token, {
        dateRanges,
        dimensions: [{ name: "sessionDefaultChannelGroup" }],
        metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "conversions" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 12,
      }),
      runReport(property, token, {
        dateRanges,
        dimensions: [{ name: "eventName" }],
        metrics: [{ name: "eventCount" }],
        orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
        limit: 20,
      }),
      runReport(property, token, {
        dateRanges,
        dimensions: [{ name: "deviceCategory" }],
        metrics: [{ name: "sessions" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      }),
    ]);

    const ov = overviewR.rows?.[0]?.metricValues ?? [];
    const overview: Ga4Insights["overview"] = {
      activeUsers: num(ov[0]?.value),
      newUsers: num(ov[1]?.value),
      sessions: num(ov[2]?.value),
      screenPageViews: num(ov[3]?.value),
      conversions: num(ov[4]?.value),
      engagementRate: num(ov[5]?.value),
      averageSessionDuration: num(ov[6]?.value),
      eventCount: num(ov[7]?.value),
    };

    const trend = (trendR.rows ?? []).map((r) => {
      const d = r.dimensionValues?.[0]?.value ?? "";
      return {
        date: d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : d,
        sessions: num(r.metricValues?.[0]?.value),
        users: num(r.metricValues?.[1]?.value),
        conversions: num(r.metricValues?.[2]?.value),
      };
    });

    const pages = (pagesR.rows ?? []).map((r) => {
      const views = num(r.metricValues?.[0]?.value);
      const users = num(r.metricValues?.[1]?.value);
      return {
        path: r.dimensionValues?.[0]?.value ?? "",
        title: r.dimensionValues?.[1]?.value ?? "",
        views,
        users,
        conversions: num(r.metricValues?.[2]?.value),
        avgEngagement: users ? Math.round(num(r.metricValues?.[3]?.value) / users) : 0,
      };
    });

    const acquisition = (acqR.rows ?? []).map((r) => ({
      channel: r.dimensionValues?.[0]?.value ?? "Unassigned",
      sessions: num(r.metricValues?.[0]?.value),
      users: num(r.metricValues?.[1]?.value),
      conversions: num(r.metricValues?.[2]?.value),
    }));

    const events = (eventsR.rows ?? []).map((r) => ({
      name: r.dimensionValues?.[0]?.value ?? "",
      count: num(r.metricValues?.[0]?.value),
    }));

    const devices = (devicesR.rows ?? []).map((r) => ({
      device: r.dimensionValues?.[0]?.value ?? "",
      sessions: num(r.metricValues?.[0]?.value),
    }));

    return { configured: true, range, overview, trend, pages, acquisition, events, devices };
  } catch (err) {
    return { ...base, configured: true, error: String(err) };
  }
}
