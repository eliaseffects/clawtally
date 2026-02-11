interface ShareCardProps {
  handle: string;
  totalTokens: number;
  totalCost: number;
}

export function ShareCard({ handle, totalTokens, totalCost }: ShareCardProps) {
  return (
    <article className="w-full rounded-2xl border border-[color:var(--border)] bg-gradient-to-br from-[color:var(--brand-soft)] to-transparent p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">ClawBoard Snapshot</p>
      <p className="mt-2 text-lg font-semibold">{handle}</p>
      <p className="mt-4 text-sm text-[color:var(--text-muted)]">Total tokens: {Intl.NumberFormat("en-US").format(totalTokens)}</p>
      <p className="text-sm text-[color:var(--text-muted)]">Total cost: ${totalCost.toFixed(2)}</p>
    </article>
  );
}
