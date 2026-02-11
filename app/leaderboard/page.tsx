"use client";

import type { ChangeEvent } from "react";
import { useEffect, useState } from "react";

import { ConnectForm } from "@/components/ConnectForm";
import { LeaderboardTable } from "@/components/LeaderboardTable";
import { SiteTopbar } from "@/components/SiteTopbar";
import { LeaderboardCategory, LeaderboardEntry, LeaderboardPeriod } from "@/lib/types";

const CATEGORIES: LeaderboardCategory[] = ["tokens", "cost", "messages", "sessions", "streak"];
const PERIODS: LeaderboardPeriod[] = ["24h", "7d", "30d", "all"];

const CATEGORY_LABEL: Record<LeaderboardCategory, string> = {
  tokens: "Tokens",
  cost: "Cost",
  messages: "Messages",
  sessions: "Sessions",
  streak: "Streak",
};

interface LeaderboardResponse {
  entries: LeaderboardEntry[];
}

export default function LeaderboardPage() {
  const [category, setCategory] = useState<LeaderboardCategory>("tokens");
  const [period, setPeriod] = useState<LeaderboardPeriod>("30d");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasLocalSession, setHasLocalSession] = useState(false);

  useEffect(() => {
    setHasLocalSession(Boolean(localStorage.getItem("clawboard.token")));
  }, []);

  useEffect(() => {
    const loadLeaderboard = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/leaderboard?category=${category}&period=${period}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          const body = (await response.json()) as { error?: string };
          throw new Error(body.error ?? "Unable to load leaderboard");
        }

        const data = (await response.json()) as LeaderboardResponse;
        setEntries(data.entries);
      } catch (loadError: unknown) {
        const message = loadError instanceof Error ? loadError.message : "Unable to load leaderboard";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    loadLeaderboard();
  }, [category, period]);

  return (
    <main className="oc-shell">
      <header className="space-y-4">
        <SiteTopbar />
        <h1 className="sr-only">Leaderboard</h1>
      </header>

      <section className="oc-panel mt-7 p-4 md:p-5">
        <details>
          <summary className="cursor-pointer text-sm font-medium text-[color:var(--text-secondary)]">
            {hasLocalSession ? "Reconnect your local OpenClaw (optional)" : "Connect your local OpenClaw (optional)"}
          </summary>
          <div className="mt-4">
            <ConnectForm variant="embedded" />
          </div>
        </details>
      </section>

      <section className="oc-panel mt-4 grid gap-4 p-4 md:grid-cols-2 md:p-5">
        <label className="text-sm text-[color:var(--text-secondary)]">
          Category
          <select
            value={category}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => setCategory(event.target.value as LeaderboardCategory)}
            className="oc-select mt-2"
          >
            {CATEGORIES.map((option) => (
              <option key={option} value={option}>
                {CATEGORY_LABEL[option]}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-[color:var(--text-secondary)]">
          Period
          <select
            value={period}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => setPeriod(event.target.value as LeaderboardPeriod)}
            className="oc-select mt-2"
          >
            {PERIODS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="mt-6">
        {loading ? (
          <div className="oc-panel p-8 text-sm text-[color:var(--text-secondary)]">Loading leaderboard...</div>
        ) : error ? (
          <div className="rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--coral-soft)] px-3 py-2 text-sm text-rose-100">
            {error}
          </div>
        ) : (
          <LeaderboardTable entries={entries} category={category} />
        )}
      </section>
    </main>
  );
}
