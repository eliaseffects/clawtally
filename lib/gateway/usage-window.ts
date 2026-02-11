import type {
  GatewayUsageCostResponse,
  GatewayUsageResponse,
  GatewayUsageSession,
  GatewayUsageTotals,
} from "@/lib/gateway/types";
import type {
  UsageWindowChannelRow,
  UsageWindowDailyPoint,
  UsageWindowLatency,
  UsageWindowMessages,
  UsageWindowModelRow,
  UsageWindowProviderRow,
  UsageWindowSummary,
  UsageWindowToolRow,
  UsageWindowTools,
  UsageWindowTotals,
} from "@/lib/types";

const toNumber = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : 0);

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

const blankTotals = (): UsageWindowTotals => ({
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  totalTokens: 0,
  inputCost: 0,
  outputCost: 0,
  cacheReadCost: 0,
  cacheWriteCost: 0,
  totalCost: 0,
  missingCostEntries: 0,
});

const blankMessages = (): UsageWindowMessages => ({
  total: 0,
  user: 0,
  assistant: 0,
  toolCalls: 0,
  toolResults: 0,
  errors: 0,
});

const normalizeToolName = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const sessionTokens = (session: GatewayUsageSession): number =>
  toNumber(session.usage?.totalTokens ?? session.totalTokens);

const sessionCost = (session: GatewayUsageSession): number =>
  toNumber(session.usage?.totalCost ?? session.totalCost);

export const buildUsageWindowSummary = (
  usage: GatewayUsageResponse,
  cost: GatewayUsageCostResponse | null,
  {
    startDate,
    endDate,
  }: {
    startDate: string;
    endDate: string;
  },
): UsageWindowSummary => {
  const totals: UsageWindowTotals = blankTotals();

  // Prefer cost summary totals (it tends to include cost breakdown even when usage totals don't),
  // but always fold in token buckets from usage totals if present.
  const costTotals = cost?.totals;
  const usageTotals = usage.totals;

  totals.inputTokens = toNumber(usageTotals?.input);
  totals.outputTokens = toNumber(usageTotals?.output);
  totals.cacheReadTokens = toNumber(usageTotals?.cacheRead);
  totals.cacheWriteTokens = toNumber(usageTotals?.cacheWrite);
  totals.totalTokens = totalsTokens(usageTotals) || totalsTokens(costTotals);

  totals.inputCost = toNumber(costTotals?.inputCost ?? usageTotals?.inputCost);
  totals.outputCost = toNumber(costTotals?.outputCost ?? usageTotals?.outputCost);
  totals.cacheReadCost = toNumber(costTotals?.cacheReadCost ?? usageTotals?.cacheReadCost);
  totals.cacheWriteCost = toNumber(costTotals?.cacheWriteCost ?? usageTotals?.cacheWriteCost);
  totals.totalCost = totalsCost(costTotals) || totalsCost(usageTotals);
  totals.missingCostEntries = toNumber(costTotals?.missingCostEntries ?? usageTotals?.missingCostEntries);

  const messagesFromAggregates = usage.aggregates?.messages ?? null;
  const messages: UsageWindowMessages = blankMessages();
  if (messagesFromAggregates) {
    messages.total = toNumber(messagesFromAggregates.total);
    messages.user = toNumber(messagesFromAggregates.user);
    messages.assistant = toNumber(messagesFromAggregates.assistant);
    messages.toolCalls = toNumber(messagesFromAggregates.toolCalls);
    messages.toolResults = toNumber(messagesFromAggregates.toolResults);
    messages.errors = toNumber(messagesFromAggregates.errors);
  }

  const toolCountMap = new Map<string, number>();
  let toolTotalCalls = 0;

  const byModelMap = new Map<string, UsageWindowModelRow>();
  const byProviderMap = new Map<string, UsageWindowProviderRow>();
  const byChannelMap = new Map<string, UsageWindowChannelRow>();

  let durationSumMs = 0;
  let durationCount = 0;

  let latencyCount = 0;
  let latencySum = 0;
  let latencyMin = Number.POSITIVE_INFINITY;
  let latencyMax = 0;
  let latencyP95Max = 0;

  const costDaily = cost?.daily ?? [];
  const dailyMap = new Map<string, UsageWindowDailyPoint>();

  for (const entry of costDaily) {
    const date = typeof entry.date === "string" ? entry.date : "";
    if (!date) {
      continue;
    }

    const inputTokens = toNumber(entry.input);
    const outputTokens = toNumber(entry.output);
    const cacheReadTokens = toNumber(entry.cacheRead);
    const cacheWriteTokens = toNumber(entry.cacheWrite);
    const totalTokens = toNumber(entry.totalTokens) || inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens;
    const bucketCost =
      toNumber(entry.inputCost) + toNumber(entry.outputCost) + toNumber(entry.cacheReadCost) + toNumber(entry.cacheWriteCost);
    const totalCost = toNumber(entry.totalCost) || (bucketCost > 0 ? bucketCost : 0);

    dailyMap.set(date, {
      date,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
      totalTokens,
      totalCost,
      messages: 0,
      toolCalls: 0,
      errors: 0,
    });
  }

  const shouldComputeMessagesFromSessions = messages.total === 0 && messages.errors === 0 && usage.sessions.length > 0;

  for (const session of usage.sessions) {
    const sessionUsage = session.usage ?? null;

    if (shouldComputeMessagesFromSessions && sessionUsage?.messageCounts) {
      messages.total += toNumber(sessionUsage.messageCounts.total);
      messages.user += toNumber(sessionUsage.messageCounts.user);
      messages.assistant += toNumber(sessionUsage.messageCounts.assistant);
      messages.toolCalls += toNumber(sessionUsage.messageCounts.toolCalls);
      messages.toolResults += toNumber(sessionUsage.messageCounts.toolResults);
      messages.errors += toNumber(sessionUsage.messageCounts.errors);
    }

    if (sessionUsage?.toolUsage?.tools) {
      for (const tool of sessionUsage.toolUsage.tools) {
        const name = normalizeToolName(tool.name);
        if (!name) {
          continue;
        }
        const count = toNumber(tool.count);
        if (count <= 0) {
          continue;
        }
        toolCountMap.set(name, (toolCountMap.get(name) ?? 0) + count);
        toolTotalCalls += count;
      }
    }

    if (sessionUsage?.modelUsage) {
      for (const entry of sessionUsage.modelUsage) {
        const provider = typeof entry.provider === "string" ? entry.provider : "unknown";
        const model = typeof entry.model === "string" ? entry.model : "unknown";
        const key = `${provider}::${model}`;
        const count = toNumber(entry.count);
        const tokens = totalsTokens(entry.totals);
        const costValue = totalsCost(entry.totals);

        const existing = byModelMap.get(key) ?? {
          provider,
          model,
          count: 0,
          totalTokens: 0,
          totalCost: 0,
        };

        byModelMap.set(key, {
          ...existing,
          count: existing.count + count,
          totalTokens: existing.totalTokens + tokens,
          totalCost: existing.totalCost + costValue,
        });

        const providerExisting = byProviderMap.get(provider) ?? {
          provider,
          count: 0,
          totalTokens: 0,
          totalCost: 0,
        };

        byProviderMap.set(provider, {
          ...providerExisting,
          count: providerExisting.count + count,
          totalTokens: providerExisting.totalTokens + tokens,
          totalCost: providerExisting.totalCost + costValue,
        });
      }
    }

    const channel = typeof session.channel === "string" && session.channel.trim().length > 0 ? session.channel.trim() : null;
    if (channel) {
      const current = byChannelMap.get(channel) ?? { channel, totalTokens: 0, totalCost: 0 };
      byChannelMap.set(channel, {
        channel,
        totalTokens: current.totalTokens + sessionTokens(session),
        totalCost: current.totalCost + sessionCost(session),
      });
    }

    const durationMs = toNumber(sessionUsage?.durationMs);
    if (durationMs > 0) {
      durationSumMs += durationMs;
      durationCount += 1;
    }

    const latency = sessionUsage?.latency ?? null;
    if (latency) {
      const count = toNumber(latency.count);
      const avgMs = toNumber(latency.avgMs);
      const minMs = toNumber(latency.minMs);
      const maxMs = toNumber(latency.maxMs);
      const p95Ms = toNumber(latency.p95Ms);

      if (count > 0) {
        latencyCount += count;
        latencySum += avgMs * count;
        latencyMin = Math.min(latencyMin, minMs || latencyMin);
        latencyMax = Math.max(latencyMax, maxMs);
        latencyP95Max = Math.max(latencyP95Max, p95Ms);
      }
    }

    for (const dm of sessionUsage?.dailyMessageCounts ?? []) {
      const date = typeof dm.date === "string" ? dm.date : "";
      if (!date) {
        continue;
      }

      const current =
        dailyMap.get(date) ??
        ({
          date,
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          totalTokens: 0,
          totalCost: 0,
          messages: 0,
          toolCalls: 0,
          errors: 0,
        } satisfies UsageWindowDailyPoint);

      dailyMap.set(date, {
        ...current,
        messages: current.messages + toNumber(dm.total),
        toolCalls: current.toolCalls + toNumber(dm.toolCalls),
        errors: current.errors + toNumber(dm.errors),
      });
    }

    for (const dl of sessionUsage?.dailyLatency ?? []) {
      const date = typeof dl.date === "string" ? dl.date : "";
      if (!date) {
        continue;
      }

      const current =
        dailyMap.get(date) ??
        ({
          date,
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          totalTokens: 0,
          totalCost: 0,
          messages: 0,
          toolCalls: 0,
          errors: 0,
        } satisfies UsageWindowDailyPoint);

      dailyMap.set(date, {
        ...current,
        p95Ms: Math.max(toNumber(current.p95Ms), toNumber(dl.p95Ms)),
      });
    }

    if (costDaily.length === 0) {
      for (const db of sessionUsage?.dailyBreakdown ?? []) {
        const date = typeof db.date === "string" ? db.date : "";
        if (!date) {
          continue;
        }

        const current =
          dailyMap.get(date) ??
          ({
            date,
            inputTokens: 0,
            outputTokens: 0,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            totalTokens: 0,
            totalCost: 0,
            messages: 0,
            toolCalls: 0,
            errors: 0,
          } satisfies UsageWindowDailyPoint);

        dailyMap.set(date, {
          ...current,
          totalTokens: current.totalTokens + toNumber(db.tokens),
          totalCost: current.totalCost + toNumber(db.cost),
        });
      }
    }
  }

  if (byModelMap.size === 0 && usage.aggregates?.byModel) {
    for (const entry of usage.aggregates.byModel) {
      const provider = typeof entry.provider === "string" ? entry.provider : "unknown";
      const model = typeof entry.model === "string" ? entry.model : "unknown";
      const key = `${provider}::${model}`;
      const row: UsageWindowModelRow = {
        provider,
        model,
        count: 0,
        totalTokens: totalsTokens(entry.totals),
        totalCost: totalsCost(entry.totals),
      };
      byModelMap.set(key, row);
      const providerExisting = byProviderMap.get(provider) ?? {
        provider,
        count: 0,
        totalTokens: 0,
        totalCost: 0,
      };
      byProviderMap.set(provider, {
        ...providerExisting,
        totalTokens: providerExisting.totalTokens + row.totalTokens,
        totalCost: providerExisting.totalCost + row.totalCost,
      });
    }
  }

  const aggregatesTools = usage.aggregates?.tools ?? null;
  const tools: UsageWindowTools = {
    totalCalls: aggregatesTools ? toNumber(aggregatesTools.totalCalls) : toolTotalCalls,
    uniqueTools: aggregatesTools ? toNumber(aggregatesTools.uniqueTools) : toolCountMap.size,
    tools: [],
  };

  const toolRows: UsageWindowToolRow[] = aggregatesTools?.tools
    ? aggregatesTools.tools
        .map((tool) => ({
          name: normalizeToolName(tool.name) ?? "unknown",
          count: toNumber(tool.count),
        }))
        .filter((tool) => tool.count > 0)
    : [...toolCountMap.entries()].map(([name, count]) => ({ name, count }));

  tools.tools = toolRows.sort((left, right) => right.count - left.count).slice(0, 12);

  const aggregatesLatency = usage.aggregates?.latency ?? null;
  const latency: UsageWindowLatency | null = (() => {
    if (aggregatesLatency && toNumber(aggregatesLatency.count) > 0) {
      return {
        count: Math.round(toNumber(aggregatesLatency.count)),
        avgMs: toNumber(aggregatesLatency.avgMs),
        minMs: toNumber(aggregatesLatency.minMs),
        maxMs: toNumber(aggregatesLatency.maxMs),
        p95Ms: toNumber(aggregatesLatency.p95Ms),
      };
    }

    if (latencyCount <= 0) {
      return null;
    }

    return {
      count: latencyCount,
      avgMs: latencySum / latencyCount,
      minMs: latencyMin === Number.POSITIVE_INFINITY ? 0 : latencyMin,
      maxMs: latencyMax,
      p95Ms: latencyP95Max,
    };
  })();

  const daily = [...dailyMap.values()].sort((left, right) => left.date.localeCompare(right.date));

  const peakErrorDay = (() => {
    const ranked = daily
      .filter((entry) => entry.messages > 0 && entry.errors > 0)
      .map((entry) => ({
        date: entry.date,
        errors: entry.errors,
        messages: entry.messages,
        tokens: entry.totalTokens,
        rate: entry.errors / entry.messages,
      }))
      .sort((left, right) => right.rate - left.rate || right.errors - left.errors);

    return ranked[0] ?? null;
  })();

  const throughputTokensPerMin = durationSumMs > 0 ? totals.totalTokens / (durationSumMs / 60_000) : null;
  const throughputCostPerMin = durationSumMs > 0 ? totals.totalCost / (durationSumMs / 60_000) : null;
  const errorRate = messages.total > 0 ? messages.errors / messages.total : null;
  const cacheDenom = totals.inputTokens + totals.cacheReadTokens;
  const cacheHitRate = cacheDenom > 0 ? totals.cacheReadTokens / cacheDenom : null;
  const avgTokensPerMessage = messages.total > 0 ? totals.totalTokens / messages.total : null;
  const avgCostPerMessage = messages.total > 0 ? totals.totalCost / messages.total : null;
  const avgDurationMs = durationCount > 0 ? durationSumMs / durationCount : null;

  const byModel = [...byModelMap.values()]
    .sort((left, right) => right.totalTokens - left.totalTokens)
    .slice(0, 12)
    .map((row) => ({
      provider: row.provider ?? null,
      model: row.model ?? null,
      count: row.count,
      totalTokens: row.totalTokens,
      totalCost: row.totalCost,
    }));

  const byProvider = [...byProviderMap.values()]
    .sort((left, right) => right.totalTokens - left.totalTokens)
    .slice(0, 12)
    .map((row) => ({
      provider: row.provider ?? null,
      count: row.count,
      totalTokens: row.totalTokens,
      totalCost: row.totalCost,
    }));

  const byChannel = [...byChannelMap.values()]
    .sort((left, right) => right.totalTokens - left.totalTokens)
    .slice(0, 12)
    .map((row) => ({
      channel: row.channel ?? null,
      totalTokens: row.totalTokens,
      totalCost: row.totalCost,
    }));

  return {
    startDate,
    endDate,
    fetchedAt: new Date().toISOString(),
    sessionCount: usage.sessions.length,
    totals,
    messages,
    tools,
    latency,
    derived: {
      cacheHitRate,
      errorRate,
      avgTokensPerMessage,
      avgCostPerMessage,
      throughputTokensPerMin,
      throughputCostPerMin,
      durationSumMs,
      durationCount,
      avgDurationMs,
      peakErrorDay,
    },
    daily,
    byModel,
    byProvider,
    byChannel,
  };
};
