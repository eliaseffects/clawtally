"use client";

import { useMemo, useState } from "react";

import { ActivityHeatmap } from "@/components/ActivityHeatmap";
import { StatsCard } from "@/components/StatsCard";
import { LeaderboardPeriod, StatsApiResponse, TopModel, TopTool } from "@/lib/types";

interface StatsDashboardProps {
  stats: StatsApiResponse;
}

const PERIOD_OPTIONS: ReadonlyArray<LeaderboardPeriod> = ["24h", "7d", "30d", "all"];

const PERIOD_LABEL: Record<LeaderboardPeriod, string> = {
  "24h": "24 hours",
  "7d": "7 days",
  "30d": "30 days",
  all: "all time",
};

const formatNumber = (value: number): string => Intl.NumberFormat("en-US").format(value);
const formatMoney = (value: number): string =>
  Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);

const cardCaption = (period: LeaderboardPeriod): string =>
  period === "all" ? "All-time aggregate" : `Window: ${PERIOD_LABEL[period]}`;

const modelShare = (model: TopModel, allModels: TopModel[]): number => {
  const max = Math.max(...allModels.map((entry) => entry.tokens), 1);
  return Math.max(6, Math.round((model.tokens / max) * 100));
};

const toolShare = (tool: TopTool, allTools: TopTool[]): number => {
  const max = Math.max(...allTools.map((entry) => entry.count), 1);
  return Math.max(6, Math.round((tool.count / max) * 100));
};

export function StatsDashboard({ stats }: StatsDashboardProps) {
  const [period, setPeriod] = useState<LeaderboardPeriod>("30d");

  const scoped = useMemo(() => stats.periods[period], [period, stats.periods]);

  return (
    <div className="space-y-6">
      <section className="oc-panel p-4 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="oc-kicker">Usage Window</p>
            <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
              Toggle the category window to inspect near-term spikes versus all-time totals.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {PERIOD_OPTIONS.map((option) => {
              const active = option === period;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setPeriod(option)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                    active
                      ? "border-[color:var(--cyan-mid)] bg-[color:var(--cyan-soft)] text-[color:var(--text-primary)]"
                      : "border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] text-[color:var(--text-secondary)] hover:text-white"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard label="Total Tokens" value={formatNumber(scoped.tokens)} caption={cardCaption(period)} tone="cyan" />
        <StatsCard label="Total Cost" value={formatMoney(scoped.cost)} caption={cardCaption(period)} tone="coral" />
        <StatsCard label="Messages" value={formatNumber(scoped.messages)} caption={cardCaption(period)} tone="cyan" />
        <StatsCard label="Sessions" value={formatNumber(scoped.sessions)} caption={cardCaption(period)} tone="coral" />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="oc-panel p-4 md:p-5">
          <h3 className="text-lg font-semibold">Top Models</h3>
          <p className="mt-1 text-sm text-[color:var(--text-secondary)]">Token-heavy models over the selected data horizon.</p>
          <ul className="mt-4 space-y-3">
            {stats.topModels.map((model) => (
              <li key={model.model}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{model.model}</span>
                  <span className="font-[family-name:var(--font-mono)] text-[color:var(--text-secondary)]">
                    {formatNumber(model.tokens)}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/7">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[color:var(--coral-mid)] to-[color:var(--coral-bright)]"
                    style={{ width: `${modelShare(model, stats.topModels)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </article>

        <article className="oc-panel p-4 md:p-5">
          <h3 className="text-lg font-semibold">Top Tools</h3>
          <p className="mt-1 text-sm text-[color:var(--text-secondary)]">Most-invoked tools from OpenClaw session telemetry.</p>
          <ul className="mt-4 space-y-3">
            {stats.topTools.map((tool) => (
              <li key={tool.tool}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{tool.tool}</span>
                  <span className="font-[family-name:var(--font-mono)] text-[color:var(--text-secondary)]">
                    {formatNumber(tool.count)}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/7">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[color:var(--cyan-mid)] to-[color:var(--cyan-bright)]"
                    style={{ width: `${toolShare(tool, stats.topTools)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <ActivityHeatmap activity={stats.activity} />
    </div>
  );
}
