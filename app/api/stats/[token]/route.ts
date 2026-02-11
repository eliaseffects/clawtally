import { NextResponse } from "next/server";

import { toStatsApiResponse } from "@/lib/analytics";
import { getUserById } from "@/lib/data/store";
import { verifyAnonymousToken } from "@/lib/tokens";

interface RouteContext {
  params: Promise<{ token: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { token } = await context.params;
  const tokenPayload = verifyAnonymousToken(token);

  const userId = tokenPayload?.sub ?? token;
  const user = getUserById(userId);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const stats = toStatsApiResponse(user);
  if (!stats) {
    return NextResponse.json({ error: "No stats synced yet" }, { status: 404 });
  }

  return NextResponse.json(stats);
}
