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
    </nav>
  );
}
