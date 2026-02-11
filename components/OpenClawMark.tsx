export function OpenClawMark({ className = "" }: { className?: string }) {
  return (
    <span
      className={[
        "inline-flex items-center justify-center rounded-xl border border-white/10 bg-black/25 p-1.5",
        "shadow-[0_0_24px_rgba(255,92,87,0.18)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <img src="/logo.png" alt="Clawtally" className="h-7 w-7 rounded-lg object-cover" />
    </span>
  );
}
