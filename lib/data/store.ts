import { LeaderboardCategory, LeaderboardEntry, LeaderboardPeriod, UserRecord, UsageStats } from "@/lib/types";

interface ClawboardStore {
  users: Map<string, UserRecord>;
}

declare global {
  // eslint-disable-next-line no-var
  var __clawboardStore: ClawboardStore | undefined;
}

const getStore = (): ClawboardStore => {
  if (!globalThis.__clawboardStore) {
    globalThis.__clawboardStore = {
      users: new Map<string, UserRecord>(),
    };
  }

  return globalThis.__clawboardStore;
};

export const createUser = (user: UserRecord): UserRecord => {
  getStore().users.set(user.id, user);
  return user;
};

export const getUserById = (userId: string): UserRecord | undefined => getStore().users.get(userId);

export const updateUser = (userId: string, partial: Partial<UserRecord>): UserRecord | null => {
  const store = getStore();
  const current = store.users.get(userId);
  if (!current) {
    return null;
  }

  const updated: UserRecord = {
    ...current,
    ...partial,
  };
  store.users.set(userId, updated);
  return updated;
};

export const saveUserStats = (userId: string, stats: UsageStats): UserRecord | null => {
  return updateUser(userId, { stats });
};

const metricValue = (
  user: UserRecord,
  category: LeaderboardCategory,
  period: LeaderboardPeriod,
): number => {
  if (!user.stats) {
    return 0;
  }

  if (category === "streak") {
    return user.stats.streak;
  }

  const scoped = user.stats.periods[period];
  switch (category) {
    case "tokens":
      return scoped.tokens;
    case "cost":
      return scoped.cost;
    case "messages":
      return scoped.messages;
    case "sessions":
      return scoped.sessions;
    default:
      return 0;
  }
};

export const getLeaderboard = (
  category: LeaderboardCategory,
  period: LeaderboardPeriod,
): LeaderboardEntry[] => {
  const users = Array.from(getStore().users.values()).filter((user) => user.shareEnabled && user.stats);

  return users
    .map((user) => ({
      anonymousId: user.anonymousId,
      value: metricValue(user, category, period),
      claimed: user.claimed,
      identity: user.identity,
    }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 100)
    .map((entry, index) => ({
      rank: index + 1,
      ...entry,
    }));
};

export const listUsers = (): UserRecord[] => Array.from(getStore().users.values());
