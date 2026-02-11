"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { SiteTopbar } from "@/components/SiteTopbar";

interface PairClaimResponse {
  success: boolean;
  anonymousToken?: string;
  gatewayUrl?: string;
  error?: string;
}

type ClaimState = "claiming" | "failed" | "success";

export default function PairCodePage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = (params?.code ?? "").toUpperCase();

  const [state, setState] = useState<ClaimState>("claiming");
  const [message, setMessage] = useState("Claiming this OpenClaw pairing code...");

  useEffect(() => {
    const claim = async () => {
      if (!code) {
        setState("failed");
        setMessage("Missing pairing code.");
        return;
      }

      try {
        const response = await fetch("/api/pair/claim", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ code }),
        });

        const body = (await response.json()) as PairClaimResponse;

        if (!response.ok || !body.success || !body.anonymousToken) {
          setState("failed");
          setMessage(body.error ?? "Unable to claim pairing code.");
          return;
        }

        localStorage.setItem("clawboard.token", body.anonymousToken);
        if (body.gatewayUrl) {
          localStorage.setItem("clawboard.gatewayUrl", body.gatewayUrl);
        }
        localStorage.removeItem("clawboard.apiKey");

        setState("success");
        setMessage("Connected. Redirecting to your dashboard...");

        setTimeout(() => {
          router.push("/dashboard");
        }, 500);
      } catch {
        setState("failed");
        setMessage("Network error while claiming pairing code.");
      }
    };

    claim();
  }, [code, router]);

  const stateTitle =
    state === "success" ? "Pairing Complete" : state === "failed" ? "Pairing Unavailable" : "Claiming Pair Code";

  return (
    <main className="oc-shell">
      <header className="space-y-4">
        <SiteTopbar />
        <h1 className="sr-only">Pairing</h1>
      </header>

      <div className="mt-10 flex items-center justify-center">
        <section className="oc-panel w-full max-w-xl p-6 text-center md:p-8">
          <p className="oc-kicker">Pairing</p>
          <p className="mt-3 text-4xl font-semibold font-[family-name:var(--font-display)]">{code || "Pair Code"}</p>
          <p className="mt-3 text-xl font-medium">{stateTitle}</p>
          <p className="mt-3 text-sm text-[color:var(--text-secondary)]">{message}</p>

          <p className="mt-4 text-xs text-[color:var(--text-muted)]">
            ClawBoard only reads usage telemetry after pairing. No commands are sent to your agent.
          </p>

          {state === "failed" ? (
            <Link href="/" className="oc-button-primary mt-6 px-4 py-2 text-sm">
              Back Home
            </Link>
          ) : null}
        </section>
      </div>
    </main>
  );
}
