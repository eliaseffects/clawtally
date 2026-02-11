import { notFound } from "next/navigation";

import { SiteTopbar } from "@/components/SiteTopbar";
import { StatsDashboard } from "@/components/StatsDashboard";
import { toStatsApiResponse } from "@/lib/analytics";
import { getUserById } from "@/lib/data/store";

interface PublicProfilePageProps {
  params: Promise<{ token: string }>;
}

export default async function PublicProfilePage({ params }: PublicProfilePageProps) {
  const { token } = await params;
  const user = getUserById(token);

  if (!user || !user.shareEnabled || !user.stats) {
    notFound();
  }

  const safeUser = user;
  const stats = toStatsApiResponse(safeUser);
  if (!stats) {
    notFound();
  }

  const updatedAt = new Date(stats.updatedAt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <main className="oc-shell">
      <header className="space-y-6">
        <SiteTopbar />
        <div>
          <p className="oc-kicker">Public Snapshot</p>
          <h1 className="mt-1 text-2xl font-semibold md:text-3xl">
            {safeUser.claimed ? safeUser.identity ?? safeUser.anonymousId : safeUser.anonymousId}
          </h1>
          <p className="mt-2 text-sm text-[color:var(--text-secondary)]">Updated {updatedAt}</p>
        </div>
      </header>

      <div className="oc-trust mb-6 rounded-lg px-3 py-2 text-xs text-[color:var(--text-secondary)]">
        Public profiles are anonymized unless claimed and only show read-only usage metrics.
      </div>

      <StatsDashboard stats={stats} />
    </main>
  );
}
