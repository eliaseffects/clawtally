import { getOrCreateDeviceIdentity, signConnectChallenge } from "@/lib/gateway/device-identity";
import {
  GatewayAgent,
  GatewayConnectionInput,
  GatewayFrame,
  GatewayRawStats,
  GatewayUsageCostResponse,
  GatewayUsageDaily,
  GatewayUsageResponse,
  GatewayUsageSession,
  GatewayUsageTotals,
} from "@/lib/gateway/types";
import { PeriodStat, TopModel, TopTool } from "@/lib/types";

const DEFAULT_TIMEOUT_MS = 10_000;
const ALLOW_MOCK = process.env.CLAWBOARD_ALLOW_MOCK_STATS === "true";

const CLIENT_ID = "gateway-client";
const CLIENT_MODE = "backend";
const ROLE = "operator";
const SCOPES: ReadonlyArray<string> = ["operator.read", "operator.write", "operator.admin"];

const normalizeGatewayUrl = (gatewayUrl: string): string => {
  const trimmed = gatewayUrl.trim().replace(/\/+$/, "");

  if (/^wss?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    const url = new URL(trimmed);
    const protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${url.host}${url.pathname}`.replace(/\/+$/, "");
  }

  return `ws://${trimmed}`;
};

const createRequestId = (prefix: string): string =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const toNumber = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : 0);

const isoDateFromTimestamp = (timestampMs: number): string => new Date(timestampMs).toISOString().slice(0, 10);

const rawFrameToText = async (raw: unknown): Promise<string> => {
  if (typeof raw === "string") {
    return raw;
  }

  if (typeof Blob !== "undefined" && raw instanceof Blob) {
    const buffer = await raw.arrayBuffer();
    return Buffer.from(buffer).toString();
  }

  if (Buffer.isBuffer(raw)) {
    return raw.toString();
  }

  if (Array.isArray(raw) && raw.every((item) => Buffer.isBuffer(item))) {
    return Buffer.concat(raw).toString();
  }

  if (raw instanceof ArrayBuffer) {
    return Buffer.from(raw).toString();
  }

  if (ArrayBuffer.isView(raw)) {
    return Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength).toString();
  }

  return String(raw);
};

const totalsTokens = (totals?: GatewayUsageTotals): number => {
  if (!totals) {
    return 0;
  }

  const bucketTotal =
    toNumber(totals.input) + toNumber(totals.output) + toNumber(totals.cacheRead) + toNumber(totals.cacheWrite);
  return bucketTotal > 0 ? bucketTotal : toNumber(totals.totalTokens);
};

const totalsCost = (totals?: GatewayUsageTotals): number => {
  if (!totals) {
    return 0;
  }

  const bucketTotal =
    toNumber(totals.inputCost) +
    toNumber(totals.outputCost) +
    toNumber(totals.cacheReadCost) +
    toNumber(totals.cacheWriteCost);
  return bucketTotal > 0 ? bucketTotal : toNumber(totals.totalCost);
};

const sessionTokens = (session: GatewayUsageSession): number =>
  toNumber(session.usage?.totalTokens ?? session.totalTokens);

const sessionCost = (session: GatewayUsageSession): number =>
  toNumber(session.usage?.totalCost ?? session.totalCost);

const sessionMessages = (session: GatewayUsageSession): number =>
  toNumber(session.usage?.messageCounts?.total ?? session.messages);

const sessionToolCalls = (session: GatewayUsageSession): number =>
  toNumber(session.usage?.messageCounts?.toolCalls ?? session.usage?.toolUsage?.totalCalls);

const sessionActivityTimestamp = (session: GatewayUsageSession): number =>
  toNumber(session.usage?.lastActivity ?? session.updatedAt);

const roundMoney = (value: number): number => Number(value.toFixed(2));
const todayIso = (): string => new Date().toISOString().slice(0, 10);
const shiftIsoDate = (isoDate: string, days: number): string => {
  const base = new Date(`${isoDate}T00:00:00`);
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
};

interface DailyUsageRollup {
  date: string;
  tokens: number;
  cost: number;
  messages: number;
}

const fallbackDailyFromSessions = (sessions: ReadonlyArray<GatewayUsageSession>): DailyUsageRollup[] => {
  const byDate = new Map<string, DailyUsageRollup>();

  for (const session of sessions) {
    const timestamp = sessionActivityTimestamp(session);
    if (!timestamp) {
      continue;
    }

    const date = isoDateFromTimestamp(timestamp);
    const current = byDate.get(date) ?? { date, tokens: 0, cost: 0, messages: 0 };
    byDate.set(date, {
      date,
      tokens: current.tokens + sessionTokens(session),
      cost: current.cost + sessionCost(session),
      messages: current.messages + sessionMessages(session),
    });
  }

  return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));
};

const normalizeDailyUsage = (
  daily: ReadonlyArray<GatewayUsageDaily> | undefined,
  sessions: ReadonlyArray<GatewayUsageSession>,
): DailyUsageRollup[] => {
  if (daily && daily.length > 0) {
    const mapped = daily
      .map((entry) => ({
        date: entry.date,
        tokens: toNumber(entry.tokens),
        cost: toNumber(entry.cost),
        messages: toNumber(entry.messages),
      }))
      .sort((left, right) => left.date.localeCompare(right.date));

    if (mapped.length > 0) {
      return mapped;
    }
  }

  return fallbackDailyFromSessions(sessions);
};

const buildTopModels = (usage: GatewayUsageResponse): TopModel[] => {
  const fromAggregates = usage.aggregates?.byModel
    ?.map((entry) => {
      const modelName = [entry.provider, entry.model].filter(Boolean).join("/") || "unknown";
      return {
        model: modelName,
        tokens: Math.round(totalsTokens(entry.totals)),
      };
    })
    .filter((entry) => entry.tokens > 0)
    .sort((left, right) => right.tokens - left.tokens)
    .slice(0, 5);

  if (fromAggregates && fromAggregates.length > 0) {
    return fromAggregates;
  }

  const byModel = new Map<string, number>();
  for (const session of usage.sessions) {
    const model = session.model || "unknown";
    byModel.set(model, (byModel.get(model) ?? 0) + sessionTokens(session));
  }

  return [...byModel.entries()]
    .map(([model, tokens]) => ({ model, tokens: Math.round(tokens) }))
    .sort((left, right) => right.tokens - left.tokens)
    .slice(0, 5);
};

const buildTopTools = (usage: GatewayUsageResponse): TopTool[] => {
  const fromAggregates = usage.aggregates?.tools?.tools
    ?.map((tool) => ({
      tool: tool.name || "unknown",
      count: Math.round(toNumber(tool.count)),
    }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 5);

  if (fromAggregates && fromAggregates.length > 0) {
    return fromAggregates;
  }

  const byTool = new Map<string, number>();
  for (const session of usage.sessions) {
    const tools = session.usage?.toolUsage?.tools ?? [];
    for (const tool of tools) {
      const name = tool.name || "unknown";
      byTool.set(name, (byTool.get(name) ?? 0) + toNumber(tool.count));
    }
  }

  if (byTool.size > 0) {
    return [...byTool.entries()]
      .map(([tool, count]) => ({ tool, count: Math.round(count) }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 5);
  }

  return [
    {
      tool: "tool_calls",
      count: usage.sessions.reduce((sum, session) => sum + sessionToolCalls(session), 0),
    },
  ];
};

const buildActivity = (daily: ReadonlyArray<DailyUsageRollup>) => {
  if (daily.length > 0) {
    return daily.slice(-35).map((entry) => ({
      date: entry.date,
      messages: Math.round(entry.messages),
    }));
  }

  const today = new Date();
  return Array.from({ length: 35 }).map((_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (34 - index));
    return {
      date: date.toISOString().slice(0, 10),
      messages: 0,
    };
  });
};

const usageMessageCount = (usage: GatewayUsageResponse, daily: ReadonlyArray<DailyUsageRollup>): number =>
  toNumber(usage.aggregates?.messages?.total) ||
  daily.reduce((sum, entry) => sum + entry.messages, 0) ||
  usage.sessions.reduce((sum, session) => sum + sessionMessages(session), 0);

const toPeriodStat = (usage: GatewayUsageResponse): PeriodStat => {
  const daily = normalizeDailyUsage(usage.aggregates?.daily, usage.sessions);
  return {
    tokens: Math.round(totalsTokens(usage.totals)),
    cost: roundMoney(totalsCost(usage.totals)),
    messages: Math.round(usageMessageCount(usage, daily)),
    sessions: usage.sessions.length,
  };
};

const fetchUsageSnapshot = async (
  input: GatewayConnectionInput,
  params?: Record<string, unknown>,
): Promise<GatewayUsageResponse> => {
  const usage = await gatewayRequest<GatewayUsageResponse>(input, "sessions.usage", params);
  if (!usage || !Array.isArray(usage.sessions) || !usage.totals) {
    throw new Error("sessions.usage response is missing expected fields.");
  }
  return usage;
};

const fetchUsageCostSummary = async (
  input: GatewayConnectionInput,
  params?: Record<string, unknown>,
): Promise<GatewayUsageCostResponse> => {
  const costSummary = await gatewayRequest<GatewayUsageCostResponse>(input, "usage.cost", params);
  if (!costSummary || typeof costSummary !== "object") {
    throw new Error("usage.cost response is missing expected fields.");
  }
  return costSummary;
};

export const fetchGatewayUsageWindow = async (
  input: GatewayConnectionInput,
  params: { startDate: string; endDate: string; limit?: number },
): Promise<{ usage: GatewayUsageResponse; cost: GatewayUsageCostResponse }> => {
  const limit = params.limit ?? 1000;

  const [usage, cost] = await Promise.all([
    fetchUsageSnapshot(input, {
      startDate: params.startDate,
      endDate: params.endDate,
      limit,
      includeContextWeight: true,
    }),
    fetchUsageCostSummary(input, {
      startDate: params.startDate,
      endDate: params.endDate,
    }),
  ]);

  return { usage, cost };
};

const buildConnectParams = async (input: GatewayConnectionInput) => {
  const identity = await getOrCreateDeviceIdentity();
  const token = input.apiKey ?? "";

  const device = await signConnectChallenge({
    identity,
    clientId: CLIENT_ID,
    clientMode: CLIENT_MODE,
    role: ROLE,
    scopes: SCOPES,
    token,
  });

  return {
    minProtocol: 3,
    maxProtocol: 3,
    client: {
      id: CLIENT_ID,
      displayName: "ClawBoard",
      version: "0.1.0",
      platform: "node",
      mode: CLIENT_MODE,
      instanceId: `clawboard-${process.pid}`,
    },
    role: ROLE,
    scopes: SCOPES,
    device,
    ...(token ? { auth: { token } } : {}),
  };
};

const gatewayRequest = async <T>(
  input: GatewayConnectionInput,
  method: string,
  params?: Record<string, unknown>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<T> => {
  const connectParams = await buildConnectParams(input);
  const wsUrl = normalizeGatewayUrl(input.gatewayUrl);

  return new Promise<T>((resolve, reject) => {
    const connectId = createRequestId("connect");
    const requestId = createRequestId("req");
    let settled = false;
    let handshakeComplete = false;

    const ws = new WebSocket(wsUrl);
    let timer: ReturnType<typeof setTimeout> | undefined;

    const settle = (callback: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timer) {
        clearTimeout(timer);
      }
      callback();
    };

    timer = setTimeout(() => {
      settle(() => {
        try {
          ws.close();
        } catch {
          // ignore close failures on timeout
        }
        reject(new Error(`Gateway request timed out after ${timeoutMs}ms`));
      });
    }, timeoutMs);

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: "req",
          id: connectId,
          method: "connect",
          params: connectParams as Record<string, unknown>,
        }),
      );
    };

    ws.onmessage = async (messageEvent) => {
      if (settled) {
        return;
      }

      let frame: GatewayFrame<T>;
      try {
        frame = JSON.parse(await rawFrameToText(messageEvent.data)) as GatewayFrame<T>;
      } catch {
        return;
      }

      if (frame.type !== "res") {
        return;
      }

      if (!handshakeComplete && frame.id === connectId) {
        if (frame.error) {
          const handshakeError = frame.error;
          settle(() => reject(new Error(`Gateway handshake failed: ${handshakeError.message}`)));
          return;
        }

        handshakeComplete = true;
        ws.send(
          JSON.stringify({
            type: "req",
            id: requestId,
            method,
            ...(params ? { params } : {}),
          }),
        );
        return;
      }

      if (handshakeComplete && frame.id === requestId) {
        settle(() => {
          try {
            ws.close();
          } catch {
            // ignore close failures after response
          }

          if (frame.error) {
            const requestError = frame.error;
            reject(new Error(`Gateway error [${requestError.code}]: ${requestError.message}`));
            return;
          }

          resolve((frame.payload ?? frame.result) as T);
        });
      }
    };

    ws.onerror = (errorEvent) => {
      settle(() => {
        const maybeError = "error" in errorEvent && errorEvent.error instanceof Error ? errorEvent.error : null;
        const message = maybeError?.message ?? "Gateway connection error";
        reject(new Error(message));
      });
    };

    ws.onclose = () => {
      if (settled) {
        return;
      }

      settle(() => {
        reject(new Error("Gateway connection closed unexpectedly"));
      });
    };
  });
};

const deterministicNumber = (input: string, min: number, max: number): number => {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) % 2147483647;
  }
  const span = max - min;
  return min + (hash % (span + 1));
};

const generateFallbackStats = (seed: string): GatewayRawStats => {
  const totalTokens = deterministicNumber(`${seed}:tokens`, 50_000, 2_000_000);
  const messageCount = deterministicNumber(`${seed}:messages`, 300, 9_000);
  const sessionCount = deterministicNumber(`${seed}:sessions`, 20, 900);
  const totalCost = Number((totalTokens / 1_000_000 * 2.4).toFixed(2));

  const topModels = [
    { model: "claude-sonnet", tokens: Math.floor(totalTokens * 0.42) },
    { model: "gpt-4o", tokens: Math.floor(totalTokens * 0.31) },
    { model: "o3-mini", tokens: Math.floor(totalTokens * 0.17) },
    { model: "llama-3.3", tokens: Math.floor(totalTokens * 0.1) },
  ];

  const topTools = [
    { tool: "exec", count: Math.floor(messageCount * 0.35) },
    { tool: "web.search", count: Math.floor(messageCount * 0.2) },
    { tool: "read_file", count: Math.floor(messageCount * 0.18) },
    { tool: "write_file", count: Math.floor(messageCount * 0.13) },
    { tool: "git", count: Math.floor(messageCount * 0.1) },
  ];

  const today = new Date();
  const activity = Array.from({ length: 35 }).map((_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (34 - index));
    const daySeed = deterministicNumber(`${seed}:${date.toISOString().slice(0, 10)}`, 0, 50);
    return {
      date: date.toISOString().slice(0, 10),
      messages: daySeed,
    };
  });

  return {
    totalTokens,
    totalCost,
    messageCount,
    sessionCount,
    topModels,
    topTools,
    activity,
  };
};

const unwrapAgents = (payload: unknown): GatewayAgent[] => {
  const rawAgents =
    payload && typeof payload === "object" && "agents" in payload && Array.isArray(payload.agents)
      ? payload.agents
      : Array.isArray(payload)
        ? payload
        : [];

  return rawAgents
    .filter((agent): agent is { id?: unknown; name?: unknown } => Boolean(agent) && typeof agent === "object")
    .map((agent) => {
      const id = typeof agent.id === "string" ? agent.id : "agent:unknown";
      const name = typeof agent.name === "string" && agent.name.length > 0 ? agent.name : id;
      return {
        id,
        name,
        status: "active" as const,
      };
    });
};

export const validateGatewayConnection = async (input: GatewayConnectionInput): Promise<GatewayAgent[]> => {
  try {
    const result = await gatewayRequest<unknown>(input, "agents.list");
    const agents = unwrapAgents(result);
    if (agents.length > 0) {
      return agents;
    }
    throw new Error("Gateway returned an empty agents list.");
  } catch (error) {
    if (ALLOW_MOCK) {
      return [{ id: "agent:main", name: "Main Agent", status: "active" }];
    }

    const message = error instanceof Error ? error.message : "Unknown gateway error";
    throw new Error(`Unable to connect to gateway: ${message}`);
  }
};

export const fetchGatewayStats = async (input: GatewayConnectionInput): Promise<GatewayRawStats> => {
  try {
    const endDate = todayIso();
    const startDate24h = endDate;
    const startDate7d = shiftIsoDate(endDate, -6);
    const startDate30d = shiftIsoDate(endDate, -29);
    const startDateAll = process.env.CLAWBOARD_ALL_TIME_START_DATE || "1970-01-01";

    const [usageAll, usage24h, usage7d, usage30d] = await Promise.all([
      fetchUsageSnapshot(input, { startDate: startDateAll, endDate, limit: 100_000 }),
      fetchUsageSnapshot(input, { startDate: startDate24h, endDate, limit: 20_000 }),
      fetchUsageSnapshot(input, { startDate: startDate7d, endDate, limit: 20_000 }),
      fetchUsageSnapshot(input, { startDate: startDate30d, endDate, limit: 20_000 }),
    ]);

    const periods = {
      "24h": toPeriodStat(usage24h),
      "7d": toPeriodStat(usage7d),
      "30d": toPeriodStat(usage30d),
      all: toPeriodStat(usageAll),
    };

    const daily = normalizeDailyUsage(usage30d.aggregates?.daily, usage30d.sessions);

    return {
      totalTokens: periods.all.tokens,
      totalCost: periods.all.cost,
      messageCount: periods.all.messages,
      sessionCount: periods.all.sessions,
      topModels: buildTopModels(usageAll),
      topTools: buildTopTools(usageAll),
      activity: buildActivity(daily),
      periods,
    };
  } catch (error) {
    if (ALLOW_MOCK) {
      return generateFallbackStats(`${input.gatewayUrl}:${input.apiKey ?? ""}`);
    }

    const message = error instanceof Error ? error.message : "Unknown gateway error";
    throw new Error(`Unable to fetch usage from gateway: ${message}`);
  }
};
