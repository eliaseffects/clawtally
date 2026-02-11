import { NextResponse } from "next/server";

import { buildUsageStats, toStatsApiResponse } from "@/lib/analytics";
import { getUserById, saveUserStats, updateUser } from "@/lib/data/store";
import { fetchGatewayStats } from "@/lib/gateway/client";
import { GatewayRawStats } from "@/lib/gateway/types";
import { verifyAnonymousToken } from "@/lib/tokens";

interface SyncBody {
  anonymousToken?: string;
  gatewayUrl?: string;
  apiKey?: string;
}

export async function POST(request: Request) {
  const body = (await request.json()) as SyncBody;

  if (!body.anonymousToken) {
    return NextResponse.json({ error: "anonymousToken is required" }, { status: 400 });
  }

  const tokenPayload = verifyAnonymousToken(body.anonymousToken);
  if (!tokenPayload) {
    return NextResponse.json({ error: "Invalid anonymous token" }, { status: 401 });
  }

  const user = getUserById(tokenPayload.sub);
  if (!user) {
    return NextResponse.json({ error: "Unknown user token" }, { status: 404 });
  }

  const effectiveGatewayUrl = body.gatewayUrl ?? user.gatewayUrl;
  const effectiveApiKey = body.apiKey ?? user.gatewayApiKey;

  if (!effectiveGatewayUrl) {
    return NextResponse.json({ error: "No gateway URL is stored for this session" }, { status: 400 });
  }

  let rawStats: GatewayRawStats;
  try {
    rawStats = await fetchGatewayStats({
      gatewayUrl: effectiveGatewayUrl,
      apiKey: effectiveApiKey,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Usage sync failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const usageStats = buildUsageStats(rawStats);
  const updatedUser = saveUserStats(user.id, usageStats);

  if (!updatedUser) {
    return NextResponse.json({ error: "Unable to store stats" }, { status: 500 });
  }

  updateUser(user.id, {
    gatewayUrl: effectiveGatewayUrl,
    ...(effectiveApiKey !== undefined ? { gatewayApiKey: effectiveApiKey } : {}),
  });

  return NextResponse.json({
    success: true,
    stats: toStatsApiResponse(updatedUser),
  });
}
