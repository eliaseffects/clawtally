"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { StatsCard } from "@/components/StatsCard";
import type { LeaderboardPeriod, UsageWindowSummary } from "@/lib/types";

interface UsageWindowDashboardProps {
  anonymousToken: string;
  refreshKey?: number;
  sessionControls?: {
    lastSyncedLabel: string;
    syncing: boolean;
    shareEnabled: boolean;
    sharing: boolean;
    onSyncNow: () => void;
    onToggleShare: () => void;
    onDisconnect: () => void;
  };
}

type UsageWindowApiResponse = {
  success?: boolean;
  summary?: UsageWindowSummary;
  error?: string;
};

const PERIOD_OPTIONS: ReadonlyArray<LeaderboardPeriod> = ["24h", "7d", "30d", "all"];

const PERIOD_LABEL: Record<LeaderboardPeriod, string> = {
  "24h": "Today",
  "7d": "7d",
  "30d": "30d",
  all: "All",
};

const formatNumber = (value: number): string => Intl.NumberFormat("en-US").format(value);
const formatCompact = (value: number): string =>
  Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value).toUpperCase();
const formatMoney = (value: number): string =>
  Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);

const formatIsoDate = (isoDate: string): string =>
  new Date(`${isoDate}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const formatTimestamp = (iso: string): string =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

type SimpleIconSpec = {
  title: string;
  path: string;
  viewBox?: string;
};

const SIMPLE_ICONS: Record<string, SimpleIconSpec> = {
  anthropic: {
    title: "Anthropic",
    viewBox: "0 0 24 24",
    path: "M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z",
  },
  google: {
    title: "Google",
    viewBox: "0 0 24 24",
    path: "M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z",
  },
  nvidia: {
    title: "NVIDIA",
    viewBox: "0 0 24 24",
    path: "M8.948 8.798v-1.43a6.7 6.7 0 0 1 .424-.018c3.922-.124 6.493 3.374 6.493 3.374s-2.774 3.851-5.75 3.851c-.398 0-.787-.062-1.158-.185v-4.346c1.528.185 1.837.857 2.747 2.385l2.04-1.714s-1.492-1.952-4-1.952a6.016 6.016 0 0 0-.796.035m0-4.735v2.138l.424-.027c5.45-.185 9.01 4.47 9.01 4.47s-4.08 4.964-8.33 4.964c-.37 0-.733-.035-1.095-.097v1.325c.3.035.61.062.91.062 3.957 0 6.82-2.023 9.593-4.408.459.371 2.34 1.263 2.73 1.652-2.633 2.208-8.772 3.984-12.253 3.984-.335 0-.653-.018-.971-.053v1.864H24V4.063zm0 10.326v1.131c-3.657-.654-4.673-4.46-4.673-4.46s1.758-1.944 4.673-2.262v1.237H8.94c-1.528-.186-2.73 1.245-2.73 1.245s.68 2.412 2.739 3.11M2.456 10.9s2.164-3.197 6.5-3.533V6.201C4.153 6.59 0 10.653 0 10.653s2.35 6.802 8.948 7.42v-1.237c-4.84-.6-6.492-5.936-6.492-5.936z",
  },
  openrouter: {
    title: "OpenRouter",
    viewBox: "0 0 24 24",
    path: "M16.778 1.844v1.919q-.569-.026-1.138-.032-.708-.008-1.415.037c-1.93.126-4.023.728-6.149 2.237-2.911 2.066-2.731 1.95-4.14 2.75-.396.223-1.342.574-2.185.798-.841.225-1.753.333-1.751.333v4.229s.768.108 1.61.333c.842.224 1.789.575 2.185.799 1.41.798 1.228.683 4.14 2.75 2.126 1.509 4.22 2.11 6.148 2.236.88.058 1.716.041 2.555.005v1.918l7.222-4.168-7.222-4.17v2.176c-.86.038-1.611.065-2.278.021-1.364-.09-2.417-.357-3.979-1.465-2.244-1.593-2.866-2.027-3.68-2.508.889-.518 1.449-.906 3.822-2.59 1.56-1.109 2.614-1.377 3.978-1.466.667-.044 1.418-.017 2.278.02v2.176L24 6.014Z",
  },
  openai: {
    title: "OpenAI",
    viewBox: "0 0 24 24",
    path: "M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z",
  },
  telegram: {
    title: "Telegram",
    viewBox: "0 0 24 24",
    path: "M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z",
  },
};

function SimpleIcon({ icon, className = "" }: { icon: SimpleIconSpec; className?: string }) {
  return (
    <svg
      role="img"
      viewBox={icon.viewBox ?? "0 0 24 24"}
      className={["shrink-0", className].filter(Boolean).join(" ")}
      aria-label={icon.title}
    >
      <title>{icon.title}</title>
      <path d={icon.path} fill="currentColor" />
    </svg>
  );
}

function IconFrame({
  label,
  tone = "neutral",
  children,
}: {
  label: string;
  tone?: "neutral" | "cyan" | "coral";
  children: ReactNode;
}) {
  const toneClass =
    tone === "cyan"
      ? "text-[color:var(--cyan-bright)] shadow-[0_0_24px_rgba(25,226,197,0.18)]"
      : tone === "coral"
        ? "text-[color:var(--coral-bright)] shadow-[0_0_24px_rgba(255,92,87,0.14)]"
        : "text-white/80 shadow-[0_0_22px_rgba(25,226,197,0.12)]";

  return (
    <span
      title={label}
      aria-label={label}
      className={[
        "inline-flex size-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/20",
        toneClass,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

const normalizeToken = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, "");

function ProviderGlyph({ provider }: { provider?: string | null }) {
  const raw = provider?.trim();
  const normalized = raw ? normalizeToken(raw) : "";

  if (!raw) {
    return (
      <IconFrame label="Provider: unknown">
        <span className="text-[11px] font-black leading-none">?</span>
      </IconFrame>
    );
  }

  if (normalized.includes("openclaw")) {
    return (
      <IconFrame label="OpenClaw" tone="coral">
        <span className="text-[15px] leading-none">🦞</span>
      </IconFrame>
    );
  }

  if (normalized.includes("openrouter")) {
    return (
      <IconFrame label="OpenRouter" tone="cyan">
        <SimpleIcon icon={SIMPLE_ICONS.openrouter} className="size-4" />
      </IconFrame>
    );
  }

  if (normalized.includes("anthropic")) {
    return (
      <IconFrame label="Anthropic">
        <SimpleIcon icon={SIMPLE_ICONS.anthropic} className="size-4" />
      </IconFrame>
    );
  }

  if (normalized.includes("nvidia")) {
    return (
      <IconFrame label="NVIDIA">
        <SimpleIcon icon={SIMPLE_ICONS.nvidia} className="size-4" />
      </IconFrame>
    );
  }

  if (normalized.includes("google") || normalized.includes("gemini") || normalized.includes("vertex")) {
    return (
      <IconFrame label="Google">
        <SimpleIcon icon={SIMPLE_ICONS.google} className="size-4" />
      </IconFrame>
    );
  }

  if (normalized.includes("openai") || normalized.includes("codex")) {
    return (
      <IconFrame label="OpenAI" tone="cyan">
        <SimpleIcon icon={SIMPLE_ICONS.openai} className="size-4" />
      </IconFrame>
    );
  }

  return (
    <IconFrame label={raw}>
      <span className="text-[11px] font-black leading-none">{raw.slice(0, 1).toUpperCase()}</span>
    </IconFrame>
  );
}

function ToolIconSvg({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function ToolGlyph({ tool }: { tool: string }) {
  const normalized = tool.trim().toLowerCase();

  const glyph = (() => {
    if (normalized === "exec") {
      return (
        <ToolIconSvg>
          <path d="M6 8l4 4-4 4" />
          <path d="M12 16h6" />
        </ToolIconSvg>
      );
    }

    if (normalized === "read") {
      return (
        <ToolIconSvg>
          <path d="M8 4h8l4 4v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
          <path d="M16 4v4h4" />
        </ToolIconSvg>
      );
    }

    if (normalized.includes("search")) {
      return (
        <ToolIconSvg>
          <circle cx="11" cy="11" r="6" />
          <path d="M20 20l-3.5-3.5" />
        </ToolIconSvg>
      );
    }

    if (normalized.includes("fetch")) {
      return (
        <ToolIconSvg>
          <path d="M12 3v11" />
          <path d="M8 10l4 4 4-4" />
          <path d="M5 20h14" />
        </ToolIconSvg>
      );
    }

    if (normalized.includes("browser")) {
      return (
        <ToolIconSvg>
          <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
          <path d="M4 9h16" />
          <path d="M8 6h.01" />
          <path d="M11 6h.01" />
        </ToolIconSvg>
      );
    }

    if (normalized.includes("edit")) {
      return (
        <ToolIconSvg>
          <path d="M4 20h6" />
          <path d="M14.5 5.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
        </ToolIconSvg>
      );
    }

    if (normalized.includes("status")) {
      return (
        <ToolIconSvg>
          <path d="M4 12h4l2-4 3 8 2-4h5" />
        </ToolIconSvg>
      );
    }

    if (normalized.includes("process")) {
      return (
        <ToolIconSvg>
          <path d="M9 9h6v6H9z" />
          <path d="M9 2v3" />
          <path d="M15 2v3" />
          <path d="M9 19v3" />
          <path d="M15 19v3" />
          <path d="M2 9h3" />
          <path d="M2 15h3" />
          <path d="M19 9h3" />
          <path d="M19 15h3" />
        </ToolIconSvg>
      );
    }

    if (normalized.includes("gateway")) {
      return (
        <ToolIconSvg>
          <path d="M10 7h10" />
          <path d="M14 3l-4 4 4 4" />
          <path d="M4 12v7a2 2 0 0 0 2 2h12" />
        </ToolIconSvg>
      );
    }

    return (
      <ToolIconSvg>
        <path d="M12 6v12" />
        <path d="M6 12h12" />
      </ToolIconSvg>
    );
  })();

  return (
    <IconFrame label={`Tool: ${tool}`} tone="cyan">
      {glyph}
    </IconFrame>
  );
}

function ChannelGlyph({ channel }: { channel?: string | null }) {
  const raw = channel?.trim();
  const normalized = raw ? normalizeToken(raw) : "";

  if (!raw) {
    return (
      <IconFrame label="Channel: unknown">
        <span className="text-[11px] font-black leading-none">?</span>
      </IconFrame>
    );
  }

  if (normalized.includes("telegram")) {
    return (
      <IconFrame label="Telegram" tone="cyan">
        <SimpleIcon icon={SIMPLE_ICONS.telegram} className="size-4" />
      </IconFrame>
    );
  }

  if (normalized.includes("webchat")) {
    return (
      <IconFrame label="Webchat" tone="coral">
        <ToolIconSvg>
          <path d="M6 7h12a3 3 0 0 1 3 3v3a3 3 0 0 1-3 3H11l-4 3v-3H6a3 3 0 0 1-3-3v-3a3 3 0 0 1 3-3Z" />
          <path d="M7.5 12h4" />
          <path d="M13.5 12h3" />
        </ToolIconSvg>
      </IconFrame>
    );
  }

  return (
    <IconFrame label={raw}>
      <span className="text-[11px] font-black leading-none">{raw.slice(0, 1).toUpperCase()}</span>
    </IconFrame>
  );
}

function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={[
        "inline-block size-4 animate-spin rounded-full border-2 border-white/20 border-t-white/80",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden="true"
    />
  );
}

const formatPercent = (value: number | null): string => {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }
  return `${(value * 100).toFixed(1)}%`;
};

const formatDurationMs = (value: number | null | undefined): string => {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) {
    return "--";
  }

  const totalSeconds = Math.round(value / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const totalMinutes = Math.round(totalSeconds / 60);
  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 24) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
};

const buildTrendPath = (
  values: number[],
): {
  linePath: string;
  areaPath: string;
  max: number;
  min: number;
  xStart: number;
  xEnd: number;
  yBase: number;
} | null => {
  if (values.length < 2) {
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

  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || 1;

  const coords = values.map((value, index) => {
    const x = padLeft + (index / (values.length - 1)) * innerWidth;
    const normalized = (value - min) / spread;
    const y = padTop + (1 - normalized) * innerHeight;
    return { x, y };
  });

  const linePath = coords.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
  const first = coords[0];
  const last = coords[coords.length - 1];
  const yBase = height - padBottom;
  const areaPath = `${linePath} L ${last.x.toFixed(2)} ${yBase.toFixed(2)} L ${first.x.toFixed(2)} ${yBase.toFixed(2)} Z`;

  return { linePath, areaPath, max, min, xStart: first.x, xEnd: last.x, yBase };
};

export function UsageWindowDashboard({ anonymousToken, refreshKey, sessionControls }: UsageWindowDashboardProps) {
  const [period, setPeriod] = useState<LeaderboardPeriod>("30d");
  const [summary, setSummary] = useState<UsageWindowSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = async (activePeriod: LeaderboardPeriod) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/usage/window", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anonymousToken,
          period: activePeriod,
        }),
      });

      const body = (await response.json()) as UsageWindowApiResponse;
      if (!response.ok || !body.summary) {
        throw new Error(body.error ?? "Unable to load usage window");
      }

      setSummary(body.summary);
    } catch (loadError: unknown) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load usage window";
      setError(message);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary(period);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anonymousToken, period, refreshKey]);

  const isRefreshing = loading && summary !== null;
  const isInitialLoading = loading && summary === null;

  const tokenBreakdown = useMemo(() => {
    if (!summary) {
      return null;
    }

    const denom = Math.max(summary.totals.totalTokens, 1);
    return {
      input: summary.totals.inputTokens / denom,
      output: summary.totals.outputTokens / denom,
      cacheRead: summary.totals.cacheReadTokens / denom,
      cacheWrite: summary.totals.cacheWriteTokens / denom,
    };
  }, [summary]);

  const costBreakdown = useMemo(() => {
    if (!summary) {
      return null;
    }

    const denom = Math.max(summary.totals.totalCost, 1e-9);
    return {
      input: summary.totals.inputCost / denom,
      output: summary.totals.outputCost / denom,
      cacheRead: summary.totals.cacheReadCost / denom,
      cacheWrite: summary.totals.cacheWriteCost / denom,
    };
  }, [summary]);

  const dailyTokens = useMemo(() => summary?.daily.map((point) => point.totalTokens) ?? [], [summary]);
  const trendGeometry = useMemo(() => buildTrendPath(dailyTokens), [dailyTokens]);

  return (
    <div className="space-y-6">
      <section className="oc-panel p-4 md:p-5">
        <div className="flex flex-col gap-4">
          {sessionControls ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[color:var(--text-secondary)]">
                Last updated: {sessionControls.lastSyncedLabel}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={sessionControls.onSyncNow}
                  disabled={sessionControls.syncing}
                  className="oc-button-primary px-4 py-2 text-sm"
                >
                  {sessionControls.syncing ? (
                    <span className="inline-flex items-center gap-2">
                      <Spinner className="size-4 border-white/25 border-t-white/90" />
                      Syncing...
                    </span>
                  ) : (
                    "Sync Now"
                  )}
                </button>
                <button
                  type="button"
                  onClick={sessionControls.onToggleShare}
                  disabled={sessionControls.sharing}
                  className="oc-button-secondary px-4 py-2 text-sm"
                >
                  {sessionControls.sharing ? (
                    <span className="inline-flex items-center gap-2">
                      <Spinner className="size-4 border-white/25 border-t-white/80" />
                      Updating...
                    </span>
                  ) : sessionControls.shareEnabled ? (
                    "Sharing Enabled"
                  ) : (
                    "Enable Sharing"
                  )}
                </button>
                <button
                  type="button"
                  onClick={sessionControls.onDisconnect}
                  className="oc-button-secondary px-4 py-2 text-sm"
                >
                  Disconnect
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="oc-kicker">Usage Window</p>
              <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
                Same read-only telemetry you see at{" "}
                <code className="font-[family-name:var(--font-mono)]">http://127.0.0.1:18789/usage</code>.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
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
                    {PERIOD_LABEL[option]}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => fetchSummary(period)}
                disabled={loading}
                className="oc-nav-link !gap-2 !px-3 !py-2 text-xs"
              >
                {loading ? (
                  <>
                    <Spinner className="size-3.5" />
                    Loading
                  </>
                ) : (
                  "Refresh"
                )}
              </button>
            </div>
          </div>

          <div className="oc-trust rounded-lg px-3 py-2 text-xs text-[color:var(--text-secondary)]">
            Safety: read-only usage telemetry. ClawBoard cannot execute tasks, call tools, or modify files on your machine.
          </div>

          {summary ? (
            <p className="text-xs text-[color:var(--text-muted)]">
              Range: {formatIsoDate(summary.startDate)} to {formatIsoDate(summary.endDate)} • Updated:{" "}
              {formatTimestamp(summary.fetchedAt)}
            </p>
          ) : (
            <p className="text-xs text-[color:var(--text-muted)]">
              {isInitialLoading ? "Loading usage window..." : "Select a window and refresh to load usage."}
            </p>
          )}
        </div>
      </section>

      {error ? (
        <p className="rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--coral-soft)] px-3 py-2 text-sm text-rose-100">
          {error}
        </p>
      ) : null}

      {isInitialLoading ? (
        <div className="space-y-6">
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, index) => (
              <div key={index} className="oc-panel animate-pulse p-4">
                <div className="h-3 w-24 rounded bg-white/10" />
                <div className="mt-3 h-8 w-28 rounded bg-white/10" />
                <div className="mt-3 h-3 w-36 rounded bg-white/10" />
              </div>
            ))}
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="oc-panel animate-pulse p-4 md:p-5">
                <div className="h-4 w-44 rounded bg-white/10" />
                <div className="mt-4 h-[210px] rounded-xl border border-white/8 bg-white/5 md:h-[250px]" />
              </div>
            ))}
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="oc-panel animate-pulse p-4 md:p-5">
                <div className="h-4 w-40 rounded bg-white/10" />
                <div className="mt-4 space-y-3">
                  {Array.from({ length: 5 }).map((__, rowIndex) => (
                    <div key={rowIndex}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="h-3 w-44 rounded bg-white/10" />
                        <div className="h-3 w-20 rounded bg-white/10" />
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-white/10" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        </div>
      ) : !summary ? (
        <section className="oc-panel p-6 md:p-8">
          <h3 className="text-base font-semibold">Usage window unavailable</h3>
          <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
            Click <span className="font-semibold text-white">Refresh</span> to try again. If this keeps happening,
            confirm your local OpenClaw gateway is running and you connected from this dashboard.
          </p>
        </section>
      ) : (
        <div className={isRefreshing ? "opacity-75 transition-opacity" : ""}>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatsCard
              label="Total Tokens"
              value={formatCompact(summary.totals.totalTokens)}
              caption={`${formatCompact(summary.totals.inputTokens + summary.totals.outputTokens)} prompt + output`}
              tone="cyan"
            />
            <StatsCard
              label="Total Cost"
              value={formatMoney(summary.totals.totalCost)}
              caption={`${formatMoney(summary.totals.inputCost)} input spend`}
              tone="coral"
            />
            <StatsCard
              label="Messages"
              value={formatNumber(summary.messages.total)}
              caption={`${formatNumber(summary.messages.user)} user · ${formatNumber(summary.messages.assistant)} assistant`}
              tone="cyan"
            />
            <StatsCard
              label="Tool Calls"
              value={formatNumber(summary.tools.totalCalls)}
              caption={`${formatNumber(summary.tools.uniqueTools)} unique tools`}
              tone="coral"
            />
            <StatsCard
              label="Sessions"
              value={formatNumber(summary.sessionCount)}
              caption={`Range: ${period === "all" ? "all time" : period}`}
              tone="cyan"
            />

            <StatsCard
              label="Error Rate"
              value={formatPercent(summary.derived.errorRate)}
              caption={`${formatNumber(summary.messages.errors)} errors tracked`}
              tone="coral"
            />
            <StatsCard
              label="Cache Hit"
              value={formatPercent(summary.derived.cacheHitRate)}
              caption={`${formatCompact(summary.totals.cacheReadTokens)} cache read tokens`}
              tone="cyan"
            />
            <StatsCard
              label="Throughput"
              value={summary.derived.throughputTokensPerMin === null ? "--" : `${formatCompact(summary.derived.throughputTokensPerMin)}/min`}
              caption={
                summary.latency ? `${formatDurationMs(summary.latency.avgMs)} avg latency` : `${formatDurationMs(summary.derived.avgDurationMs)} avg duration`
              }
              tone="coral"
            />
            <StatsCard
              label="Avg Tokens/Msg"
              value={summary.derived.avgTokensPerMessage === null ? "--" : formatCompact(summary.derived.avgTokensPerMessage)}
              caption={summary.derived.avgCostPerMessage === null ? "Cost unavailable" : `${formatMoney(summary.derived.avgCostPerMessage)} avg cost/message`}
              tone="cyan"
            />
            <StatsCard
              label="Latency P95"
              value={summary.latency ? formatDurationMs(summary.latency.p95Ms) : "--"}
              caption={summary.latency ? `${formatNumber(summary.latency.count)} latency samples` : "No latency samples"}
              tone="coral"
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <article className="oc-panel p-4 md:p-5">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold">Daily token trend</h3>
                  <p className="mt-1 text-sm text-[color:var(--text-secondary)]">Total tokens by day in this window.</p>
                </div>
                <p className="text-xs text-[color:var(--text-muted)]">
                  Peak {trendGeometry ? formatCompact(trendGeometry.max) : "--"} • Low {trendGeometry ? formatCompact(trendGeometry.min) : "--"}
                </p>
              </div>

              {trendGeometry ? (
                <div className="mt-4 overflow-hidden rounded-xl border border-white/8 bg-[rgba(10,18,31,0.55)] p-2">
                  <svg viewBox="0 0 900 300" className="h-[210px] w-full md:h-[250px]" role="img" aria-label="Daily tokens chart">
                    <defs>
                      <linearGradient id="usageTrendAreaFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(25, 226, 197, 0.5)" />
                        <stop offset="55%" stopColor="rgba(25, 226, 197, 0.16)" />
                        <stop offset="100%" stopColor="rgba(25, 226, 197, 0.04)" />
                      </linearGradient>
                      <linearGradient id="usageTrendLineStroke" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#4ee4d1" />
                        <stop offset="70%" stopColor="#19e2c5" />
                        <stop offset="100%" stopColor="#ff5c57" />
                      </linearGradient>
                    </defs>

                    {[0, 1, 2, 3, 4].map((index) => {
                      const y = 16 + (index / 4) * (300 - 16 - 34);
                      return <line key={index} x1={26} x2={886} y1={y} y2={y} stroke="rgba(148, 163, 184, 0.14)" strokeWidth={1} />;
                    })}

                    <path d={trendGeometry.areaPath} fill="url(#usageTrendAreaFill)" />
                    <path
                      d={trendGeometry.linePath}
                      fill="none"
                      stroke="url(#usageTrendLineStroke)"
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-white/8 bg-[rgba(10,18,31,0.55)] p-5 text-sm text-[color:var(--text-secondary)]">
                  Not enough data to render chart yet.
                </div>
              )}
            </article>

            <article className="oc-panel p-4 md:p-5">
              <h3 className="text-lg font-semibold">Token and cost mix</h3>
              <p className="mt-1 text-sm text-[color:var(--text-secondary)]">Input, output, and cache contribution.</p>

              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Tokens</p>
                  <div className="mt-2 h-3 overflow-hidden rounded-full border border-white/10 bg-white/5">
                    {tokenBreakdown ? (
                      <div className="flex h-full w-full">
                        <div className="h-full bg-[#4ee4d1]" style={{ width: `${(tokenBreakdown.output * 100).toFixed(2)}%` }} />
                        <div className="h-full bg-[#19e2c5]" style={{ width: `${(tokenBreakdown.input * 100).toFixed(2)}%` }} />
                        <div className="h-full bg-[#a78bfa]" style={{ width: `${(tokenBreakdown.cacheWrite * 100).toFixed(2)}%` }} />
                        <div className="h-full bg-[#7dd3fc]" style={{ width: `${(tokenBreakdown.cacheRead * 100).toFixed(2)}%` }} />
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-[color:var(--text-secondary)]">
                    <span className="inline-flex items-center gap-2">
                      <span className="size-2 rounded-full bg-[#4ee4d1]" /> Output {formatCompact(summary.totals.outputTokens)}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <span className="size-2 rounded-full bg-[#19e2c5]" /> Input {formatCompact(summary.totals.inputTokens)}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <span className="size-2 rounded-full bg-[#a78bfa]" /> Cache write {formatCompact(summary.totals.cacheWriteTokens)}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <span className="size-2 rounded-full bg-[#7dd3fc]" /> Cache read {formatCompact(summary.totals.cacheReadTokens)}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Cost</p>
                  <div className="mt-2 h-3 overflow-hidden rounded-full border border-white/10 bg-white/5">
                    {costBreakdown ? (
                      <div className="flex h-full w-full">
                        <div className="h-full bg-[#ff8e6b]" style={{ width: `${(costBreakdown.output * 100).toFixed(2)}%` }} />
                        <div className="h-full bg-[#ff5c57]" style={{ width: `${(costBreakdown.input * 100).toFixed(2)}%` }} />
                        <div className="h-full bg-[#f472b6]" style={{ width: `${(costBreakdown.cacheWrite * 100).toFixed(2)}%` }} />
                        <div className="h-full bg-[#fb7185]" style={{ width: `${(costBreakdown.cacheRead * 100).toFixed(2)}%` }} />
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-[color:var(--text-secondary)]">
                    <span className="inline-flex items-center gap-2">
                      <span className="size-2 rounded-full bg-[#ff8e6b]" /> Output {formatMoney(summary.totals.outputCost)}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <span className="size-2 rounded-full bg-[#ff5c57]" /> Input {formatMoney(summary.totals.inputCost)}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <span className="size-2 rounded-full bg-[#f472b6]" /> Cache write {formatMoney(summary.totals.cacheWriteCost)}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <span className="size-2 rounded-full bg-[#fb7185]" /> Cache read {formatMoney(summary.totals.cacheReadCost)}
                    </span>
                  </div>
                </div>
              </div>

              {summary.derived.peakErrorDay ? (
                <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-[color:var(--text-secondary)]">
                  <p className="oc-kicker">Peak Error Day</p>
                  <p className="mt-2">
                    {summary.derived.peakErrorDay.date}: {formatPercent(summary.derived.peakErrorDay.rate)} ({formatNumber(summary.derived.peakErrorDay.errors)} errors)
                  </p>
                </div>
              ) : null}
            </article>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <article className="oc-panel p-4 md:p-5">
              <h3 className="text-lg font-semibold">Top models</h3>
              <p className="mt-1 text-sm text-[color:var(--text-secondary)]">Token-heavy models in this window.</p>
              <ul className="mt-4 space-y-3">
                {summary.byModel.slice(0, 8).map((row) => (
                  <li key={`${row.provider ?? "unknown"}::${row.model ?? "unknown"}`}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0 flex items-center gap-2">
                        <ProviderGlyph provider={row.provider} />
                        <span className="min-w-0 truncate">
                          {(() => {
                            const providerPrefix = row.provider ? `${row.provider}/` : "";
                            const model = row.model ?? "unknown";
                            if (providerPrefix && model.startsWith(providerPrefix)) {
                              return model;
                            }
                            return `${providerPrefix}${model}`;
                          })()}
                        </span>
                      </div>
                      <span className="shrink-0 font-[family-name:var(--font-mono)] text-[color:var(--text-secondary)]">
                        {formatCompact(row.totalTokens)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/7">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[color:var(--cyan-mid)] to-[color:var(--cyan-bright)]"
                        style={{
                          width: `${Math.max(
                            6,
                            Math.round(
                              (row.totalTokens /
                                Math.max(
                                  1,
                                  ...summary.byModel.slice(0, 8).map((candidate) => candidate.totalTokens),
                                )) *
                                100,
                            ),
                          )}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </article>

            <article className="oc-panel p-4 md:p-5">
              <h3 className="text-lg font-semibold">Top tools</h3>
              <p className="mt-1 text-sm text-[color:var(--text-secondary)]">Most-invoked tools in this window.</p>
              <ul className="mt-4 space-y-3">
                {summary.tools.tools.slice(0, 8).map((tool) => (
                  <li key={tool.name}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0 flex items-center gap-2">
                        <ToolGlyph tool={tool.name} />
                        <span className="min-w-0 truncate">{tool.name}</span>
                      </div>
                      <span className="font-[family-name:var(--font-mono)] text-[color:var(--text-secondary)]">
                        {formatNumber(tool.count)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/7">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[color:var(--cyan-mid)] to-[color:var(--cyan-bright)]"
                        style={{
                          width: `${Math.max(
                            6,
                            Math.round(
                              (tool.count / Math.max(1, ...summary.tools.tools.slice(0, 8).map((candidate) => candidate.count))) * 100,
                            ),
                          )}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </article>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <article className="oc-panel p-4 md:p-5">
              <h3 className="text-lg font-semibold">Top providers</h3>
              <p className="mt-1 text-sm text-[color:var(--text-secondary)]">Providers ranked by token volume.</p>
              <ul className="mt-4 space-y-3">
                {summary.byProvider.slice(0, 8).map((row) => (
                  <li key={row.provider ?? "unknown"}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0 flex items-center gap-2">
                        <ProviderGlyph provider={row.provider} />
                        <span className="min-w-0 truncate">{row.provider ?? "unknown"}</span>
                      </div>
                      <span className="shrink-0 font-[family-name:var(--font-mono)] text-[color:var(--text-secondary)]">
                        {formatCompact(row.totalTokens)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/7">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[color:var(--cyan-mid)] to-[color:var(--cyan-bright)]"
                        style={{
                          width: `${Math.max(
                            6,
                            Math.round(
                              (row.totalTokens /
                                Math.max(
                                  1,
                                  ...summary.byProvider.slice(0, 8).map((candidate) => candidate.totalTokens),
                                )) *
                                100,
                            ),
                          )}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </article>

            <article className="oc-panel p-4 md:p-5">
              <h3 className="text-lg font-semibold">Top channels</h3>
              <p className="mt-1 text-sm text-[color:var(--text-secondary)]">Where traffic is flowing inside OpenClaw.</p>
              <ul className="mt-4 space-y-3">
                {summary.byChannel.slice(0, 8).map((row) => (
                  <li key={row.channel ?? "unknown"}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0 flex items-center gap-2">
                        <ChannelGlyph channel={row.channel} />
                        <span className="min-w-0 truncate">{row.channel ?? "unknown"}</span>
                      </div>
                      <span className="shrink-0 font-[family-name:var(--font-mono)] text-[color:var(--text-secondary)]">
                        {formatCompact(row.totalTokens)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/7">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[color:var(--cyan-mid)] to-[color:var(--cyan-bright)]"
                        style={{
                          width: `${Math.max(
                            6,
                            Math.round(
                              (row.totalTokens /
                                Math.max(
                                  1,
                                  ...summary.byChannel.slice(0, 8).map((candidate) => candidate.totalTokens),
                                )) *
                                100,
                            ),
                          )}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </article>
          </section>
        </div>
      )}
    </div>
  );
}
