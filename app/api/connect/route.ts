import { NextResponse } from "next/server";

import { createUser } from "@/lib/data/store";
import { validateGatewayConnection } from "@/lib/gateway/client";
import { GatewayAgent } from "@/lib/gateway/types";
import { issueAnonymousToken } from "@/lib/tokens";

interface ConnectBody {
  gatewayUrl?: string;
  apiKey?: string;
}

export async function POST(request: Request) {
  const body = (await request.json()) as ConnectBody;

  if (!body.gatewayUrl) {
    return NextResponse.json({ error: "gatewayUrl is required" }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(body.gatewayUrl);
  } catch {
    return NextResponse.json({ error: "gatewayUrl must be a valid URL" }, { status: 400 });
  }

  let agents: GatewayAgent[];
  try {
    agents = await validateGatewayConnection({
      gatewayUrl: parsedUrl.toString(),
      apiKey: body.apiKey,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connection failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const userId = crypto.randomUUID();
  createUser({
    id: userId,
    anonymousId: userId.slice(0, 6),
    claimed: false,
    shareEnabled: false,
    gatewayUrl: parsedUrl.toString(),
    gatewayApiKey: body.apiKey ?? "",
    createdAt: new Date().toISOString(),
  });

  const anonymousToken = issueAnonymousToken(userId);

  return NextResponse.json({
    success: true,
    agents,
    anonymousToken,
  });
}
