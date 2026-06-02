"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { INTEGRATIONS, CATEGORY_LABELS, type IntegrationCategory } from "@/lib/marketing/integrations";
import { AnalyticsView } from "@/app/supadmin/insights/AnalyticsView";

type Tab =
  | "overview"
  | "intelligence"
  | "content"
  | "audiences"
  | "email"
  | "automations"
  | "landing"
  | "performance"
  | "channels";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Command center" },
  { id: "intelligence", label: "Conversations" },
  { id: "content", label: "Content studio" },
  { id: "audiences", label: "Audiences" },
  { id: "email", label: "Email" },
  { id: "automations", label: "Automations" },
  { id: "landing", label: "Landing & A/B" },
  { id: "performance", label: "Performance" },
  { id: "channels", label: "Channels" },
];

function useApi(token: string) {
  return useCallback(
    async (path: string, init?: RequestInit) => {
      const res = await fetch(`/api/admin/marketing${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(init?.body ? { "Content-Type": "application/json" } : {}),
          ...(init?.headers || {}),
        },
      });
      return res.json();
    },
    [token],
  );
}

export function MarketingDashboard({ token }: { token: string }) {
  const [tab, setTab] = useState<Tab>("overview");
  const api = useApi(token);

  return (
    <div className="mx-auto max-w-[1320px] px-6 py-8">
      <div className="mb-8 flex flex-wrap gap-1 border-b border-sv-line pb-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-sv-sm px-3.5 py-1.5 text-sv-small transition-colors",
              tab === t.id ? "bg-sv-surface-3 text-sv-text" : "text-sv-text-3 hover:text-sv-text",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <Overview api={api} />}
      {tab === "intelligence" && <Intelligence api={api} />}
      {tab === "content" && <ContentStudio api={api} />}
      {tab === "audiences" && <Audiences api={api} />}
      {tab === "email" && <EmailCampaigns api={api} />}
      {tab === "automations" && <Automations api={api} />}
      {tab === "landing" && <Landing api={api} />}
      {tab === "performance" && <Performance api={api} token={token} />}
      {tab === "channels" && <Channels api={api} />}
    </div>
  );
}

type Api = (path: string, init?: RequestInit) => Promise<Record<string, unknown>>;

// ---------------------------------------------------------------- Command center
function Overview({ api }: { api: Api }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => setData(await api("?section=home")), [api]);
  useEffect(() => {
    load();
  }, [load]);

  if (!data) return <Loading />;
  if (!data.ok) return <Disconnected />;

  const o = data.overview as Overview2 | null;
  const insights = (data.insights as Insight[]) || [];
  const integrations = (data.integrations as IntegrationRow[]) || [];
  const connected = integrations.filter((i) => i.status === "connected").length;

  async function runAdvisor() {
    setBusy(true);
    await api("/advisor", { method: "POST", body: "{}" });
    await load();
    setBusy(false);
  }

  if (!o)
    return (
      <p className="text-sv-small text-sv-text-3">
        No data yet — once visitors talk to the Chat, the command center fills in.
      </p>
    );

  const maxTrend = Math.max(1, ...o.trend.map((d) => d.conversations));

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="CONVERSATIONS (30D)" value={o.totals.conversations} sub={`+${o.totals.last7Conversations} last 7d`} />
        <Stat label="LEADS (30D)" value={o.totals.leads} sub={`+${o.totals.last7Leads} last 7d`} live />
        <Stat label="CONVERSION RATE" value={`${o.totals.conversionRate}%`} live />
        <Stat label="CHANNELS CONNECTED" value={`${connected}/${integrations.length}`} />
      </div>

      {/* funnel */}
      <Panel title="FUNNEL">
        <div className="space-y-2">
          {o.funnel.map((f) => {
            const top = o.funnel[0].value || 1;
            return (
              <div key={f.label} className="flex items-center gap-3">
                <span className="w-32 text-sv-small text-sv-text-2">{f.label}</span>
                <div className="h-6 flex-1 overflow-hidden rounded-sv-sm bg-sv-surface-2">
                  <div className="h-full bg-sv-green-soft" style={{ width: `${(f.value / top) * 100}%` }} />
                </div>
                <span className="w-12 text-end font-mono text-sv-small text-sv-text">{f.value}</span>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* trend */}
      <Panel title="DAILY CONVERSATIONS (30D)">
        <div className="flex h-28 items-end gap-1">
          {o.trend.map((d) => (
            <div
              key={d.day}
              title={`${d.day}: ${d.conversations} conversations, ${d.leads} leads`}
              className="flex-1 rounded-t-sm bg-sv-green/60"
              style={{ height: `${(d.conversations / maxTrend) * 100}%`, minHeight: 2 }}
            />
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="TOP PROBLEM CATEGORIES">
          <BarList items={o.byCategory.slice(0, 8).map((c) => ({ label: c.category.replace(/_/g, " "), value: c.conversations }))} />
        </Panel>
        <Panel title="BY SOURCE (ATTRIBUTION)">
          <BarList items={o.bySource.slice(0, 8).map((s) => ({ label: s.source, value: s.conversations }))} />
        </Panel>
      </div>

      {/* AI advisor */}
      <Panel
        title="AI GROWTH ADVISOR"
        action={
          <button
            onClick={runAdvisor}
            disabled={busy}
            className="rounded-sv-sm bg-sv-green px-3 py-1 text-sv-label-sm font-medium uppercase tracking-wider text-sv-ink disabled:opacity-60"
          >
            {busy ? "Analysing…" : "Generate recommendations"}
          </button>
        }
      >
        {insights.length === 0 ? (
          <p className="text-sv-small text-sv-text-3">
            Run the advisor — Stryvia Intelligence reads your real funnel and returns prioritised moves.
          </p>
        ) : (
          <div className="space-y-3">
            {insights.map((i) => (
              <div key={i.id} className="rounded-sv-sm border border-sv-line bg-sv-surface-2/40 p-3">
                <p
                  className={cn(
                    "sv-label-sm sv-label",
                    i.severity === "opportunity" && "sv-label--live",
                    i.severity === "warning" && "text-sv-warn",
                  )}
                >
                  {i.severity} · {i.title}
                </p>
                <p className="mt-1 text-sv-small text-sv-text-2">{i.body}</p>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------- Intelligence
function Intelligence({ api }: { api: Api }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    api("?section=home").then(setData);
  }, [api]);
  if (!data) return <Loading />;
  const intel = data.intelligence as
    | { topCategories: { category: string; count: number; rate: number }[]; recentAsks: RecentAsk[] }
    | null;
  if (!intel) return <Disconnected />;

  return (
    <div className="space-y-8">
      <p className="max-w-2xl text-sv-small text-sv-text-2">
        Your sharpest, hardest-to-copy signal: what the market is asking for, in their own words. This
        feeds targeting, content, and messaging no competitor can replicate.
      </p>
      <UnifiedLearnings api={api} />
      <Panel title="WHAT THE MARKET ASKS FOR — BY CATEGORY">
        <div className="space-y-2">
          {intel.topCategories.map((c) => (
            <div key={c.category} className="flex items-center gap-3">
              <span className="w-48 truncate text-sv-small text-sv-text-2">
                {c.category.replace(/_/g, " ")}
              </span>
              <div className="h-5 flex-1 overflow-hidden rounded-sv-sm bg-sv-surface-2">
                <div
                  className="h-full bg-sv-green-soft"
                  style={{ width: `${(c.count / (intel.topCategories[0]?.count || 1)) * 100}%` }}
                />
              </div>
              <span className="w-10 text-end font-mono text-sv-small text-sv-text">{c.count}</span>
              <span className="w-14 text-end font-mono text-sv-label-sm text-sv-green">{c.rate}%</span>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="RECENT ASKS">
        <div className="space-y-2">
          {intel.recentAsks.map((a, i) => (
            <div key={i} className="flex items-start gap-3 border-b border-sv-line pb-2">
              <span
                className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", a.converted ? "bg-sv-green" : "bg-sv-line-strong")}
              />
              <p className="flex-1 text-sv-small text-sv-text-2">{a.summary}</p>
              <span className="shrink-0 text-sv-label-sm uppercase text-sv-text-3">
                {a.category.replace(/_/g, " ")} · {a.locale}
              </span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

// Unified learnings: one AI-synthesized brief across the whole conversation
// corpus — top requests, friction, gaps, and prioritised moves.
function UnifiedLearnings({ api }: { api: Api }) {
  const [row, setRow] = useState<LearningRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const d = await api("?section=learnings");
    setRow((d.learning as LearningRow) ?? null);
    setLoaded(true);
  }, [api]);
  useEffect(() => {
    load();
  }, [load]);

  async function generate() {
    setBusy(true);
    const d = await api("/learnings", { method: "POST", body: "{}" });
    if (d.ok && d.learning) setRow(d.learning as LearningRow);
    setBusy(false);
  }

  const p = row?.payload;

  return (
    <Panel
      title="UNIFIED LEARNINGS — WHAT TO DO BETTER"
      action={
        <button
          onClick={generate}
          disabled={busy}
          className="rounded-sv-sm bg-sv-green px-3 py-1 text-sv-label-sm font-medium uppercase tracking-wider text-sv-ink disabled:opacity-60"
        >
          {busy ? "Synthesising…" : row ? "Regenerate" : "Generate"}
        </button>
      }
    >
      {!p ? (
        <p className="text-sv-small text-sv-text-3">
          {loaded
            ? "Synthesise every conversation into one brief — the top requests, the friction costing conversions, messaging and product gaps, and the prioritised moves to do better."
            : "Loading…"}
        </p>
      ) : (
        <div className="space-y-6">
          {row && (
            <p className="text-sv-label-sm text-sv-text-3">
              {row.conversations_analyzed} conversations · {new Date(row.created_at).toLocaleString()}
            </p>
          )}
          {p.summary && <p className="text-sv-body text-sv-text-2">{p.summary}</p>}

          {p.topRequests && p.topRequests.length > 0 && (
            <div>
              <p className="sv-label sv-label-sm mb-2">TOP REQUESTS</p>
              <div className="space-y-2">
                {p.topRequests.map((r, i) => (
                  <div key={i} className="flex items-start gap-3 border-b border-sv-line pb-2">
                    <span className="w-8 shrink-0 font-mono text-sv-small text-sv-green">{r.count}</span>
                    <div className="flex-1">
                      <p className="text-sv-small text-sv-text">{r.request}</p>
                      {r.note && <p className="text-sv-label-sm text-sv-text-3">{r.note}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            <LearnList title="FRICTION" items={p.friction} />
            <LearnList title="MESSAGING GAPS" items={p.messagingGaps} />
            <LearnList title="PRODUCT GAPS" items={p.productGaps} />
          </div>

          {p.recommendations && p.recommendations.length > 0 && (
            <div>
              <p className="sv-label sv-label-sm mb-2">DO BETTER — PRIORITISED</p>
              <div className="space-y-2">
                {p.recommendations.map((rec, i) => (
                  <div key={i} className="rounded-sv-sm border border-sv-line bg-sv-surface-2/40 p-3">
                    <p
                      className={cn(
                        "sv-label-sm sv-label",
                        rec.priority === "high" && "sv-label--live",
                        rec.priority === "medium" && "text-sv-warn",
                      )}
                    >
                      {rec.priority} · {rec.title}
                    </p>
                    <p className="mt-1 text-sv-small text-sv-text-2">{rec.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

function LearnList({ title, items }: { title: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="sv-label sv-label-sm mb-2">{title}</p>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2 text-sv-small text-sv-text-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-sv-line-strong" />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- Content studio
const CONTENT_TYPES = [
  ["ad_copy", "Ad copy"],
  ["social_post", "Social post"],
  ["email", "Email"],
  ["blog", "Blog / article"],
  ["landing", "Landing page"],
  ["sms", "SMS"],
  ["whatsapp", "WhatsApp"],
] as const;

function ContentStudio({ api }: { api: Api }) {
  const [type, setType] = useState("social_post");
  const [channel, setChannel] = useState("");
  const [locale, setLocale] = useState("en");
  const [brief, setBrief] = useState("");
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  const [library, setLibrary] = useState<ContentRow[]>([]);

  const loadLib = useCallback(async () => {
    const d = await api("?section=content");
    setLibrary((d.content as ContentRow[]) || []);
  }, [api]);
  useEffect(() => {
    loadLib();
  }, [loadLib]);

  async function generate() {
    setBusy(true);
    setOut("");
    const d = await api("/content", {
      method: "POST",
      body: JSON.stringify({ action: "generate", type, channel, locale, brief }),
    });
    setOut((d.text as string) || "");
    setBusy(false);
  }
  async function save() {
    await api("/content", {
      method: "POST",
      body: JSON.stringify({ action: "save", type, channel, locale, body: out }),
    });
    setOut("");
    loadLib();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
      <div>
        <Panel title="GENERATE — ON-BRAND, GUARDRAILED">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Select value={type} onChange={setType} options={CONTENT_TYPES.map(([v, l]) => [v, l])} />
              <input
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                placeholder="Channel (meta, google…)"
                className={inputCls}
              />
              <Select value={locale} onChange={setLocale} options={[["en", "English"], ["ar", "Arabic"], ["fr", "French"]]} />
            </div>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Brief: what's it for, the offer, the audience, the goal…"
              className={cn(inputCls, "min-h-28 w-full resize-none")}
            />
            <button
              onClick={generate}
              disabled={busy || !brief.trim()}
              className="rounded-sv-sm bg-sv-green px-4 py-2 text-sv-small font-medium text-sv-ink disabled:opacity-60"
            >
              {busy ? "Generating…" : "Generate"}
            </button>
          </div>
        </Panel>
        {out && (
          <Panel title="OUTPUT" className="mt-4">
            <pre className="whitespace-pre-wrap font-sans text-sv-small text-sv-text-2">{out}</pre>
            <div className="mt-3 flex gap-2">
              <button onClick={save} className="rounded-sv-sm border border-sv-green-line px-3 py-1 text-sv-small text-sv-green">
                Save to library
              </button>
              <button onClick={generate} className="rounded-sv-sm border border-sv-line px-3 py-1 text-sv-small text-sv-text-2">
                Regenerate
              </button>
            </div>
          </Panel>
        )}
      </div>
      <Panel title={`CONTENT LIBRARY (${library.length})`}>
        <div className="space-y-2">
          {library.length === 0 && <p className="text-sv-small text-sv-text-3">Saved content appears here.</p>}
          {library.map((c) => (
            <div key={c.id} className="rounded-sv-sm border border-sv-line bg-sv-surface-2/40 p-3">
              <p className="sv-label-sm sv-label">
                {c.type.replace(/_/g, " ")} {c.channel ? `· ${c.channel}` : ""} · {c.locale} · {c.status}
              </p>
              <p className="mt-1 line-clamp-3 text-sv-small text-sv-text-2">{c.body}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------- Audiences
function Audiences({ api }: { api: Api }) {
  const [segments, setSegments] = useState<SegmentRow[]>([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [locale, setLocale] = useState("");
  const [converted, setConverted] = useState("");
  const [preview, setPreview] = useState<number | null>(null);

  const load = useCallback(async () => {
    const d = await api("?section=segments");
    setSegments((d.segments as SegmentRow[]) || []);
  }, [api]);
  useEffect(() => {
    load();
  }, [load]);

  function rules() {
    const r: Record<string, unknown> = {};
    if (category) r.category = category;
    if (locale) r.locale = locale;
    if (converted) r.converted = converted === "yes";
    return r;
  }
  async function doPreview() {
    const d = await api("/segments", { method: "POST", body: JSON.stringify({ action: "preview", rules: rules() }) });
    setPreview((d.count as number) ?? 0);
  }
  async function create() {
    await api("/segments", { method: "POST", body: JSON.stringify({ action: "create", name: name || "Segment", rules: rules() }) });
    setName("");
    setPreview(null);
    load();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
      <Panel title="BUILD A SEGMENT">
        <div className="space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Segment name" className={cn(inputCls, "w-full")} />
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Problem category (e.g. product_or_app)" className={cn(inputCls, "w-full")} />
          <div className="flex gap-2">
            <Select value={locale} onChange={setLocale} options={[["", "Any language"], ["en", "English"], ["ar", "Arabic"]]} />
            <Select value={converted} onChange={setConverted} options={[["", "Any"], ["yes", "Converted"], ["no", "Not converted"]]} />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={doPreview} className="rounded-sv-sm border border-sv-line px-3 py-1.5 text-sv-small text-sv-text-2">
              Preview audience
            </button>
            {preview !== null && <span className="text-sv-small text-sv-green">{preview} leads</span>}
            <button onClick={create} disabled={!name} className="rounded-sv-sm bg-sv-green px-3 py-1.5 text-sv-small font-medium text-sv-ink disabled:opacity-60">
              Save segment
            </button>
          </div>
        </div>
      </Panel>
      <Panel title={`SEGMENTS (${segments.length})`}>
        <div className="space-y-2">
          {segments.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-sv-sm border border-sv-line bg-sv-surface-2/40 p-3">
              <div>
                <p className="text-sv-small text-sv-text">{s.name}</p>
                <p className="text-sv-label-sm text-sv-text-3">{JSON.stringify(s.rules)}</p>
              </div>
              <span className="font-mono text-sv-small text-sv-green">{s.count}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------- Email
function EmailCampaigns({ api }: { api: Api }) {
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [category, setCategory] = useState("");
  const [converted, setConverted] = useState("yes");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function rules() {
    const r: Record<string, unknown> = {};
    if (category) r.category = category;
    if (converted) r.converted = converted === "yes";
    return r;
  }
  async function send() {
    setBusy(true);
    setStatus(null);
    const d = await api("/email", {
      method: "POST",
      body: JSON.stringify({ name: subject, subject, body: bodyText, rules: rules() }),
    });
    if (d.ok) setStatus(`Sent to ${d.sent}/${d.audience} (failed ${d.failed}).`);
    else setStatus(d.reason === "ses_not_configured" ? "Connect SES to send." : `Couldn't send: ${d.reason}`);
    setBusy(false);
  }

  return (
    <Panel title="EMAIL CAMPAIGN">
      <div className="max-w-2xl space-y-3">
        <p className="text-sv-small text-sv-text-3">Sends via Amazon SES to leads matching the audience.</p>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject line" className={cn(inputCls, "w-full")} />
        <textarea value={bodyText} onChange={(e) => setBodyText(e.target.value)} placeholder="Email body…" className={cn(inputCls, "min-h-40 w-full resize-none")} />
        <div className="flex flex-wrap items-center gap-2">
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category filter (optional)" className={inputCls} />
          <Select value={converted} onChange={setConverted} options={[["yes", "Converted leads"], ["", "All leads"]]} />
          <button onClick={send} disabled={busy || !subject || !bodyText} className="rounded-sv-sm bg-sv-green px-4 py-2 text-sv-small font-medium text-sv-ink disabled:opacity-60">
            {busy ? "Sending…" : "Send campaign"}
          </button>
        </div>
        {status && <p className="text-sv-small text-sv-text-2">{status}</p>}
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------- Automations
function Automations({ api }: { api: Api }) {
  const [list, setList] = useState<AutomationRow[]>([]);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [actEmailSubject, setActEmailSubject] = useState("");
  const [actEmailBody, setActEmailBody] = useState("");
  const [actStatus, setActStatus] = useState("");
  const [actWhatsapp, setActWhatsapp] = useState("");
  const [actSms, setActSms] = useState("");
  const [actSlack, setActSlack] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const d = await api("?section=automations");
    setList((d.automations as AutomationRow[]) || []);
    setRuns((d.runs as RunRow[]) || []);
  }, [api]);
  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    const actions: { type: string; params: Record<string, unknown> }[] = [];
    if (actEmailSubject && actEmailBody) actions.push({ type: "send_email", params: { subject: actEmailSubject, body: actEmailBody } });
    if (actWhatsapp) actions.push({ type: "send_whatsapp", params: { message: actWhatsapp } });
    if (actSms) actions.push({ type: "send_sms", params: { message: actSms } });
    if (actSlack) actions.push({ type: "slack_notify", params: { message: actSlack } });
    if (actStatus) actions.push({ type: "set_lead_status", params: { status: actStatus } });
    await api("/automations", {
      method: "POST",
      body: JSON.stringify({
        action: "create",
        name: name || "Automation",
        trigger: { event: "lead_created", filters: category ? { category } : {} },
        actions,
        enabled: true,
      }),
    });
    setName("");
    setActEmailSubject("");
    setActEmailBody("");
    load();
  }
  async function toggle(id: string, enabled: boolean) {
    await api("/automations", { method: "POST", body: JSON.stringify({ action: "toggle", id, enabled }) });
    load();
  }
  async function runNow() {
    const d = await api("/automations", { method: "POST", body: JSON.stringify({ action: "run" }) });
    setMsg(`Actioned ${d.actioned} lead(s).`);
    load();
  }

  return (
    <div className="space-y-8">
      <Panel title="NEW AUTOMATION" action={<button onClick={runNow} className="rounded-sv-sm border border-sv-green-line px-3 py-1 text-sv-label-sm uppercase tracking-wider text-sv-green">Run now</button>}>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-3">
            <p className="sv-label-sm sv-label">WHEN — a lead matches</p>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Automation name" className={cn(inputCls, "w-full")} />
            <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category filter (optional)" className={cn(inputCls, "w-full")} />
          </div>
          <div className="space-y-3">
            <p className="sv-label-sm sv-label">THEN — do</p>
            <input value={actEmailSubject} onChange={(e) => setActEmailSubject(e.target.value)} placeholder="Send email — subject" className={cn(inputCls, "w-full")} />
            <textarea value={actEmailBody} onChange={(e) => setActEmailBody(e.target.value)} placeholder="Send email — body" className={cn(inputCls, "min-h-20 w-full resize-none")} />
            <input value={actWhatsapp} onChange={(e) => setActWhatsapp(e.target.value)} placeholder="Send WhatsApp — message (needs phone + WhatsApp connected)" className={cn(inputCls, "w-full")} />
            <input value={actSms} onChange={(e) => setActSms(e.target.value)} placeholder="Send SMS — message (needs phone + SMS connected)" className={cn(inputCls, "w-full")} />
            <input value={actSlack} onChange={(e) => setActSlack(e.target.value)} placeholder="Slack alert — message" className={cn(inputCls, "w-full")} />
            <input value={actStatus} onChange={(e) => setActStatus(e.target.value)} placeholder="Set lead status (e.g. contacted)" className={cn(inputCls, "w-full")} />
          </div>
        </div>
        <button onClick={create} disabled={!name} className="mt-3 rounded-sv-sm bg-sv-green px-4 py-2 text-sv-small font-medium text-sv-ink disabled:opacity-60">
          Create & enable
        </button>
        {msg && <p className="mt-2 text-sv-small text-sv-green">{msg}</p>}
      </Panel>

      <Panel title={`AUTOMATIONS (${list.length})`}>
        <div className="space-y-2">
          {list.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-sv-sm border border-sv-line bg-sv-surface-2/40 p-3">
              <div>
                <p className="text-sv-small text-sv-text">{a.name}</p>
                <p className="text-sv-label-sm text-sv-text-3">runs: {a.run_count} · actions: {(a.actions || []).length}</p>
              </div>
              <button
                onClick={() => toggle(a.id, !a.enabled)}
                className={cn(
                  "rounded-sv-pill px-3 py-1 text-sv-label-sm uppercase tracking-wider",
                  a.enabled ? "bg-sv-green-soft text-sv-green" : "border border-sv-line text-sv-text-3",
                )}
              >
                {a.enabled ? "Enabled" : "Paused"}
              </button>
            </div>
          ))}
        </div>
      </Panel>

      {runs.length > 0 && (
        <Panel title="RECENT RUNS">
          <div className="space-y-1">
            {runs.map((r) => (
              <p key={r.id} className="text-sv-label-sm text-sv-text-3">
                {new Date(r.created_at).toLocaleString()} · {r.detail || r.status}
              </p>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Channels
function Channels({ api }: { api: Api }) {
  const [rows, setRows] = useState<IntegrationRow[]>([]);
  const [env, setEnv] = useState<Record<string, boolean>>({});
  const load = useCallback(async () => {
    const d = await api("?section=home");
    setRows((d.integrations as IntegrationRow[]) || []);
    setEnv((d.envConfigured as Record<string, boolean>) || {});
  }, [api]);
  useEffect(() => {
    load();
  }, [load]);

  const statusOf = (provider: string) =>
    env[provider] ? "connected" : rows.find((r) => r.provider === provider)?.status || "disconnected";

  async function toggle(provider: string, connect: boolean) {
    await api("/integrations", {
      method: "POST",
      body: JSON.stringify({ provider, status: connect ? "connected" : "disconnected" }),
    });
    load();
  }

  const cats = Array.from(new Set(INTEGRATIONS.map((i) => i.category))) as IntegrationCategory[];

  return (
    <div className="space-y-8">
      <p className="max-w-2xl text-sv-small text-sv-text-2">
        Every channel and tool. Native ones already run on your data and services; the rest activate the
        moment their credentials are added to the environment.
      </p>
      {cats.map((cat) => (
        <Panel key={cat} title={CATEGORY_LABELS[cat].toUpperCase()}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {INTEGRATIONS.filter((i) => i.category === cat).map((i) => {
              const st = statusOf(i.provider);
              return (
                <div key={i.provider} className="flex flex-col rounded-sv-md border border-sv-line bg-sv-surface-2/40 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sv-small text-sv-text">{i.name}</p>
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        st === "connected" ? "bg-sv-green" : st === "error" ? "bg-sv-danger" : "bg-sv-line-strong",
                      )}
                    />
                  </div>
                  <p className="mt-2 flex-1 text-sv-label-sm leading-relaxed text-sv-text-3">{i.blurb}</p>
                  {i.envHint && <p className="mt-2 font-mono text-sv-label-sm text-sv-text-3">{i.envHint}</p>}
                  {!i.native && (
                    <button
                      onClick={() => toggle(i.provider, st !== "connected")}
                      className={cn(
                        "mt-3 rounded-sv-sm px-3 py-1 text-sv-label-sm uppercase tracking-wider",
                        st === "connected" ? "border border-sv-line text-sv-text-3" : "bg-sv-green text-sv-ink",
                      )}
                    >
                      {st === "connected" ? "Disconnect" : "Mark connected"}
                    </button>
                  )}
                  {i.native && <span className="mt-3 text-sv-label-sm uppercase tracking-wider text-sv-green">Native · live</span>}
                </div>
              );
            })}
          </div>
        </Panel>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Landing & A/B
type VariantForm = { label: string; weight: string; eyebrow: string; headline: string; subhead: string; body: string; ctaText: string };
const emptyVariant = (label: string): VariantForm => ({ label, weight: "50", eyebrow: "", headline: "", subhead: "", body: "", ctaText: "Start a conversation" });

function Landing({ api }: { api: Api }) {
  const [pages, setPages] = useState<LandingRow[]>([]);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [locale, setLocale] = useState("en");
  const [a, setA] = useState<VariantForm>(emptyVariant("A"));
  const [b, setB] = useState<VariantForm>(emptyVariant("B"));
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const d = await api("/landing");
    setPages((d.pages as LandingRow[]) || []);
  }, [api]);
  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    const variants = [a, b]
      .filter((v) => v.headline.trim())
      .map((v, i) => ({
        id: v.label || String.fromCharCode(65 + i),
        label: v.label || String.fromCharCode(65 + i),
        weight: Number(v.weight) || 50,
        eyebrow: v.eyebrow || undefined,
        headline: v.headline,
        subhead: v.subhead || undefined,
        body: v.body || undefined,
        ctaText: v.ctaText || "Start a conversation",
      }));
    if (!name || variants.length === 0) return;
    const d = await api("/landing", { method: "POST", body: JSON.stringify({ action: "create", name, goal, locale, variants }) });
    if (d.ok) {
      setMsg(`Created /${locale === "en" ? "" : locale + "/"}l/${d.slug} — publish it to go live.`);
      setName(""); setGoal(""); setA(emptyVariant("A")); setB(emptyVariant("B"));
      load();
    }
  }
  async function setStatus(id: string, status: string) {
    await api("/landing", { method: "POST", body: JSON.stringify({ action: "status", id, status }) });
    load();
  }
  async function del(id: string) {
    await api("/landing", { method: "POST", body: JSON.stringify({ action: "delete", id }) });
    load();
  }

  const vfield = (v: VariantForm, set: (v: VariantForm) => void) => (
    <div className="space-y-2 rounded-sv-sm border border-sv-line p-3">
      <div className="flex gap-2">
        <input value={v.label} onChange={(e) => set({ ...v, label: e.target.value })} placeholder="Label" className={cn(inputCls, "w-20")} />
        <input value={v.weight} onChange={(e) => set({ ...v, weight: e.target.value })} placeholder="Weight" className={cn(inputCls, "w-20")} />
        <input value={v.ctaText} onChange={(e) => set({ ...v, ctaText: e.target.value })} placeholder="CTA text" className={cn(inputCls, "flex-1")} />
      </div>
      <input value={v.eyebrow} onChange={(e) => set({ ...v, eyebrow: e.target.value })} placeholder="Eyebrow (mono)" className={cn(inputCls, "w-full")} />
      <input value={v.headline} onChange={(e) => set({ ...v, headline: e.target.value })} placeholder="Headline" className={cn(inputCls, "w-full")} />
      <input value={v.subhead} onChange={(e) => set({ ...v, subhead: e.target.value })} placeholder="Subhead" className={cn(inputCls, "w-full")} />
      <textarea value={v.body} onChange={(e) => set({ ...v, body: e.target.value })} placeholder="Body (one paragraph per line)" className={cn(inputCls, "min-h-16 w-full resize-none")} />
    </div>
  );

  return (
    <div className="space-y-8">
      <Panel title="NEW LANDING PAGE — A/B">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Page name" className={cn(inputCls, "flex-1")} />
            <Select value={locale} onChange={setLocale} options={[["en", "EN"], ["ar", "AR"], ["fr", "FR"]]} />
          </div>
          <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Conversion goal / seed sent to the Chat on CTA click" className={cn(inputCls, "w-full")} />
          <div className="grid gap-3 md:grid-cols-2">
            {vfield(a, setA)}
            {vfield(b, setB)}
          </div>
          <button onClick={create} disabled={!name} className="rounded-sv-sm bg-sv-green px-4 py-2 text-sv-small font-medium text-sv-ink disabled:opacity-60">
            Create page
          </button>
          {msg && <p className="text-sv-small text-sv-green">{msg}</p>}
        </div>
      </Panel>

      <Panel title={`PAGES (${pages.length})`}>
        <div className="space-y-3">
          {pages.map((p) => (
            <div key={p.id} className="rounded-sv-sm border border-sv-line bg-sv-surface-2/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sv-small text-sv-text">{p.name}</p>
                  <p className="font-mono text-sv-label-sm text-sv-text-3">/{p.locale === "en" ? "" : p.locale + "/"}l/{p.slug}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("rounded-sv-pill px-2 py-0.5 text-sv-label-sm uppercase", p.status === "published" ? "bg-sv-green-soft text-sv-green" : "border border-sv-line text-sv-text-3")}>{p.status}</span>
                  <button onClick={() => setStatus(p.id, p.status === "published" ? "draft" : "published")} className="rounded-sv-sm border border-sv-line px-2 py-1 text-sv-label-sm text-sv-text-2">
                    {p.status === "published" ? "Unpublish" : "Publish"}
                  </button>
                  <button onClick={() => del(p.id)} className="text-sv-label-sm text-sv-danger">Delete</button>
                </div>
              </div>
              {p.results && p.results.length > 0 && (
                <div className="mt-3 space-y-1">
                  {p.results.map((r) => (
                    <div key={r.variantId} className="flex items-center gap-3 text-sv-small">
                      <span className="w-16 text-sv-text-2">{r.label}</span>
                      <span className="w-28 text-sv-text-3">{r.views} views · {r.conversions} conv</span>
                      <span className="w-16 font-mono text-sv-green">{r.rate}%</span>
                      {r.uplift !== null && <span className={cn("font-mono text-sv-label-sm", r.uplift >= 0 ? "text-sv-green" : "text-sv-danger")}>{r.uplift >= 0 ? "+" : ""}{r.uplift}% vs A</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------- Performance
function Performance({ api, token }: { api: Api; token: string }) {
  const [channels, setChannels] = useState<ChannelMetric[] | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  useEffect(() => {
    api("?section=performance").then((d) => setChannels((d.channels as ChannelMetric[]) || []));
  }, [api]);
  if (!channels) return <Loading />;

  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-sv-small text-sv-text-2">
        Live spend and performance per platform. Each card pulls real data once its credentials are in
        the environment — until then it waits, never showing invented numbers. Open the Analytics card
        for the full deep-dive and the AI advisor.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {channels.map((c) => {
          const isGa4 = c.provider === "ga4";
          const openable = isGa4 && c.configured && !c.error;
          return (
            <div
              key={c.provider}
              role={openable ? "button" : undefined}
              tabIndex={openable ? 0 : undefined}
              onClick={openable ? () => setShowAnalytics(true) : undefined}
              onKeyDown={openable ? (e) => (e.key === "Enter" || e.key === " ") && setShowAnalytics(true) : undefined}
              className={cn(
                "rounded-sv-md border border-sv-line bg-sv-surface-1 p-5",
                openable && "cursor-pointer transition-colors hover:border-sv-green-line",
              )}
            >
              <div className="flex items-center justify-between">
                <p className="sv-label">{c.label}</p>
                <span className={cn("h-2 w-2 rounded-full", c.configured ? (c.error ? "bg-sv-danger" : "bg-sv-green") : "bg-sv-line-strong")} />
              </div>
              {!c.configured ? (
                <p className="mt-3 text-sv-label-sm text-sv-text-3">Awaiting credentials.</p>
              ) : c.error ? (
                <p className="mt-3 text-sv-label-sm text-sv-danger">Connected, but the last fetch errored.</p>
              ) : (
                <dl className="mt-3 space-y-1 text-sv-small">
                  {c.metrics?.spend !== undefined && <Row k="Spend (30d)" v={`$${Math.round(c.metrics.spend).toLocaleString()}`} />}
                  {c.metrics?.impressions !== undefined && <Row k="Impressions" v={c.metrics.impressions.toLocaleString()} />}
                  {c.metrics?.clicks !== undefined && <Row k={c.note?.includes("session") ? "Sessions" : "Clicks"} v={c.metrics.clicks.toLocaleString()} />}
                  {c.metrics?.conversions !== undefined && <Row k="Conversions" v={c.metrics.conversions.toLocaleString()} />}
                </dl>
              )}
              {openable && (
                <p className="mt-3 font-mono text-sv-label-sm uppercase tracking-[0.14em] text-sv-green">
                  Open analytics →
                </p>
              )}
            </div>
          );
        })}
      </div>

      {showAnalytics && <AnalyticsView token={token} onClose={() => setShowAnalytics(false)} />}
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-sv-text-3">{k}</dt>
      <dd className="font-mono text-sv-text">{v}</dd>
    </div>
  );
}

// ---------------------------------------------------------------- shared bits
const inputCls =
  "rounded-sv-sm border border-sv-line bg-sv-surface-3 px-3 py-2 text-sv-small text-sv-text placeholder:text-sv-text-3 focus:border-sv-green-line focus:outline-none";

function Panel({ title, children, action, className }: { title: string; children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-sv-md border border-sv-line bg-sv-surface-1 p-5", className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="sv-label">{title}</p>
        {action}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, sub, live }: { label: string; value: number | string; sub?: string; live?: boolean }) {
  return (
    <div className="rounded-sv-md border border-sv-line bg-sv-surface-1 p-5">
      <p className={cn("sv-label", live && "sv-label--live")}>{label}</p>
      <p className={cn("mt-2 font-display text-3xl", live ? "text-sv-green" : "text-sv-text")}>{value}</p>
      {sub && <p className="mt-1 text-sv-label-sm text-sv-text-3">{sub}</p>}
    </div>
  );
}

function BarList({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-2">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-3">
          <span className="w-40 truncate text-sv-small text-sv-text-2">{it.label}</span>
          <div className="h-4 flex-1 overflow-hidden rounded-sv-sm bg-sv-surface-2">
            <div className="h-full bg-sv-green-soft" style={{ width: `${(it.value / max) * 100}%` }} />
          </div>
          <span className="w-10 text-end font-mono text-sv-small text-sv-text">{it.value}</span>
        </div>
      ))}
    </div>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: readonly (readonly [string, string])[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

function Loading() {
  return <p className="sv-label py-12 text-center">LOADING</p>;
}
function Disconnected() {
  return (
    <p className="py-12 text-center text-sv-small text-sv-text-3">
      Connect Supabase to power the marketing suite.
    </p>
  );
}

// types
type Overview2 = {
  totals: { conversations: number; leads: number; converted: number; conversionRate: number; last7Leads: number; last7Conversations: number };
  funnel: { label: string; value: number }[];
  byCategory: { category: string; conversations: number; converted: number }[];
  byLocale: { locale: string; count: number }[];
  bySource: { source: string; conversations: number; converted: number }[];
  trend: { day: string; conversations: number; leads: number }[];
};
type Insight = { id: string; title: string; body: string; severity: string };
type IntegrationRow = { provider: string; status: string };
type RecentAsk = { summary: string; category: string; locale: string; converted: boolean };
type ContentRow = { id: string; type: string; channel: string | null; locale: string; status: string; body: string };
type SegmentRow = { id: string; name: string; rules: Record<string, unknown>; count: number };
type AutomationRow = { id: string; name: string; enabled: boolean; run_count: number; actions: unknown[] };
type RunRow = { id: string; detail: string | null; status: string; created_at: string };
type VariantResult = { variantId: string; label: string; views: number; conversions: number; rate: number; uplift: number | null };
type LandingRow = { id: string; slug: string; name: string; locale: string; status: string; results?: VariantResult[] };
type ChannelMetric = { provider: string; label: string; configured: boolean; note?: string; error?: string; metrics?: { spend?: number; impressions?: number; clicks?: number; conversions?: number } };
type LearningPayload = {
  summary?: string;
  topRequests?: { request: string; count: number; note?: string }[];
  friction?: string[];
  messagingGaps?: string[];
  productGaps?: string[];
  recommendations?: { title: string; body: string; priority: "high" | "medium" | "low" }[];
};
type LearningRow = {
  id: string;
  conversations_analyzed: number;
  created_at: string;
  payload: LearningPayload;
};
