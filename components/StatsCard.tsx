interface StatsCardProps {
  label: string;
  value: string;
  caption?: string;
  tone?: "cyan" | "coral";
  size?: "normal" | "compact";
}

const toneBorder = (tone: "cyan" | "coral") =>
  tone === "coral"
    ? "from-[color:var(--coral-bright)]/80 to-transparent"
    : "from-[color:var(--cyan-bright)]/80 to-transparent";

const toneGlow = (tone: "cyan" | "coral") =>
  tone === "coral" ? "shadow-[0_0_30px_rgba(255,92,87,0.09)]" : "shadow-[0_0_30px_rgba(25,226,197,0.09)]";

export function StatsCard({ label, value, caption, tone = "cyan", size = "normal" }: StatsCardProps) {
  const paddingClassName = size === "compact" ? "p-3" : "p-4";
  const labelClassName =
    size === "compact"
      ? "text-[10px] uppercase tracking-[0.2em] text-[color:var(--text-muted)]"
      : "text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]";
  const valueClassName = size === "compact" ? "mt-1.5 text-xl font-semibold leading-none" : "mt-2 text-3xl font-semibold leading-none";
  const captionClassName =
    size === "compact"
      ? "mt-1 hidden text-xs text-[color:var(--text-secondary)] sm:block"
      : "mt-1 text-sm text-[color:var(--text-secondary)]";

  return (
    <article className={`oc-panel ${paddingClassName} ${toneGlow(tone)}`}>
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${toneBorder(tone)}`} />
      <p className={labelClassName}>{label}</p>
      <p className={valueClassName}>{value}</p>
      {caption ? <p className={captionClassName}>{caption}</p> : null}
    </article>
  );
}
