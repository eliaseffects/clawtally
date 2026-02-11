const OPENROUTER_OPENCLAW_APP_URL = "https://openrouter.ai/apps?url=https%3A%2F%2Fopenclaw.ai%2F";
const OPENCLAW_ORIGIN_URL = "https://openclaw.ai/";

interface RawOpenRouterApp {
  title?: string | null;
  description?: string | null;
  origin_url?: string | null;
}

interface EcosystemModelShare {
  model: string;
  totalTokens: number;
  share: number;
}

export interface EcosystemDailyPoint {
  date: string;
  totalTokens: number;
  topModel: string;
  topModelTokens: number;
  models: Record<string, number>;
}

export interface OpenClawEcosystemSnapshot {
  appTitle: string;
  description: string;
  sourceUrl: string;
  fetchedAt: string;
  latestDate: string | null;
  daily: EcosystemDailyPoint[];
  topModels: EcosystemModelShare[];
  last24hTokens: number;
  sevenDayTokens: number;
  thirtyDayTokens: number;
  trackedDays: number;
  activeModelsToday: number;
  dominantModel: string | null;
  dominantModelTokens: number;
}

const parseJson = <T>(value: string): T | null => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

const extractJsonSegment = (source: string, anchor: string, openingChar: "{" | "["): string | null => {
  const anchorIndex = source.indexOf(anchor);
  if (anchorIndex < 0) {
    return null;
  }

  const startIndex = source.indexOf(openingChar, anchorIndex);
  if (startIndex < 0) {
    return null;
  }

  const closingChar = openingChar === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === "\"") {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === openingChar) {
      depth += 1;
      continue;
    }

    if (char === closingChar) {
      depth -= 1;
      if (depth === 0) {
        return source.slice(startIndex, index + 1);
      }
    }
  }

  return null;
};

const toNumberRecord = (value: unknown): Record<string, number> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const out: Record<string, number> = {};
  for (const [key, current] of Object.entries(value as Record<string, unknown>)) {
    if (typeof current === "number" && Number.isFinite(current)) {
      out[key] = current;
    }
  }
  return out;
};

const toDailyPoints = (value: unknown): EcosystemDailyPoint[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const out: EcosystemDailyPoint[] = [];

  for (const row of value) {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      continue;
    }

    const candidate = row as { x?: unknown; ys?: unknown };
    if (typeof candidate.x !== "string") {
      continue;
    }

    const date = candidate.x.slice(0, 10);
    if (!date) {
      continue;
    }

    const models = toNumberRecord(candidate.ys);
    const totalTokens = Object.values(models).reduce((sum, amount) => sum + amount, 0);
    const preferredModels = Object.entries(models).filter(([model]) => model !== "Others");
    const rankedModels = (preferredModels.length > 0 ? preferredModels : Object.entries(models)).sort(
      (left, right) => right[1] - left[1],
    );
    const [topModel = "Unknown", topModelTokens = 0] = rankedModels[0] ?? [];

    out.push({
      date,
      totalTokens,
      topModel,
      topModelTokens,
      models,
    });
  }

  return out.sort((left, right) => left.date.localeCompare(right.date));
};

const toTopModels = (value: unknown): EcosystemModelShare[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const parsed: Array<{ model: string; totalTokens: number }> = [];

  for (const row of value) {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      continue;
    }

    const candidate = row as { model_permaslug?: unknown; total_tokens?: unknown };
    if (typeof candidate.model_permaslug !== "string") {
      continue;
    }
    if (typeof candidate.total_tokens !== "number" || !Number.isFinite(candidate.total_tokens)) {
      continue;
    }

    parsed.push({
      model: candidate.model_permaslug,
      totalTokens: candidate.total_tokens,
    });
  }

  const sorted = parsed.sort((left, right) => right.totalTokens - left.totalTokens);
  const grandTotal = sorted.reduce((sum, model) => sum + model.totalTokens, 0);

  return sorted.slice(0, 20).map((entry) => ({
    model: entry.model,
    totalTokens: entry.totalTokens,
    share: grandTotal > 0 ? entry.totalTokens / grandTotal : 0,
  }));
};

export async function getOpenClawEcosystemSnapshot(): Promise<OpenClawEcosystemSnapshot | null> {
  try {
    const response = await fetch(OPENROUTER_OPENCLAW_APP_URL, {
      headers: {
        RSC: "1",
      },
      next: { revalidate: 900 },
    });

    if (!response.ok) {
      throw new Error(`OpenRouter response ${response.status}`);
    }

    const payload = await response.text();

    const appSegment = extractJsonSegment(payload, "\"app\":", "{");
    const dataSegment = extractJsonSegment(payload, "\"data\":", "[");
    const rankingsSegment = extractJsonSegment(payload, "\"appModelAnalytics\":", "[");

    if (!dataSegment || !rankingsSegment) {
      throw new Error("OpenRouter payload did not include app analytics");
    }

    const app = appSegment ? parseJson<RawOpenRouterApp>(appSegment) : null;
    const daily = toDailyPoints(parseJson<unknown>(dataSegment));
    const topModels = toTopModels(parseJson<unknown>(rankingsSegment));

    const latest = daily[daily.length - 1];
    const sevenDayTokens = daily.slice(-7).reduce((sum, point) => sum + point.totalTokens, 0);
    const thirtyDayTokens = daily.slice(-30).reduce((sum, point) => sum + point.totalTokens, 0);
    const activeModelsToday = latest
      ? Object.entries(latest.models).filter(([model, amount]) => model !== "Others" && amount > 0).length
      : 0;

    return {
      appTitle: app?.title ?? "OpenClaw",
      description: app?.description ?? "OpenClaw ecosystem analytics from OpenRouter app telemetry.",
      sourceUrl: app?.origin_url ?? OPENCLAW_ORIGIN_URL,
      fetchedAt: new Date().toISOString(),
      latestDate: latest?.date ?? null,
      daily,
      topModels,
      last24hTokens: latest?.totalTokens ?? 0,
      sevenDayTokens,
      thirtyDayTokens,
      trackedDays: daily.length,
      activeModelsToday,
      dominantModel: latest?.topModel ?? null,
      dominantModelTokens: latest?.topModelTokens ?? 0,
    };
  } catch (error) {
    console.error("[openrouter-ecosystem] Unable to fetch ecosystem stats", error);
    return null;
  }
}

export const OPENROUTER_OPENCLAW_APP_PAGE = OPENROUTER_OPENCLAW_APP_URL;
