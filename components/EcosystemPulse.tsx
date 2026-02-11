import { SiteTopbar } from "@/components/SiteTopbar";
import { StatsCard } from "@/components/StatsCard";
import {
  EcosystemDailyPoint,
  OPENROUTER_OPENCLAW_APP_PAGE,
  getOpenClawEcosystemSnapshot,
} from "@/lib/openrouter-ecosystem";

const MIX_COLORS = ["#19e2c5", "#4ee4d1", "#ff5c57", "#ff8e6b", "#7dd3fc", "#a78bfa", "#f472b6", "#84cc16"] as const;

const PROVIDER_META: Record<string, { label: string; url: string }> = {
  anthropic: { label: "Anthropic", url: "https://www.anthropic.com" },
  "arcee-ai": { label: "Arcee AI", url: "https://www.arcee.ai" },
  deepseek: { label: "DeepSeek", url: "https://www.deepseek.com" },
  google: { label: "Google", url: "https://www.google.com" },
  minimax: { label: "MiniMax", url: "https://www.minimaxi.com" },
  moonshotai: { label: "Moonshot AI", url: "https://www.moonshot.ai" },
  openai: { label: "OpenAI", url: "https://www.openai.com" },
  openrouter: { label: "OpenRouter", url: "https://www.openrouter.ai" },
  perplexity: { label: "Perplexity", url: "https://www.perplexity.ai" },
  qwen: { label: "Qwen", url: "https://qwen.ai" },
  stepfun: { label: "StepFun", url: "https://www.stepfun.com" },
  "x-ai": { label: "xAI", url: "https://x.ai" },
  xai: { label: "xAI", url: "https://x.ai" },
  "z-ai": { label: "Z.ai", url: "https://z.ai" },
};

interface ModelVisual {
  model: string;
  provider: string;
  providerLabel: string;
  logoUrl: string | null;
  tokens: number;
  share: number;
  color: string;
}

const formatNumber = (value: number): string => Intl.NumberFormat("en-US").format(value);
const formatCompact = (value: number): string =>
  Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);

const formatTokenMetric = (value: number): string => formatCompact(value).toUpperCase();

const formatDate = (date: string): string =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

const shortModelName = (value: string): string => (value.length > 44 ? `${value.slice(0, 41)}...` : value);

const formatPartialDayNote = (latestDate: string | null): string | null => {
  if (!latestDate) {
    return null;
  }

  const start = new Date(`${latestDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) {
    return null;
  }

  const end = new Date(`${latestDate}T23:59:59Z`);
  const now = new Date();

  if (now < start || now > end) {
    return null;
  }

  const hours = Math.max(0, Math.min(23.9, (now.getTime() - start.getTime()) / 3_600_000));
  const hoursLabel = hours < 1 ? "<1h" : hours < 10 ? `${hours.toFixed(1)}h` : `${Math.round(hours)}h`;

  return `So far today: ${hoursLabel} of data.`;
};

const providerFromModel = (model: string): string => {
  const raw = model.split("/")[0] ?? "";
  return raw.toLowerCase();
};

const providerLabel = (provider: string): string => {
  const meta = PROVIDER_META[provider];
  if (meta) {
    return meta.label;
  }

  if (!provider) {
    return "Unknown";
  }

  return provider
    .split("-")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ""))
    .join(" ");
};

const providerLogoUrl = (provider: string): string | null => {
  const meta = PROVIDER_META[provider];
  if (!meta) {
    return null;
  }

  return `https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(
    meta.url,
  )}&size=64`;
};

const buildModelVisual = (model: string, tokens: number, totalTokens: number, color: string): ModelVisual => {
  const provider = providerFromModel(model);
  const share = totalTokens > 0 ? tokens / totalTokens : 0;

  return {
    model,
    provider,
    providerLabel: providerLabel(provider),
    logoUrl: providerLogoUrl(provider),
    tokens,
    share,
    color,
  };
};

const buildTrendPath = (
  points: EcosystemDailyPoint[],
): {
  linePath: string;
  areaPath: string;
  max: number;
  min: number;
  xStart: number;
  xEnd: number;
  yBase: number;
} | null => {
  if (points.length < 2) {
    return null;
  }

  const width = 900;
  const height = 300;
  const padLeft = 26;
  const padRight = 14;
  const padTop = 16;
  const padBottom = 34;
  const innerWidth = width - padLeft - padRight;
  const innerHeight = height - padTop - padBottom;

  const values = points.map((point) => point.totalTokens);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || 1;

  const coords = points.map((point, index) => {
    const x = padLeft + (index / (points.length - 1)) * innerWidth;
    const normalized = (point.totalTokens - min) / spread;
    const y = padTop + (1 - normalized) * innerHeight;
    return { x, y };
  });

  const linePath = coords.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
  const first = coords[0];
  const last = coords[coords.length - 1];
  const yBase = height - padBottom;
  const areaPath = `${linePath} L ${last.x.toFixed(2)} ${yBase.toFixed(2)} L ${first.x.toFixed(2)} ${yBase.toFixed(2)} Z`;

  return {
    linePath,
    areaPath,
    max,
    min,
    xStart: first.x,
    xEnd: last.x,
    yBase,
  };
};

function ProviderChip({ model, providerLabelText, logoUrl }: { model: string; providerLabelText: string; logoUrl: string | null }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span
        className="relative flex size-4 items-center justify-center overflow-hidden rounded-sm border border-white/15 bg-white/5 text-[9px] uppercase text-[color:var(--text-muted)]"
        style={
          logoUrl
            ? {
                backgroundImage: `url(${logoUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
        aria-hidden="true"
        title={providerLabelText}
      >
        {logoUrl ? null : providerLabelText.slice(0, 1)}
      </span>
      <span className="truncate">{shortModelName(model)}</span>
    </div>
  );
}

export default async function EcosystemPulse() {
  const snapshot = await getOpenClawEcosystemSnapshot();
  const trendPoints = snapshot ? snapshot.daily.slice(-30) : [];
  const trendGeometry = buildTrendPath(trendPoints);
  const latestDay = snapshot ? snapshot.daily[snapshot.daily.length - 1] : null;

  const latestModelsRaw = latestDay
    ? Object.entries(latestDay.models)
        .filter(([model, tokens]) => model !== "Others" && tokens > 0)
        .sort((left, right) => right[1] - left[1])
    : [];

  const latestTopModels = latestModelsRaw
    .slice(0, 6)
    .map(([model, tokens], index) => buildModelVisual(model, tokens, latestDay?.totalTokens ?? 0, MIX_COLORS[index % MIX_COLORS.length]));

  const latestTopTokens = latestTopModels.reduce((sum, entry) => sum + entry.tokens, 0);
  const latestOthersTokens = Math.max((latestDay?.totalTokens ?? 0) - latestTopTokens, 0);

  const mixSegments =
    latestOthersTokens > 0 && latestDay
      ? [
          ...latestTopModels,
          buildModelVisual("others", latestOthersTokens, latestDay.totalTokens, "rgba(110, 124, 152, 0.85)"),
        ]
      : latestTopModels;

  const conicStops = mixSegments.length
    ? (() => {
        let cursor = 0;
        const stops: string[] = [];
        for (const segment of mixSegments) {
          const start = cursor * 100;
          cursor += segment.share;
          const end = Math.min(cursor * 100, 100);
          stops.push(`${segment.color} ${start.toFixed(2)}% ${end.toFixed(2)}%`);
        }
        return stops.join(", ");
      })()
    : "rgba(110,124,152,0.6) 0% 100%";

  const last3Days = snapshot ? snapshot.daily.slice(-3) : [];
  const prev3Days = snapshot ? snapshot.daily.slice(-6, -3) : [];
  const last3Total = last3Days.reduce((sum, point) => sum + point.totalTokens, 0);
  const prev3Total = prev3Days.reduce((sum, point) => sum + point.totalTokens, 0);
  const growthRate = prev3Total > 0 && last3Days.length === 3 && prev3Days.length === 3 ? (last3Total - prev3Total) / prev3Total : null;
  const growthValue = growthRate === null ? "--" : `${growthRate >= 0 ? "+" : ""}${(growthRate * 100).toFixed(1)}%`;
  const growthCaption = prev3Days.length === 3 ? "vs prior 3d" : "vs prior 3d";
  const growthTone = growthRate !== null && growthRate < 0 ? "coral" : "cyan";
  const partialDayNote = formatPartialDayNote(snapshot?.latestDate ?? null);

  return (
    <main className="oc-shell">
      <header className="space-y-4">
        <SiteTopbar />
        <h1 className="sr-only">Ecosystem</h1>
      </header>

      {!snapshot ? (
        <section className="oc-panel mt-7 p-6">
          <p className="oc-kicker">Data unavailable</p>
          <h2 className="mt-2 text-2xl font-semibold">OpenRouter ecosystem feed is temporarily unavailable.</h2>
          <p className="mt-2 text-sm text-[color:var(--text-secondary)]">The feed can fail intermittently. Retry shortly, or view the source directly.</p>
          <a href={OPENROUTER_OPENCLAW_APP_PAGE} target="_blank" rel="noreferrer" className="oc-button-primary mt-5 px-4 py-2 text-sm">
            Open source feed
          </a>
        </section>
      ) : (
        <>
          <div className="mt-5 flex flex-col gap-6 sm:mt-6">
            <section className="order-1 grid grid-cols-3 gap-3 sm:gap-4 lg:grid-cols-6">
              <StatsCard
                label="24h Tokens"
                value={formatTokenMetric(snapshot.last24hTokens)}
                caption="Latest day aggregate"
                tone="cyan"
                size="compact"
              />
              <StatsCard label="7d Tokens" value={formatTokenMetric(snapshot.sevenDayTokens)} caption="Rolling week" tone="coral" size="compact" />
              <StatsCard label="30d Tokens" value={formatTokenMetric(snapshot.thirtyDayTokens)} caption="Rolling month" tone="cyan" size="compact" />
              <StatsCard label="3d Growth" value={growthValue} caption={growthCaption} tone={growthTone} size="compact" />
              <StatsCard label="Tracked Days" value={formatNumber(snapshot.trackedDays)} caption="In current source window" tone="coral" size="compact" />
              <StatsCard label="Active Models" value={formatNumber(snapshot.activeModelsToday)} caption="Models used today" tone="cyan" size="compact" />
            </section>

            <section className="order-2 grid gap-4 xl:grid-cols-2">
              <article className="oc-panel p-4 md:p-5">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h2 className="text-xl font-semibold">Daily token trend</h2>
                    <p className="mt-1 hidden text-sm text-[color:var(--text-secondary)] sm:block">
                      Color-weighted area trend over the latest 30 days.
                    </p>
                    {partialDayNote ? (
                      <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-[color:var(--text-muted)]">
                        <span className="inline-block size-1.5 rounded-full bg-[#19e2c5]" />
                        {partialDayNote}
                      </div>
                    ) : null}
                  </div>
                  <p className="text-xs text-[color:var(--text-muted)]">
                    Peak {trendGeometry ? formatTokenMetric(trendGeometry.max) : "--"} • Low{" "}
                    {trendGeometry ? formatTokenMetric(trendGeometry.min) : "--"}
                  </p>
                </div>

                {trendGeometry ? (
                  <div className="mt-4 overflow-hidden rounded-xl border border-white/8 bg-[rgba(10,18,31,0.55)] p-2">
                    <svg
                      viewBox="0 0 900 300"
                      className="h-[200px] w-full sm:h-[235px] md:h-[260px]"
                      role="img"
                      aria-label="Daily token trend chart"
                    >
                    <defs>
                      <linearGradient id="trendAreaFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(25, 226, 197, 0.5)" />
                        <stop offset="55%" stopColor="rgba(25, 226, 197, 0.16)" />
                        <stop offset="100%" stopColor="rgba(25, 226, 197, 0.04)" />
                      </linearGradient>
                      <linearGradient id="trendLineStroke" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#4ee4d1" />
                        <stop offset="70%" stopColor="#19e2c5" />
                        <stop offset="100%" stopColor="#ff5c57" />
                      </linearGradient>
                    </defs>

                    {[0, 1, 2, 3, 4].map((index) => {
                      const y = 16 + (index / 4) * (300 - 16 - 34);
                      return <line key={index} x1={26} x2={886} y1={y} y2={y} stroke="rgba(148, 163, 184, 0.14)" strokeWidth={1} />;
                    })}

                    <path d={trendGeometry.areaPath} fill="url(#trendAreaFill)" />
                    <path d={trendGeometry.linePath} fill="none" stroke="url(#trendLineStroke)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />

                    <circle cx={trendGeometry.xEnd} cy={trendGeometry.yBase - 2} r={0} fill="none" />
                  </svg>
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-white/8 bg-[rgba(10,18,31,0.55)] p-5 text-sm text-[color:var(--text-secondary)]">
                    Not enough trend data to render chart yet.
                  </div>
                )}

                {trendPoints.length > 0 ? (
                  <div className="mt-3 flex items-center justify-between text-xs text-[color:var(--text-muted)]">
                    <span>{formatDate(trendPoints[0].date)}</span>
                    <span>{formatDate(trendPoints[Math.floor((trendPoints.length - 1) / 2)].date)}</span>
                    <span>{formatDate(trendPoints[trendPoints.length - 1].date)}</span>
                  </div>
                ) : null}
              </article>

              <article className="oc-panel p-4 md:p-5">
                <h2 className="text-xl font-semibold">Current day mix</h2>
                <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
                  Model distribution for {snapshot.latestDate ? formatDate(snapshot.latestDate) : "latest available day"}.
                </p>
                {partialDayNote ? (
                  <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-[color:var(--text-muted)]">
                    <span className="inline-block size-1.5 rounded-full bg-[#19e2c5]" />
                    {partialDayNote}
                  </div>
                ) : null}

                {latestDay ? (
                  <div className="mt-4 grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
                    <div className="flex flex-col items-center justify-center rounded-xl border border-white/8 bg-[rgba(10,18,31,0.55)] p-4">
                      <div
                        className="relative size-40 rounded-full shadow-[0_0_34px_rgba(25,226,197,0.14)]"
                        style={{ background: `conic-gradient(from -90deg, ${conicStops})` }}
                      >
                        <div className="absolute inset-5 rounded-full border border-white/10 bg-[color:var(--bg-surface)]" />
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <p className="text-[10px] uppercase tracking-[0.15em] text-[color:var(--text-muted)]">Total Day</p>
                          <p className="text-xl font-semibold">{formatTokenMetric(latestDay.totalTokens)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="min-w-0 space-y-3">
                      {mixSegments.map((entry) => (
                        <div key={`${entry.model}-${entry.color}`}>
                          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-sm">
                            {entry.model === "others" ? (
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="size-4 rounded-sm border border-white/15 bg-white/5" />
                                <span className="truncate">Others</span>
                              </div>
                            ) : (
                              <ProviderChip model={entry.model} providerLabelText={entry.providerLabel} logoUrl={entry.logoUrl} />
                            )}
                            <span className="whitespace-nowrap text-right font-[family-name:var(--font-mono)] text-[color:var(--text-secondary)]">
                              {formatTokenMetric(entry.tokens)} ({(entry.share * 100).toFixed(1)}%)
                            </span>
                          </div>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/7">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${Math.max(4, Math.round(entry.share * 100))}%`, background: entry.color }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-white/8 bg-[rgba(10,18,31,0.55)] p-5 text-sm text-[color:var(--text-secondary)]">
                    No day-level mix data available yet.
                  </div>
                )}
              </article>
            </section>

            <section className="order-3">
              <article className="oc-panel p-4 md:p-5">
                <h2 className="text-xl font-semibold">Monthly model leaderboard (OpenRouter)</h2>
                <p className="mt-1 text-sm text-[color:var(--text-secondary)]">Top OpenClaw ecosystem models by monthly token volume.</p>
                <div className="mt-4 space-y-3">
                  {(() => {
                    type MonthlyRow = {
                      model: string;
                      totalTokens: number;
                      share: number;
                      index: number;
                      isOthers: boolean;
                    };

                    const shown = snapshot.topModels.slice(0, 12);
                    const remainder = snapshot.topModels.slice(12);
                    const othersTokens = remainder.reduce((sum, entry) => sum + entry.totalTokens, 0);
                    const othersShare = remainder.reduce((sum, entry) => sum + entry.share, 0);
                    const rows: MonthlyRow[] = shown.map((model, index) => ({
                      model: model.model,
                      totalTokens: model.totalTokens,
                      share: model.share,
                      index,
                      isOthers: false,
                    }));
                    if (othersTokens > 0 && othersShare > 0) {
                      rows.push({
                        model: "others",
                        totalTokens: othersTokens,
                        share: othersShare,
                        index: rows.length,
                        isOthers: true,
                      });
                    }

                    return rows;
                  })().map((row) => {
                    const color = MIX_COLORS[row.index % MIX_COLORS.length];
                    const provider = providerFromModel(row.model);
                    return (
                      <div key={row.isOthers ? "monthly-others" : row.model}>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          {row.isOthers ? (
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="size-4 rounded-sm border border-white/15 bg-white/5" />
                              <span className="truncate">Others</span>
                            </div>
                          ) : (
                            <ProviderChip model={row.model} providerLabelText={providerLabel(provider)} logoUrl={providerLogoUrl(provider)} />
                          )}
                          <span className="font-[family-name:var(--font-mono)] text-[color:var(--text-secondary)]">
                            {formatTokenMetric(row.totalTokens)} ({(row.share * 100).toFixed(1)}%)
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/7">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.max(4, Math.round(row.share * 100))}%`,
                              background: row.isOthers ? "rgba(110, 124, 152, 0.85)" : color,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            </section>
          </div>
        </>
      )}
    </main>
  );
}
