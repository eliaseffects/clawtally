import { NextResponse } from "next/server";

import { buildUsageStats, toStatsApiResponse } from "@/lib/analytics";
import { getPairingStatus, markPairingClaimed } from "@/lib/data/pairing-store";
import { createUser, saveUserStats } from "@/lib/data/store";
import { fetchGatewayStats, validateGatewayConnection } from "@/lib/gateway/client";
import { issueAnonymousToken } from "@/lib/tokens";

interface PairClaimBody {
  code?: string;
}

const mapPairingErrorStatus = (reason: "not_found" | "expired" | "claimed"): number => {
  switch (reason) {
    case "expired":
      return 410;
    case "claimed":
      return 409;
    case "not_found":
    default:
      return 404;
  }
};

export async function POST(request: Request) {
  const body = (await request.json()) as PairClaimBody;
  const code = body.code?.trim().toUpperCase() ?? "";

  if (!code) {
    return NextResponse.json({ error: "Pairing code is required" }, { status: 400 });
  }

  const pairingStatus = getPairingStatus(code);
  if (!pairingStatus.ok) {
    return NextResponse.json({ error: `Pairing code ${pairingStatus.reason.replace("_", " ")}` }, { status: mapPairingErrorStatus(pairingStatus.reason) });
  }

  const pairing = pairingStatus.record;

  try {
    await validateGatewayConnection({
      gatewayUrl: pairing.gatewayUrl,
      apiKey: pairing.gatewayApiKey,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gateway validation failed";
    return NextResponse.json({ error: `Unable to validate paired gateway: ${message}` }, { status: 502 });
  }

  const userId = crypto.randomUUID();
  createUser({
    id: userId,
    anonymousId: userId.slice(0, 6),
    claimed: false,
    shareEnabled: false,
    gatewayUrl: pairing.gatewayUrl,
    gatewayApiKey: pairing.gatewayApiKey,
    createdAt: new Date().toISOString(),
  });

  try {
    const rawStats = await fetchGatewayStats({
      gatewayUrl: pairing.gatewayUrl,
      apiKey: pairing.gatewayApiKey,
    });

    const usageStats = buildUsageStats(rawStats);
    const updatedUser = saveUserStats(userId, usageStats);
    if (!updatedUser) {
      return NextResponse.json({ error: "Unable to persist paired usage stats" }, { status: 500 });
    }

    const claimRecord = markPairingClaimed(code, userId);
    if (!claimRecord) {
      return NextResponse.json({ error: "Pairing code is no longer claimable" }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      anonymousToken: issueAnonymousToken(userId),
      gatewayUrl: pairing.gatewayUrl,
      stats: toStatsApiResponse(updatedUser),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to sync paired stats";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
