"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  activeWhen: (pathname: string) => boolean;
};

type SiteMenuVariant = "inline" | "drawer";

type SiteMenuProps = {
  className?: string;
  variant?: SiteMenuVariant;
  onNavigate?: () => void;
};

const GITHUB_URL = "https://github.com/eliaseffects/clawtally";

const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Ecosystem",
    activeWhen: (pathname) => pathname === "/" || pathname.startsWith("/ecosystem"),
  },
  {
    href: "/dashboard",
    label: "Dashboard",
    activeWhen: (pathname) => pathname.startsWith("/dashboard"),
  },
  {
    href: "/leaderboard",
    label: "Leaderboard",
    activeWhen: (pathname) => pathname.startsWith("/leaderboard") || pathname.startsWith("/u/"),
  },
];

const linkClass = (active: boolean): string =>
  [
    "oc-nav-link",
    active ? "border-[color:var(--cyan-mid)] bg-white/[0.04] text-white" : "",
  ]
    .filter(Boolean)
    .join(" ");

const drawerLinkClass = (active: boolean): string =>
  [
    linkClass(active),
    "!w-full !justify-between !rounded-xl !px-4 !py-3 !text-base",
  ]
    .filter(Boolean)
    .join(" ");

export function SiteMenu({ className = "", variant = "inline", onNavigate }: SiteMenuProps) {
  const pathname = usePathname() ?? "/";

  return (
    <nav className={`flex ${variant === "drawer" ? "flex-col items-stretch gap-2" : "flex-wrap items-center gap-2"} ${className}`}>
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={variant === "drawer" ? drawerLinkClass(item.activeWhen(pathname)) : linkClass(item.activeWhen(pathname))}
          onClick={() => {
            onNavigate?.();
          }}
        >
          {item.label}
        </Link>
      ))}
      {variant === "inline" ? (
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          className="oc-nav-link !px-3"
          aria-label="Clawtally on GitHub"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M12 2a10 10 0 0 0-3.162 19.49c.5.092.682-.217.682-.483 0-.237-.008-.866-.013-1.7-2.776.603-3.362-1.34-3.362-1.34-.454-1.156-1.11-1.465-1.11-1.465-.907-.62.069-.607.069-.607 1.002.07 1.53 1.03 1.53 1.03.89 1.526 2.337 1.085 2.906.83.091-.645.35-1.085.636-1.335-2.22-.252-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.03-2.683-.104-.253-.446-1.27.098-2.65 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.91-1.294 2.75-1.025 2.75-1.025.544 1.38.202 2.397.099 2.65.64.699 1.03 1.592 1.03 2.683 0 3.842-2.338 4.687-4.566 4.934.359.31.678.92.678 1.854 0 1.337-.012 2.417-.012 2.744 0 .268.18.58.688.482A10.002 10.002 0 0 0 12 2Z"
            />
          </svg>
        </a>
      ) : (
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          className={drawerLinkClass(false)}
          aria-label="Clawtally on GitHub"
        >
          <span>GitHub</span>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M12 2a10 10 0 0 0-3.162 19.49c.5.092.682-.217.682-.483 0-.237-.008-.866-.013-1.7-2.776.603-3.362-1.34-3.362-1.34-.454-1.156-1.11-1.465-1.11-1.465-.907-.62.069-.607.069-.607 1.002.07 1.53 1.03 1.53 1.03.89 1.526 2.337 1.085 2.906.83.091-.645.35-1.085.636-1.335-2.22-.252-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.03-2.683-.104-.253-.446-1.27.098-2.65 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.91-1.294 2.75-1.025 2.75-1.025.544 1.38.202 2.397.099 2.65.64.699 1.03 1.592 1.03 2.683 0 3.842-2.338 4.687-4.566 4.934.359.31.678.92.678 1.854 0 1.337-.012 2.417-.012 2.744 0 .268.18.58.688.482A10.002 10.002 0 0 0 12 2Z"
            />
          </svg>
        </a>
      )}
    </nav>
  );
}
