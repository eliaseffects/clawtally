import { ActivityPoint, LeaderboardPeriod, PeriodStat, TopModel, TopTool } from "@/lib/types";

export interface GatewayConnectionInput {
  gatewayUrl: string;
  apiKey?: string;
}

export interface GatewayAgent {
  id: string;
  name: string;
  status: "active" | "inactive";
}

export interface GatewayFrame<T = unknown> {
  type: "req" | "res" | "event";
  id?: string;
  method?: string;
  params?: Record<string, unknown>;
  ok?: boolean;
  payload?: T;
  result?: T;
  error?: {
    code: number | string;
    message: string;
  };
  event?: string;
  data?: T;
}

export interface GatewayUsageTotals {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  totalTokens?: number;
  totalCost?: number;
  inputCost?: number;
  outputCost?: number;
  cacheReadCost?: number;
  cacheWriteCost?: number;
  missingCostEntries?: number;
}

export interface GatewayUsageByModelEntry {
  provider?: string;
  model?: string;
  totals?: GatewayUsageTotals;
}

export interface GatewayUsageByProviderEntry {
  provider?: string;
  count?: number;
  totals?: GatewayUsageTotals;
}

export interface GatewayUsageByAgentEntry {
  agentId?: string;
  totals?: GatewayUsageTotals;
}

export interface GatewayUsageByChannelEntry {
  channel?: string;
  totals?: GatewayUsageTotals;
}

export interface GatewayUsageToolEntry {
  name?: string;
  count?: number;
}

export interface GatewayUsageTools {
  totalCalls?: number;
  uniqueTools?: number;
  tools?: ReadonlyArray<GatewayUsageToolEntry>;
}

export interface GatewayUsageMessageCounts {
  total?: number;
  user?: number;
  assistant?: number;
  toolCalls?: number;
  toolResults?: number;
  errors?: number;
}

export interface GatewayUsageDaily {
  date: string;
  tokens?: number;
  cost?: number;
  messages?: number;
}

export interface GatewayUsageLatency {
  count?: number;
  avgMs?: number;
  minMs?: number;
  maxMs?: number;
  p95Ms?: number;
}

export interface GatewayUsageDailyBreakdown {
  date: string;
  tokens: number;
  cost: number;
}

export interface GatewayUsageDailyMessageCounts {
  date: string;
  total: number;
  user?: number;
  assistant?: number;
  toolCalls?: number;
  toolResults?: number;
  errors?: number;
}

export interface GatewayUsageDailyLatency {
  date: string;
  count: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  p95Ms: number;
}

export interface GatewayUsageDailyModelUsage {
  date: string;
  provider?: string;
  model?: string;
  tokens: number;
  cost: number;
  count: number;
}

export interface GatewayUsageModelUsageEntry {
  provider?: string;
  model?: string;
  count?: number;
  totals?: GatewayUsageTotals;
}

export interface GatewaySessionUsage {
  lastActivity?: number;
  firstActivity?: number;
  durationMs?: number;
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  totalTokens?: number;
  totalCost?: number;
  inputCost?: number;
  outputCost?: number;
  cacheReadCost?: number;
  cacheWriteCost?: number;
  missingCostEntries?: number;
  contextTokens?: number;
  contextWeight?: number;
  messageCounts?: GatewayUsageMessageCounts;
  toolUsage?: GatewayUsageTools;
  modelUsage?: ReadonlyArray<GatewayUsageModelUsageEntry>;
  latency?: GatewayUsageLatency;
  dailyBreakdown?: ReadonlyArray<GatewayUsageDailyBreakdown>;
  dailyMessageCounts?: ReadonlyArray<GatewayUsageDailyMessageCounts>;
  dailyLatency?: ReadonlyArray<GatewayUsageDailyLatency>;
  dailyModelUsage?: ReadonlyArray<GatewayUsageDailyModelUsage>;
  activityDates?: ReadonlyArray<string>;
}

export interface GatewayUsageSession {
  key: string;
  label?: string;
  agentId?: string;
  channel?: string;
  updatedAt: number;
  model?: string;
  modelProvider?: string;
  provider?: string;
  providerOverride?: string;
  modelOverride?: string;
  totalTokens?: number;
  totalCost?: number;
  messages?: number;
  usage?: GatewaySessionUsage;
}

export interface GatewayUsageResponse {
  updatedAt?: number;
  startDate?: string;
  endDate?: string;
  sessions: ReadonlyArray<GatewayUsageSession>;
  totals: GatewayUsageTotals;
  aggregates?: {
    messages?: GatewayUsageMessageCounts;
    byModel?: ReadonlyArray<GatewayUsageByModelEntry>;
    byProvider?: ReadonlyArray<GatewayUsageByProviderEntry>;
    byAgent?: ReadonlyArray<GatewayUsageByAgentEntry>;
    byChannel?: ReadonlyArray<GatewayUsageByChannelEntry>;
    daily?: ReadonlyArray<GatewayUsageDaily>;
    dailyLatency?: ReadonlyArray<GatewayUsageDailyLatency>;
    tools?: GatewayUsageTools;
    latency?: GatewayUsageLatency;
  };
}

export interface GatewayUsageCostDaily {
  date: string;
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  totalTokens?: number;
  inputCost?: number;
  outputCost?: number;
  cacheReadCost?: number;
  cacheWriteCost?: number;
  totalCost?: number;
}

export interface GatewayUsageCostResponse {
  totals?: GatewayUsageTotals;
  daily?: ReadonlyArray<GatewayUsageCostDaily>;
}

export interface GatewayRawStats {
  totalTokens: number;
  totalCost: number;
  messageCount: number;
  sessionCount: number;
  topModels: TopModel[];
  topTools: TopTool[];
  activity: ActivityPoint[];
  periods?: Record<LeaderboardPeriod, PeriodStat>;
}
