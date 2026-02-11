"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import { SiteMenu } from "@/components/SiteMenu";

function BrandLockup({ size = "md" }: { size?: "md" | "sm" }) {
  const titleClass =
    size === "sm"
      ? "text-sm font-black tracking-tight font-[family-name:var(--font-display)]"
      : "text-base font-black tracking-tight font-[family-name:var(--font-display)]";

  return (
    <div className="leading-tight">
      <p className={`oc-wordmark ${titleClass}`}>
        <span className="text-white">CLAW</span>
        <span className="text-[color:var(--coral-bright)]">TALLY</span>
      </p>
    </div>
  );
}

export function SiteTopbar({ rightSlot }: { rightSlot?: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const activeSection =
    pathname === "/" || pathname?.startsWith("/ecosystem")
      ? "Ecosystem"
      : pathname?.startsWith("/dashboard")
        ? "Dashboard"
        : pathname?.startsWith("/leaderboard") || pathname?.startsWith("/u/")
          ? "Leaderboard"
          : null;
  const mobileLabel = activeSection ?? "Menu";

  useEffect(() => {
    // Close the drawer after navigation.
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    // The drawer is mobile-only. If the user resizes to desktop, force-close it
    // so it can't "hang" around (and so body scroll isn't locked).
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => {
      if (mq.matches) {
        setOpen(false);
      }
    };

    onChange();

    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }

    mq.addListener(onChange);
    return () => mq.removeListener(onChange);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    closeBtnRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-3">
          <BrandLockup />
        </Link>

        <div className="hidden items-center gap-2 md:flex">
          <SiteMenu />
          {rightSlot ? <span className="shrink-0">{rightSlot}</span> : null}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={[
              "oc-nav-link !gap-2 !px-3",
              activeSection ? "border-[color:var(--cyan-mid)] bg-white/[0.04] text-white" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label={activeSection ? `Open menu (${mobileLabel})` : "Open menu"}
          >
            <span className="text-sm font-medium">{mobileLabel}</span>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M4 7.5c0-.55.45-1 1-1h14a1 1 0 110 2H5a1 1 0 01-1-1zm0 5c0-.55.45-1 1-1h14a1 1 0 110 2H5a1 1 0 01-1-1zm1 4a1 1 0 000 2h14a1 1 0 100-2H5z"
              />
            </svg>
          </button>
        </div>
      </div>

      <div
        className={`fixed inset-0 z-50 md:hidden ${open ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!open}
      >
        <div
          className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}
          onClick={() => setOpen(false)}
        />

        <div
          role="dialog"
          aria-modal="true"
          className={[
            "fixed inset-y-0 right-0 w-[80vw] max-w-[360px]",
            "border-l border-white/10 bg-[linear-gradient(160deg,rgba(13,20,34,0.94)_0%,rgba(10,16,29,0.97)_100%)]",
            "rounded-l-2xl p-5",
            "transition-transform duration-300 ease-out will-change-transform",
            open ? "translate-x-0" : "translate-x-full",
          ].join(" ")}
        >
          <div className="flex items-center justify-between gap-3">
            <BrandLockup size="sm" />

            <button
              ref={closeBtnRef}
              type="button"
              onClick={() => setOpen(false)}
              className="oc-nav-link !px-3"
              aria-label="Close menu"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M18.3 5.7a1 1 0 010 1.4L13.4 12l4.9 4.9a1 1 0 01-1.4 1.4L12 13.4l-4.9 4.9a1 1 0 01-1.4-1.4l4.9-4.9-4.9-4.9a1 1 0 011.4-1.4l4.9 4.9 4.9-4.9a1 1 0 011.4 0z"
                />
              </svg>
            </button>
          </div>

          <div className="mt-6">
            <SiteMenu variant="drawer" onNavigate={() => setOpen(false)} />
          </div>

          {rightSlot ? (
            <div className="mt-4 border-t border-white/10 pt-4">
              <div className="flex">{rightSlot}</div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
