"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

interface ConnectResponse {
  success: boolean;
  anonymousToken: string;
}

interface LocalConnector {
  origin: string;
  name: string;
  version: string;
  gatewayUrl?: string;
  hasGatewayToken?: boolean;
}

interface LocalConnectorDiscoveryResponse {
  name?: string;
  version?: string;
  gatewayUrl?: string;
  hasGatewayToken?: boolean;
}

interface LocalConnectorSessionResponse {
  gatewayUrl?: string;
  apiKey?: string;
}

type DiscoveryStatus = "probing" | "found" | "missing";

type ConnectFormVariant = "panel" | "embedded" | "hero";

interface ConnectFormProps {
  variant?: ConnectFormVariant;
  className?: string;
  redirectTo?: string | null;
  onConnected?: (payload: { anonymousToken: string; gatewayUrl: string }) => void;
  showManual?: boolean;
  autoConnect?: boolean;
}

const CONNECTOR_ORIGINS = [
  "http://127.0.0.1:18888",
  "http://localhost:18888",
  "http://127.0.0.1:18889",
  "http://localhost:18889",
] as const;

const DISCOVERY_PATH = "/v1/clawboard/discovery";
const SESSION_PATH = "/v1/clawboard/session";

const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs: number = 1200) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timeout);
  }
};

const detectLocalConnector = async (): Promise<LocalConnector | null> => {
  for (const origin of CONNECTOR_ORIGINS) {
    try {
      const response = await fetchWithTimeout(`${origin}${DISCOVERY_PATH}`);
      if (!response.ok) {
        continue;
      }

      const body = (await response.json()) as LocalConnectorDiscoveryResponse;
      if (!body || typeof body !== "object") {
        continue;
      }

      return {
        origin,
        name: typeof body.name === "string" && body.name.length > 0 ? body.name : "Local Connector",
        version: typeof body.version === "string" && body.version.length > 0 ? body.version : "unknown",
        gatewayUrl: typeof body.gatewayUrl === "string" ? body.gatewayUrl : undefined,
        hasGatewayToken: body.hasGatewayToken,
      };
    } catch {
      // Keep probing other candidate origins.
    }
  }

  return null;
};

export function ConnectForm({
  variant = "panel",
  className = "",
  redirectTo = "/dashboard",
  onConnected,
  showManual = true,
  autoConnect = false,
}: ConnectFormProps) {
  const router = useRouter();
  const [gatewayUrl, setGatewayUrl] = useState("ws://127.0.0.1:18789");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [discoveryStatus, setDiscoveryStatus] = useState<DiscoveryStatus>("probing");
  const [connector, setConnector] = useState<LocalConnector | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [autoConnectAttempted, setAutoConnectAttempted] = useState(false);

  const connectAndSync = async (
    credentials: { gatewayUrl: string; apiKey?: string },
    options: { persistApiKey: boolean },
  ) => {
    const connectResponse = await fetch("/api/connect", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        gatewayUrl: credentials.gatewayUrl,
        apiKey: credentials.apiKey ?? "",
      }),
    });

    if (!connectResponse.ok) {
      const body = (await connectResponse.json()) as { error?: string };
      throw new Error(body.error ?? "Failed to connect");
    }

    const connectData = (await connectResponse.json()) as ConnectResponse;

    localStorage.setItem("clawboard.token", connectData.anonymousToken);
    localStorage.setItem("clawboard.gatewayUrl", credentials.gatewayUrl);

    if (options.persistApiKey && credentials.apiKey) {
      localStorage.setItem("clawboard.apiKey", credentials.apiKey);
    } else {
      localStorage.removeItem("clawboard.apiKey");
    }

    const syncResponse = await fetch("/api/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        anonymousToken: connectData.anonymousToken,
        gatewayUrl: credentials.gatewayUrl,
        ...(credentials.apiKey ? { apiKey: credentials.apiKey } : {}),
      }),
    });

    if (!syncResponse.ok) {
      const body = (await syncResponse.json()) as { error?: string };
      throw new Error(body.error ?? "Connected but failed to sync usage");
    }

    onConnected?.({ anonymousToken: connectData.anonymousToken, gatewayUrl: credentials.gatewayUrl });
    if (redirectTo) {
      router.push(redirectTo);
    }
  };

  useEffect(() => {
    let active = true;

    const probe = async () => {
      const found = await detectLocalConnector();
      if (!active) {
        return;
      }

      if (!found) {
        setDiscoveryStatus("missing");
        setConnector(null);
        return;
      }

      setConnector(found);
      setDiscoveryStatus("found");
      if (found.gatewayUrl) {
        setGatewayUrl(found.gatewayUrl);
      }
    };

    probe();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!autoConnect || autoConnectAttempted || discoveryStatus !== "found" || !connector || loading) {
      return;
    }

    setAutoConnectAttempted(true);
    onConnectorConnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConnect, autoConnectAttempted, discoveryStatus, connector, loading]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await connectAndSync(
        {
          gatewayUrl,
          apiKey,
        },
        { persistApiKey: true },
      );
    } catch (connectError: unknown) {
      const message = connectError instanceof Error ? connectError.message : "Network error while connecting";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const onConnectorConnect = async () => {
    if (!connector) {
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const sessionResponse = await fetchWithTimeout(
        `${connector.origin}${SESSION_PATH}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ scope: "usage.read" }),
        },
        4000,
      );

      if (!sessionResponse.ok) {
        const body = (await sessionResponse.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Local connector is reachable but session request failed");
      }

      const session = (await sessionResponse.json()) as LocalConnectorSessionResponse;
      const resolvedGatewayUrl = session.gatewayUrl ?? connector.gatewayUrl;

      if (!resolvedGatewayUrl) {
        throw new Error("Local connector did not provide a gateway URL");
      }

      await connectAndSync(
        {
          gatewayUrl: resolvedGatewayUrl,
          apiKey: session.apiKey,
        },
        { persistApiKey: false },
      );
    } catch (connectError: unknown) {
      const message = connectError instanceof Error ? connectError.message : "One-click connector flow failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const wrapperClassName =
    variant === "embedded"
      ? ["space-y-5", className].filter(Boolean).join(" ")
      : variant === "hero"
        ? ["space-y-4", className].filter(Boolean).join(" ")
      : ["oc-panel space-y-5 p-5 md:p-6", className].filter(Boolean).join(" ");

  return (
    <form onSubmit={onSubmit} className={wrapperClassName}>
      {variant === "hero" ? (
        <section className="rounded-2xl border border-white/10 bg-[linear-gradient(160deg,rgba(13,20,34,0.92)_0%,rgba(10,16,29,0.96)_100%)] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.45)] md:p-6">
          <p className="oc-kicker text-[color:var(--cyan-bright)]">Read-Only Connect</p>
          <h2 className="mt-2 text-2xl font-semibold">Connect your local OpenClaw usage.</h2>
          <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
            Link your local gateway to unlock a complete usage snapshot across tokens, cost, models, tools, cache, and error rates.
          </p>

          <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="oc-kicker">One-Click Local Connect</p>

            {discoveryStatus === "probing" ? (
              <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
                Searching for your local Clawtally connector...
                {autoConnect ? " We will connect automatically when it is detected." : null}
              </p>
            ) : null}

            {discoveryStatus === "found" && connector ? (
              <div className="mt-3 space-y-3">
                <p className="text-sm text-[color:var(--text-secondary)]">
                  Detected <span className="font-semibold text-white">{connector.name}</span> v{connector.version}
                </p>
                <button
                  type="button"
                  disabled={loading}
                  onClick={onConnectorConnect}
                  className="oc-button-primary w-full px-5 py-3 text-base font-semibold"
                >
                  {loading ? "Connecting..." : "Connect Local OpenClaw"}
                </button>
              </div>
            ) : null}

            {discoveryStatus === "missing" && showManual ? (
              <div className="mt-3 space-y-3">
                <p className="text-sm text-[color:var(--text-secondary)]">
                  Local connector not found. You can still connect manually, or run the connector and refresh.
                </p>
                <button
                  type="button"
                  className="oc-button-secondary w-full px-5 py-3 text-base font-semibold"
                  onClick={() => setManualOpen(true)}
                >
                  Manual Connect
                </button>
              </div>
            ) : null}

            {discoveryStatus === "missing" && !showManual ? (
              <div className="mt-3 space-y-3">
                <p className="text-sm text-[color:var(--text-secondary)]">
                  Local connector not found. Start the connector on this machine, then retry.
                </p>
                <button
                  type="button"
                  className="oc-button-secondary w-full px-5 py-3 text-base font-semibold"
                  onClick={() => {
                    setDiscoveryStatus("probing");
                    setConnector(null);
                    setError(null);
                    detectLocalConnector()
                      .then((found) => {
                        if (found) {
                          setConnector(found);
                          setDiscoveryStatus("found");
                          if (found.gatewayUrl) {
                            setGatewayUrl(found.gatewayUrl);
                          }
                        } else {
                          setDiscoveryStatus("missing");
                        }
                      })
                      .catch(() => setDiscoveryStatus("missing"));
                  }}
                >
                  Retry Detection
                </button>
              </div>
            ) : null}
          </div>

          {showManual ? (
            <details
              className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4"
              open={manualOpen}
              onToggle={(event) => setManualOpen((event.target as HTMLDetailsElement).open)}
            >
              <summary className="cursor-pointer text-sm font-semibold text-[color:var(--text-secondary)]">
                Manual connect (advanced)
              </summary>

              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <label
                    htmlFor="gateway-url"
                    className="block text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]"
                  >
                    Gateway URL
                  </label>
                  <input
                    id="gateway-url"
                    type="text"
                    value={gatewayUrl}
                    onChange={(event) => setGatewayUrl(event.target.value)}
                    placeholder="ws://127.0.0.1:18789"
                    className="oc-input"
                    required
                  />
                  <p className="text-xs text-[color:var(--text-muted)]">
                    Tip: <code>http://</code> values are converted to <code>ws://</code> automatically.
                  </p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="api-key" className="block text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
                    Gateway Token
                  </label>
                  <input
                    id="api-key"
                    type="password"
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder="Optional when connector handles auth"
                    className="oc-input"
                  />
                </div>

                <button type="submit" disabled={loading} className="oc-button-secondary w-full px-5 py-3 text-base font-semibold">
                  {loading ? "Connecting..." : "Connect"}
                </button>
              </div>
            </details>
          ) : null}

          <details className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
            <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold text-[color:var(--text-secondary)]">
              Safety & privacy
              <span className="oc-pill">More info</span>
            </summary>
            <div className="mt-3 space-y-2 text-sm text-[color:var(--text-secondary)]">
              <p>
                ClawBoard is read-only. It does not send commands to your agent, does not invoke tools, and cannot execute
                tasks on your machine or in your OpenClaw stack.
              </p>
              <p>
                The connector requests usage telemetry only. We read aggregate metrics such as tokens, cost, models,
                tools, cache activity, error rates, latency, and session counts so you can visualize usage health.
              </p>
              <p>
                No files are modified, no prompts are written, and no content is injected into your workflows. You can
                disconnect at any time to revoke access and clear local session tokens.
              </p>
            </div>
          </details>

          {error ? (
            <p className="mt-4 rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--coral-soft)] px-3 py-2 text-sm text-rose-100">
              {error}
            </p>
          ) : null}
        </section>
      ) : (
        <>
          <section className="rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--coral-soft)] p-4">
            <p className="oc-kicker">One-Click Local Connect</p>

            {discoveryStatus === "probing" ? (
              <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
                Searching for your local Clawtally connector...
                {autoConnect ? " We will connect automatically when it is detected." : null}
              </p>
            ) : null}

            {discoveryStatus === "found" && connector ? (
              <div className="mt-3 space-y-3">
                <p className="text-sm text-[color:var(--text-secondary)]">
                  Detected <span className="font-semibold text-white">{connector.name}</span> v{connector.version} at{" "}
                  {connector.origin}
                </p>
                <button
                  type="button"
                  disabled={loading}
                  onClick={onConnectorConnect}
                  className="oc-button-primary w-full px-4 py-2.5 text-sm"
                >
                  {loading ? "Connecting..." : "Connect Local OpenClaw"}
                </button>
              </div>
            ) : null}

            {discoveryStatus === "missing" ? (
              <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
                Local connector not found. Use the manual fallback below.
              </p>
            ) : null}
          </section>

          <section className="rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] p-4">
            <p className="oc-kicker">Manual Connect (Advanced)</p>

            <div className="mt-3 space-y-2">
              <label htmlFor="gateway-url" className="block text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
                Gateway URL
              </label>
              <input
                id="gateway-url"
                type="text"
                value={gatewayUrl}
                onChange={(event) => setGatewayUrl(event.target.value)}
                placeholder="ws://127.0.0.1:18789"
                className="oc-input"
                required
              />
              <p className="text-xs text-[color:var(--text-muted)]">
                Tip: <code>http://</code> values are converted to <code>ws://</code> automatically.
              </p>
            </div>

            <div className="mt-4 space-y-2">
              <label htmlFor="api-key" className="block text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
                Gateway Token
              </label>
              <input
                id="api-key"
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="Optional when connector handles auth"
                className="oc-input"
              />
            </div>

            <button type="submit" disabled={loading} className="oc-button-secondary mt-4 w-full px-4 py-2.5 text-sm">
              {loading ? "Connecting..." : "Manual Connect"}
            </button>
          </section>

          <details className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[color:var(--text-secondary)]">
            <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold text-[color:var(--text-secondary)]">
              Safety & privacy
              <span className="oc-pill">More info</span>
            </summary>
            <div className="mt-3 space-y-2">
              <p>
                ClawBoard is read-only. It does not send commands to your agent, does not invoke tools, and cannot execute
                tasks on your machine or in your OpenClaw stack.
              </p>
              <p>
                The connector requests usage telemetry only. We read aggregate metrics such as tokens, cost, models,
                tools, cache activity, error rates, latency, and session counts so you can visualize usage health.
              </p>
              <p>
                No files are modified, no prompts are written, and no content is injected into your workflows. You can
                disconnect at any time to revoke access and clear local session tokens.
              </p>
            </div>
          </details>

          {error ? (
            <p className="rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--coral-soft)] px-3 py-2 text-sm text-rose-100">
              {error}
            </p>
          ) : null}
        </>
      )}
    </form>
  );
}
