import { ActivityPoint } from "@/lib/types";

interface ActivityHeatmapProps {
  activity: ActivityPoint[];
}

const DAY_COUNT = 35;

const levelClass = (messages: number): string => {
  if (messages >= 40) {
    return "bg-[color:var(--cyan-bright)] shadow-[0_0_16px_rgba(25,226,197,0.45)]";
  }

  if (messages >= 20) {
    return "bg-[color:var(--cyan-mid)]";
  }

  if (messages >= 8) {
    return "bg-cyan-700/80";
  }

  if (messages > 0) {
    return "bg-cyan-900/70";
  }

  return "bg-[#13203a]";
};

const shiftIsoDate = (isoDate: string, days: number): string => {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

export function ActivityHeatmap({ activity }: ActivityHeatmapProps) {
  const recent = activity.slice(-DAY_COUNT);
  const padded =
    recent.length === DAY_COUNT
      ? recent
      : recent.length === 0
        ? Array.from({ length: DAY_COUNT }, (_, index) => {
            const date = new Date();
            date.setDate(date.getDate() - (DAY_COUNT - 1 - index));
            return { date: date.toISOString().slice(0, 10), messages: 0 };
          })
        : [
            ...Array.from({ length: DAY_COUNT - recent.length }, (_, index) => ({
              date: shiftIsoDate(recent[0].date, index - (DAY_COUNT - recent.length)),
              messages: 0,
            })),
            ...recent,
          ];

  return (
    <section className="oc-panel p-4 md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Activity</h3>
          <p className="text-sm text-[color:var(--text-secondary)]">Message intensity over the last 35 days.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-[color:var(--text-muted)]">
          <span>Low</span>
          <span className="inline-block size-3 rounded-sm bg-[#13203a]" />
          <span className="inline-block size-3 rounded-sm bg-cyan-900/70" />
          <span className="inline-block size-3 rounded-sm bg-cyan-700/80" />
          <span className="inline-block size-3 rounded-sm bg-[color:var(--cyan-mid)]" />
          <span className="inline-block size-3 rounded-sm bg-[color:var(--cyan-bright)]" />
          <span>High</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-2" aria-label="Activity heatmap">
        {padded.map((point, index) => (
          <div
            key={`${point.date}-${index}`}
            title={`${point.date}: ${point.messages} messages`}
            className={`aspect-square min-h-4 rounded-md border border-white/5 ${levelClass(point.messages)}`}
          />
        ))}
      </div>
    </section>
  );
}
