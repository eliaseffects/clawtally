import pkg from "@/package.json";

export const dynamic = "force-dynamic";

export default function HealthPage() {
  const timestamp = new Date().toISOString();
  const uptimeSeconds = Math.round(process.uptime());

  return (
    <main className="oc-shell">
      <section className="oc-panel mx-auto mt-12 max-w-2xl p-6 md:p-8">
        <p className="oc-kicker text-[color:var(--cyan-bright)]">Health Check</p>
        <h1 className="mt-3 text-2xl font-semibold">Clawtally is online.</h1>
        <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
          This endpoint is safe to hit from monitors and uptime checks.
        </p>

        <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-[color:var(--text-secondary)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>Status</span>
            <span className="font-[family-name:var(--font-mono)] text-[color:var(--cyan-bright)]">OK</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span>Version</span>
            <span className="font-[family-name:var(--font-mono)]">{pkg.version}</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span>Uptime</span>
            <span className="font-[family-name:var(--font-mono)]">{uptimeSeconds}s</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span>Timestamp</span>
            <span className="font-[family-name:var(--font-mono)]">{timestamp}</span>
          </div>
        </div>

        <p className="mt-4 text-xs text-[color:var(--text-muted)]">
          JSON health: <code>/api/health</code>
        </p>
      </section>
    </main>
  );
}
