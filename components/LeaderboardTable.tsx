import { LeaderboardCategory, LeaderboardEntry } from "@/lib/types";

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  category: LeaderboardCategory;
}

const formatValue = (category: LeaderboardCategory, value: number): string => {
  if (category === "cost") {
    return Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
  }

  return Intl.NumberFormat("en-US").format(value);
};

const rankBadgeClass = (rank: number): string => {
  if (rank === 1) {
    return "bg-[color:var(--coral-soft)] text-[color:var(--coral-bright)] border-[color:var(--coral-bright)]";
  }

  if (rank === 2) {
    return "bg-[color:var(--cyan-soft)] text-[color:var(--cyan-bright)] border-[color:var(--cyan-bright)]";
  }

  if (rank === 3) {
    return "bg-[#263357] text-[#a7b6ff] border-[#5a6bb1]";
  }

  return "bg-[color:var(--bg-surface)] text-[color:var(--text-secondary)] border-[color:var(--border-subtle)]";
};

export function LeaderboardTable({ entries, category }: LeaderboardTableProps) {
  if (entries.length === 0) {
    return (
      <article className="oc-panel p-6 text-sm text-[color:var(--text-secondary)]">
        No shared profiles yet. Enable sharing from your dashboard to appear here.
      </article>
    );
  }

  return (
    <div className="space-y-3">
      <article className="oc-panel divide-y divide-[color:var(--border-subtle)] overflow-hidden md:hidden">
        {entries.map((entry) => (
          <div key={`${entry.anonymousId}-${entry.rank}`} className="px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className={`rounded-full border px-2 py-1 text-xs font-semibold ${rankBadgeClass(entry.rank)}`}>
                #{entry.rank}
              </div>
              <p className="font-[family-name:var(--font-mono)] text-sm text-[color:var(--text-secondary)]">
                {formatValue(category, entry.value)}
              </p>
            </div>
            <p className="mt-3 text-sm">
              {entry.claimed ? entry.identity ?? entry.anonymousId : entry.anonymousId}
            </p>
          </div>
        ))}
      </article>

      <article className="oc-panel overflow-hidden">
        <table className="hidden w-full border-collapse text-sm md:table">
          <thead>
            <tr className="border-b border-[color:var(--border-subtle)] text-left text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
              <th className="px-4 py-3">Rank</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Value</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={`${entry.anonymousId}-${entry.rank}`}
                className="border-b border-[color:var(--border-subtle)] transition hover:bg-white/[0.02] last:border-b-0"
              >
                <td className="px-4 py-3">
                  <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${rankBadgeClass(entry.rank)}`}>
                    #{entry.rank}
                  </span>
                </td>
                <td className="px-4 py-3">{entry.claimed ? entry.identity ?? entry.anonymousId : entry.anonymousId}</td>
                <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-[color:var(--text-secondary)]">
                  {formatValue(category, entry.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </div>
  );
}
