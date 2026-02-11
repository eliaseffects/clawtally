import { GatewayRawStats } from "@/lib/gateway/types";
import { LeaderboardPeriod, StatsApiResponse, UsageStats, UserRecord } from "@/lib/types";

const PERIOD_FACTORS: Record<LeaderboardPeriod, number> = {
  "24h": 0.04,
  "7d": 0.18,
  "30d": 0.45,
  all: 1,
};

const scaleValue = (value: number, factor: number): number => Math.max(0, Math.round(value * factor));

export const calculateStreak = (activity: GatewayRawStats["activity"]): number => {
  let streak = 0;

  for (let index = activity.length - 1; index >= 0; index -= 1) {
    if (activity[index]?.messages && activity[index].messages > 0) {
      streak += 1;
      continue;
    }
    break;
  }

  return streak;
};

export const buildUsageStats = (raw: GatewayRawStats): UsageStats => {
  const periods = raw.periods ?? {
    "24h": {
      tokens: scaleValue(raw.totalTokens, PERIOD_FACTORS["24h"]),
      cost: Number((raw.totalCost * PERIOD_FACTORS["24h"]).toFixed(2)),
      messages: scaleValue(raw.messageCount, PERIOD_FACTORS["24h"]),
      sessions: scaleValue(raw.sessionCount, PERIOD_FACTORS["24h"]),
    },
    "7d": {
      tokens: scaleValue(raw.totalTokens, PERIOD_FACTORS["7d"]),
      cost: Number((raw.totalCost * PERIOD_FACTORS["7d"]).toFixed(2)),
      messages: scaleValue(raw.messageCount, PERIOD_FACTORS["7d"]),
      sessions: scaleValue(raw.sessionCount, PERIOD_FACTORS["7d"]),
    },
    "30d": {
      tokens: scaleValue(raw.totalTokens, PERIOD_FACTORS["30d"]),
      cost: Number((raw.totalCost * PERIOD_FACTORS["30d"]).toFixed(2)),
      messages: scaleValue(raw.messageCount, PERIOD_FACTORS["30d"]),
      sessions: scaleValue(raw.sessionCount, PERIOD_FACTORS["30d"]),
    },
    all: {
      tokens: raw.totalTokens,
      cost: Number(raw.totalCost.toFixed(2)),
      messages: raw.messageCount,
      sessions: raw.sessionCount,
    },
  };

  return {
    updatedAt: new Date().toISOString(),
    periods,
    topModels: raw.topModels.slice(0, 5),
    topTools: raw.topTools.slice(0, 5),
    activity: raw.activity,
    streak: calculateStreak(raw.activity),
  };
};

export const toStatsApiResponse = (user: UserRecord): StatsApiResponse | null => {
  if (!user.stats) {
    return null;
  }

  const { stats } = user;
  return {
    totalTokens: stats.periods.all.tokens,
    totalCost: stats.periods.all.cost,
    messageCount: stats.periods.all.messages,
    sessionCount: stats.periods.all.sessions,
    topModels: stats.topModels,
    topTools: stats.topTools,
    activity: stats.activity,
    shareEnabled: user.shareEnabled,
    claimed: user.claimed,
    periods: stats.periods,
    streak: stats.streak,
    updatedAt: stats.updatedAt,
  };
};
