"use client";

import { useEffect, useMemo, useState } from "react";

import { ConnectForm } from "@/components/ConnectForm";
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

  useEffect(() => {
    const existingToken = localStorage.getItem("clawboard.token");
    if (!existingToken) {
      setLoading(false);
      return;
    }

    setToken(existingToken);
    loadStats(existingToken)
      .catch((loadError: unknown) => {
        const message = loadError instanceof Error ? loadError.message : "Unable to load dashboard";
        setError(message);
      })
      .finally(() => {
        setLoading(false);
      });
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

  const noSession = !loading && !token;

  return (
    <main className="oc-shell">
      <header className="space-y-4">
        <SiteTopbar />
        <h1 className="sr-only">Dashboard</h1>
      </header>

      {noSession ? (
        <section className="mt-10 flex items-center justify-center">
          <ConnectForm
            variant="hero"
            className="w-full max-w-2xl"
            redirectTo={null}
            showManual={false}
            onConnected={async ({ anonymousToken }) => {
              setToken(anonymousToken);
              setError(null);
              setLoading(true);
              try {
                await loadStats(anonymousToken);
                setUsageRefreshKey((value) => value + 1);
              } catch (loadError: unknown) {
                const message = loadError instanceof Error ? loadError.message : "Unable to load dashboard";
                setError(message);
              } finally {
                setLoading(false);
              }
            }}
          />
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
