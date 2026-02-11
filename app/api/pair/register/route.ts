import { NextResponse } from "next/server";

import { createPairing } from "@/lib/data/pairing-store";

interface PairRegisterBody {
  code?: string;
  gatewayUrl?: string;
  apiKey?: string;
  source?: string;
  expiresInSeconds?: number;
}

const validatePairingSecret = (request: Request): boolean => {
  const expected = process.env.CLAWBOARD_PAIRING_SECRET;
  if (!expected) {
    return true;
  }

  const provided = request.headers.get("x-clawboard-pair-secret") ?? "";
  return provided === expected;
};

export async function POST(request: Request) {
  if (!validatePairingSecret(request)) {
    return NextResponse.json({ error: "Unauthorized pairing register request" }, { status: 401 });
  }

  const body = (await request.json()) as PairRegisterBody;

  if (!body.gatewayUrl) {
    return NextResponse.json({ error: "gatewayUrl is required" }, { status: 400 });
  }

  let parsedGatewayUrl: URL;
  try {
    parsedGatewayUrl = new URL(body.gatewayUrl);
  } catch {
    return NextResponse.json({ error: "gatewayUrl must be a valid URL" }, { status: 400 });
  }

  try {
    const pairing = createPairing({
      code: body.code,
      gatewayUrl: parsedGatewayUrl.toString(),
      gatewayApiKey: body.apiKey ?? "",
      source: body.source,
      expiresInSeconds: body.expiresInSeconds,
    });

    const origin = new URL(request.url).origin;
    return NextResponse.json({
      success: true,
      code: pairing.code,
      expiresAt: new Date(pairing.expiresAtMs).toISOString(),
      pairUrl: `${origin}/pair/${encodeURIComponent(pairing.code)}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to register pairing";
    const status = message.includes("already exists") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
