import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Analytics } from "@vercel/analytics/next";

import "@/app/globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://clawtally.com"),
  title: "Clawtally",
  description: "Usage intelligence and community telemetry for OpenClaw power users.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "Clawtally",
    description: "Usage intelligence and community telemetry for OpenClaw power users.",
    url: "https://clawtally.com",
    siteName: "Clawtally",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Clawtally",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Clawtally",
    description: "Usage intelligence and community telemetry for OpenClaw power users.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="oc-backdrop" aria-hidden="true">
          <div className="oc-stars" />
          <div className="oc-nebula" />
          <div className="oc-vignette" />
        </div>
        <div className="relative z-10">{children}</div>
        <Analytics />
      </body>
    </html>
  );
}
