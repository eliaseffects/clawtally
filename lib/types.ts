export type LeaderboardCategory = "tokens" | "cost" | "messages" | "sessions" | "streak";
export type LeaderboardPeriod = "24h" | "7d" | "30d" | "all";

export interface TopModel {
  model: string;
  tokens: number;
}

export interface TopTool {
  tool: string;
  count: number;
}

export interface ActivityPoint {
  date: string;
  messages: number;
}

export interface PeriodStat {
  tokens: number;
  cost: number;
  messages: number;
  sessions: number;
}

export interface UsageStats {
  updatedAt: string;
  periods: Record<LeaderboardPeriod, PeriodStat>;
  topModels: TopModel[];
  topTools: TopTool[];
  activity: ActivityPoint[];
  streak: number;
}

export interface UserRecord {
  id: string;
  anonymousId: string;
  claimed: boolean;
  identity?: string;
  shareEnabled: boolean;
  gatewayUrl?: string;
  gatewayApiKey?: string;
  stats?: UsageStats;
  createdAt: string;
}

export interface StatsApiResponse {
  totalTokens: number;
  totalCost: number;
  messageCount: number;
  sessionCount: number;
  topModels: TopModel[];
  topTools: TopTool[];
  activity: ActivityPoint[];
  shareEnabled: boolean;
  claimed: boolean;
  periods: Record<LeaderboardPeriod, PeriodStat>;
  streak: number;
  updatedAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  anonymousId: string;
  value: number;
  claimed: boolean;
  identity?: string;
}

export interface UsageWindowTotals {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
  inputCost: number;
  outputCost: number;
  cacheReadCost: number;
  cacheWriteCost: number;
  totalCost: number;
  missingCostEntries: number;
}

export interface UsageWindowMessages {
  total: number;
  user: number;
  assistant: number;
  toolCalls: number;
  toolResults: number;
  errors: number;
}

export interface UsageWindowLatency {
  count: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  p95Ms: number;
}

export interface UsageWindowToolRow {
  name: string;
  count: number;
}

export interface UsageWindowTools {
  totalCalls: number;
  uniqueTools: number;
  tools: UsageWindowToolRow[];
}

export interface UsageWindowDailyPoint {
  date: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
  totalCost: number;
  messages: number;
  toolCalls: number;
  errors: number;
  p95Ms?: number;
}

export interface UsageWindowModelRow {
  provider: string | null;
  model: string | null;
  count: number;
  totalTokens: number;
  totalCost: number;
}

export interface UsageWindowProviderRow {
  provider: string | null;
  count: number;
  totalTokens: number;
  totalCost: number;
}

export interface UsageWindowChannelRow {
  channel: string | null;
  totalTokens: number;
  totalCost: number;
}

export interface UsageWindowDerivedMetrics {
  cacheHitRate: number | null;
  errorRate: number | null;
  avgTokensPerMessage: number | null;
  avgCostPerMessage: number | null;
  throughputTokensPerMin: number | null;
  throughputCostPerMin: number | null;
  durationSumMs: number;
  durationCount: number;
  avgDurationMs: number | null;
  peakErrorDay: {
    date: string;
    errors: number;
    messages: number;
    tokens: number;
    rate: number;
  } | null;
}

export interface UsageWindowSummary {
  startDate: string;
  endDate: string;
  fetchedAt: string;
  sessionCount: number;
  totals: UsageWindowTotals;
  messages: UsageWindowMessages;
  tools: UsageWindowTools;
  latency: UsageWindowLatency | null;
  derived: UsageWindowDerivedMetrics;
  daily: UsageWindowDailyPoint[];
  byModel: UsageWindowModelRow[];
  byProvider: UsageWindowProviderRow[];
  byChannel: UsageWindowChannelRow[];
}
