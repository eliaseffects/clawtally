"use client";

import { FormEvent, useEffect, useState } from "react";

import { SiteTopbar } from "@/components/SiteTopbar";
import { UsageWindowDashboard } from "@/components/UsageWindowDashboard";

const DEFAULT_GATEWAY_URL = "http://127.0.0.1:18789";
const LOCAL_GATEWAY_STORAGE_KEY = "clawtally.gateway";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [gatewayConfig, setGatewayConfig] = useState<{ gatewayUrl: string; apiKey?: string } | null>(null);
  const [gatewayUrlInput, setGatewayUrlInput] = useState(DEFAULT_GATEWAY_URL);
  const [gatewayTokenInput, setGatewayTokenInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [usageRefreshKey, setUsageRefreshKey] = useState(0);

  useEffect(() => {
    const raw = localStorage.getItem(LOCAL_GATEWAY_STORAGE_KEY);
    if (!raw) {
      setLoading(false);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as { gatewayUrl?: string; apiKey?: string };
      if (parsed.gatewayUrl && parsed.apiKey) {
        setGatewayConfig({ gatewayUrl: parsed.gatewayUrl, apiKey: parsed.apiKey });
        setGatewayUrlInput(parsed.gatewayUrl);
      }
    } catch {
      // ignore parse errors
    } finally {
      setLoading(false);
    }
  }, []);

  const connectToGateway = (event: FormEvent) => {
    event.preventDefault();
    const trimmedToken = gatewayTokenInput.trim();
    if (!trimmedToken) {
      setError("Gateway token is required to connect.");
      return;
    }

    const url = gatewayUrlInput.trim() || DEFAULT_GATEWAY_URL;
    const config = { gatewayUrl: url, apiKey: trimmedToken };
    localStorage.setItem(LOCAL_GATEWAY_STORAGE_KEY, JSON.stringify(config));
    setGatewayConfig(config);
    setError(null);
    setUsageRefreshKey((value) => value + 1);
  };

  const disconnectGateway = () => {
    localStorage.removeItem(LOCAL_GATEWAY_STORAGE_KEY);
    setGatewayConfig(null);
    setGatewayTokenInput("");
    setError(null);
    setUsageRefreshKey((value) => value + 1);
  };

  const noSession = !loading && !gatewayConfig;

  return (
    <main className="oc-shell">
      <header className="space-y-4">
        <SiteTopbar />
        <h1 className="sr-only">Dashboard</h1>
      </header>

      {noSession ? (
        <section className="mt-10 flex items-center justify-center">
          <form
            onSubmit={connectToGateway}
            className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[linear-gradient(160deg,rgba(13,20,34,0.92)_0%,rgba(10,16,29,0.96)_100%)] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
          >
            <p className="oc-kicker text-[color:var(--cyan-bright)]">Read-Only Connect</p>
            <h2 className="mt-2 text-2xl font-semibold">Show my usage.</h2>
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
              Grab your gateway token from{" "}
              <a
                className="text-white underline decoration-white/30 underline-offset-4"
                href="http://127.0.0.1:18789/overview"
                target="_blank"
                rel="noreferrer"
              >
                http://127.0.0.1:18789/overview
              </a>{" "}
              and paste it below. We store it locally in your browser only.
            </p>

            <div className="mt-5 space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="gateway-token"
                  className="block text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]"
                >
                  Gateway Token
                </label>
                <input
                  id="gateway-token"
                  type="password"
                  value={gatewayTokenInput}
                  onChange={(event) => setGatewayTokenInput(event.target.value)}
                  placeholder="Paste your gateway token"
                  className="oc-input"
                  required
                />
              </div>

              <details className="rounded-xl border border-white/10 bg-white/5 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-[color:var(--text-secondary)]">Advanced</summary>
                <div className="mt-3 space-y-2">
                  <label
                    htmlFor="gateway-url"
                    className="block text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]"
                  >
                    Gateway URL
                  </label>
                  <input
                    id="gateway-url"
                    type="text"
                    value={gatewayUrlInput}
                    onChange={(event) => setGatewayUrlInput(event.target.value)}
                    placeholder={DEFAULT_GATEWAY_URL}
                    className="oc-input"
                  />
                </div>
              </details>

              {error ? (
                <p className="rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--coral-soft)] px-3 py-2 text-sm text-rose-100">
                  {error}
                </p>
              ) : null}

              <button type="submit" className="oc-button-primary w-full px-5 py-3 text-base font-semibold">
                Show my usage
              </button>
            </div>

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
          </form>
        </section>
      ) : (
        <>
          <section className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[color:var(--text-secondary)]">
            <div>
              Connected to <span className="text-white">{gatewayConfig?.gatewayUrl}</span>
            </div>
            <button type="button" onClick={disconnectGateway} className="oc-button-secondary px-3 py-1.5 text-xs">
              Disconnect
            </button>
          </section>

          <section className="mt-5">
            {gatewayConfig ? (
              <UsageWindowDashboard gatewayConfig={gatewayConfig} refreshKey={usageRefreshKey} />
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
