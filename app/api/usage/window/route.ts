import { NextResponse } from "next/server";

import { getUserById } from "@/lib/data/store";
import { fetchGatewayUsageWindow } from "@/lib/gateway/client";
import { buildUsageWindowSummary } from "@/lib/gateway/usage-window";
import { verifyAnonymousToken } from "@/lib/tokens";

type UsagePeriod = "24h" | "7d" | "30d" | "all";

interface UsageWindowBody {
  anonymousToken?: string;
  period?: UsagePeriod;
  startDate?: string;
  endDate?: string;
}

const isIsoDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

const todayLocalIso = (): string => {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const shiftIsoDate = (isoDate: string, days: number): string => {
  const base = new Date(`${isoDate}T00:00:00`);
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
};

const datesForPeriod = (period: UsagePeriod): { startDate: string; endDate: string } => {
  const endDate = todayLocalIso();

  switch (period) {
    case "24h":
      return { startDate: endDate, endDate };
    case "7d":
      return { startDate: shiftIsoDate(endDate, -6), endDate };
    case "30d":
      return { startDate: shiftIsoDate(endDate, -29), endDate };
    case "all":
      return { startDate: process.env.CLAWBOARD_ALL_TIME_START_DATE || "1970-01-01", endDate };
  }
};

export async function POST(request: Request) {
  const body = (await request.json()) as UsageWindowBody;

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

  const effectiveGatewayUrl = user.gatewayUrl;
  const effectiveApiKey = user.gatewayApiKey;

  if (!effectiveGatewayUrl) {
    return NextResponse.json({ error: "No gateway URL is stored for this session" }, { status: 400 });
  }

  const period = body.period ?? "30d";
  let startDate: string;
  let endDate: string;

  if (body.startDate && body.endDate) {
    if (!isIsoDate(body.startDate) || !isIsoDate(body.endDate)) {
      return NextResponse.json({ error: "startDate/endDate must be YYYY-MM-DD" }, { status: 400 });
    }
    startDate = body.startDate;
    endDate = body.endDate;
  } else {
    ({ startDate, endDate } = datesForPeriod(period));
  }

  try {
    const { usage, cost } = await fetchGatewayUsageWindow(
      { gatewayUrl: effectiveGatewayUrl, apiKey: effectiveApiKey },
      { startDate, endDate, limit: 1000 },
    );

    const summary = buildUsageWindowSummary(usage, cost, { startDate, endDate });
    return NextResponse.json({ success: true, summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to fetch usage window";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

