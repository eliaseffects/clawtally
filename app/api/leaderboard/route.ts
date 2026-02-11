import { NextResponse } from "next/server";

import { getLeaderboard } from "@/lib/data/store";
import { LeaderboardCategory, LeaderboardPeriod } from "@/lib/types";

const VALID_CATEGORIES: LeaderboardCategory[] = ["tokens", "cost", "messages", "sessions", "streak"];
const VALID_PERIODS: LeaderboardPeriod[] = ["24h", "7d", "30d", "all"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const rawCategory = searchParams.get("category") ?? "tokens";
  const rawPeriod = searchParams.get("period") ?? "30d";

  if (!VALID_CATEGORIES.includes(rawCategory as LeaderboardCategory)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  if (!VALID_PERIODS.includes(rawPeriod as LeaderboardPeriod)) {
    return NextResponse.json({ error: "Invalid period" }, { status: 400 });
  }

  const category = rawCategory as LeaderboardCategory;
  const period = rawPeriod as LeaderboardPeriod;

  const entries = getLeaderboard(category, period);

  return NextResponse.json({
    category,
    period,
    entries,
  });
}
