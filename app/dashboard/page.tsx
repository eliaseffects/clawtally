"use client";

import { useEffect, useMemo, useState } from "react";

import { SiteTopbar } from "@/components/SiteTopbar";
import { UsageWindowDashboard } from "@/components/UsageWindowDashboard";
import { StatsApiResponse } from "@/lib/types";

interface ApiError {
  error?: string;
}

const formatTime = (iso: string): string =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const DEFAULT_GATEWAY_URL = "http://127.0.0.1:18789";

export default function DashboardPage() {
  const [token, setToken] = useState<string | null>(null);
  const [stats, setStats] = useState<StatsApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareEnabled, setShareEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usageRefreshKey, setUsageRefreshKey] = useState(0);

  const gatewayConfig = useMemo(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const gatewayUrl = localStorage.getItem("clawboard.gatewayUrl");
    const apiKey = localStorage.getItem("clawboard.apiKey");

    if (!gatewayUrl && !apiKey) {
      return null;
    }

    return { gatewayUrl, apiKey };
  }, [token]);

  const loadStats = async (activeToken: string) => {
    const response = await fetch(`/api/stats/${encodeURIComponent(activeToken)}`, { cache: "no-store" });
    if (!response.ok) {
      const body = (await response.json()) as ApiError;
      if (response.status === 404 && body.error === "No stats synced yet") {
        setStats(null);
        return;
      }
      throw new Error(body.error ?? "Unable to load stats");
    }

    const data = (await response.json()) as StatsApiResponse;
    setStats(data);
    setShareEnabled(data.shareEnabled);
  };

  const autoConnect = async () => {
    setError(null);
    setLoading(true);

    try {
      const connectResponse = await fetch("/api/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gatewayUrl: DEFAULT_GATEWAY_URL,
        }),
      });

      if (!connectResponse.ok) {
        const body = (await connectResponse.json()) as ApiError;
        throw new Error(body.error ?? "Unable to reach local OpenClaw gateway");
      }

      const connectData = (await connectResponse.json()) as { anonymousToken: string };

      localStorage.setItem("clawboard.token", connectData.anonymousToken);
      localStorage.setItem("clawboard.gatewayUrl", DEFAULT_GATEWAY_URL);

      const syncResponse = await fetch("/api/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          anonymousToken: connectData.anonymousToken,
          gatewayUrl: DEFAULT_GATEWAY_URL,
        }),
      });

      if (!syncResponse.ok) {
        const body = (await syncResponse.json()) as ApiError;
        throw new Error(body.error ?? "Connected but failed to sync usage");
      }

      setToken(connectData.anonymousToken);
      await loadStats(connectData.anonymousToken);
      setUsageRefreshKey((value) => value + 1);
    } catch (autoError: unknown) {
      const message = autoError instanceof Error ? autoError.message : "Unable to connect automatically";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    const finishLoading = () => {
      if (active) {
        setLoading(false);
      }
    };

    const safeSetError = (message: string | null) => {
      if (active) {
        setError(message);
      }
    };

    const existingToken = localStorage.getItem("clawboard.token");
    if (existingToken) {
      setToken(existingToken);
      loadStats(existingToken)
        .catch((loadError: unknown) => {
          const message = loadError instanceof Error ? loadError.message : "Unable to load dashboard";
          safeSetError(message);
        })
        .finally(() => finishLoading());
    } else {
      autoConnect();
    }

    return () => {
      active = false;
    };
  }, []);

  const sync = async () => {
    if (!token) {
      setError("No active local session. Connect on this page first.");
      return;
    }

    setError(null);
    setSyncing(true);

    try {
      const response = await fetch("/api/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          anonymousToken: token,
          ...(gatewayConfig?.gatewayUrl ? { gatewayUrl: gatewayConfig.gatewayUrl } : {}),
          ...(gatewayConfig?.apiKey ? { apiKey: gatewayConfig.apiKey } : {}),
        }),
      });

      if (!response.ok) {
        const body = (await response.json()) as ApiError;
        throw new Error(body.error ?? "Sync failed");
      }

      await loadStats(token);
      setUsageRefreshKey((value) => value + 1);
    } catch (syncError: unknown) {
      const message = syncError instanceof Error ? syncError.message : "Sync failed";
      setError(message);
    } finally {
      setSyncing(false);
    }
  };

  const toggleShare = async () => {
    if (!token) {
      return;
    }

    const nextShareValue = !shareEnabled;
    setError(null);
    setSharing(true);
    setShareEnabled(nextShareValue);
    setStats((current) => (current ? { ...current, shareEnabled: nextShareValue } : current));

    try {
      const response = await fetch("/api/share", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          anonymousToken: token,
          shareEnabled: nextShareValue,
        }),
      });

      if (!response.ok) {
        setShareEnabled(!nextShareValue);
        setStats((current) => (current ? { ...current, shareEnabled: !nextShareValue } : current));
        const body = (await response.json()) as ApiError;
        setError(body.error ?? "Unable to update sharing preference");
      }
    } catch (shareError: unknown) {
      setShareEnabled(!nextShareValue);
      setStats((current) => (current ? { ...current, shareEnabled: !nextShareValue } : current));
      const message = shareError instanceof Error ? shareError.message : "Unable to update sharing preference";
      setError(message);
    } finally {
      setSharing(false);
    }
  };

  const resetLocalSession = () => {
    localStorage.removeItem("clawboard.token");
    localStorage.removeItem("clawboard.gatewayUrl");
    localStorage.removeItem("clawboard.apiKey");
    setToken(null);
    setStats(null);
    setShareEnabled(false);
    setSharing(false);
    setSyncing(false);
    setError(null);
    setLoading(false);
  };

  const isAutoConnecting = loading && !token;
  const noSession = !loading && !token;

  return (
    <main className="oc-shell">
      <header className="space-y-4">
        <SiteTopbar />
        <h1 className="sr-only">Dashboard</h1>
      </header>

      {isAutoConnecting ? (
        <section className="mt-10 flex items-center justify-center">
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[linear-gradient(160deg,rgba(13,20,34,0.92)_0%,rgba(10,16,29,0.96)_100%)] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
            <p className="oc-kicker text-[color:var(--cyan-bright)]">Read-Only Connect</p>
            <h2 className="mt-2 text-2xl font-semibold">Connecting to your local OpenClaw usage.</h2>
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
              We automatically connect to your OpenClaw gateway at <span className="text-white">{DEFAULT_GATEWAY_URL}</span>.
            </p>
            <div className="mt-5 flex items-center gap-3 text-sm text-[color:var(--text-secondary)]">
              <span className="inline-block size-4 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
              Connecting now...
            </div>
          </div>
        </section>
      ) : noSession ? (
        <section className="mt-10 flex items-center justify-center">
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[linear-gradient(160deg,rgba(13,20,34,0.92)_0%,rgba(10,16,29,0.96)_100%)] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
            <p className="oc-kicker text-[color:var(--cyan-bright)]">Read-Only Connect</p>
            <h2 className="mt-2 text-2xl font-semibold">Connect your local OpenClaw usage.</h2>
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
              OpenClaw is not reachable at <span className="text-white">{DEFAULT_GATEWAY_URL}</span>. Start OpenClaw and retry to
              load your dashboard automatically.
            </p>
          {error ? (
            <p className="mt-4 rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--coral-soft)] px-3 py-2 text-sm text-rose-100">
              {error}
            </p>
          ) : null}
            <button
              type="button"
              className="oc-button-secondary mt-5 w-full px-5 py-3 text-base font-semibold"
              onClick={() => autoConnect()}
            >
              Retry Connection
            </button>
            <details className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
              <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold text-[color:var(--text-secondary)]">
                Safety & privacy
                <span className="oc-pill">More info</span>
              </summary>
              <div className="mt-3 space-y-2 text-sm text-[color:var(--text-secondary)]">
                <p>
                  Clawtally is read-only. It does not send commands to your agent, does not invoke tools, and cannot execute
                  tasks on your machine or in your OpenClaw stack.
                </p>
                <p>
                  We only read aggregate usage telemetry such as tokens, cost, models, tools, cache activity, error rates,
                  latency, and session counts to visualize usage health.
                </p>
                <p>
                  No files are modified, no prompts are written, and no content is injected into your workflows. You can
                  disconnect at any time to revoke access and clear local session tokens.
                </p>
              </div>
            </details>
          </div>
        </section>
      ) : (
        <>
          {error ? (
            <p className="mt-4 rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--coral-soft)] px-3 py-2 text-sm text-rose-100">
              {error}
            </p>
          ) : null}

          <section className="mt-7">
            {token ? (
              <UsageWindowDashboard
                anonymousToken={token}
                refreshKey={usageRefreshKey}
                sessionControls={{
                  lastSyncedLabel: stats ? formatTime(stats.updatedAt) : "Not synced yet",
                  syncing,
                  shareEnabled,
                  sharing,
                  onSyncNow: sync,
                  onToggleShare: toggleShare,
                  onDisconnect: resetLocalSession,
                }}
              />
            ) : (
              <div className="oc-panel p-8 text-sm text-[color:var(--text-secondary)]">
                No local session found. Connect from this page first.
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
