import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "Claim flow is not implemented in MVP. Use anonymous sharing for now.",
    },
    { status: 501 },
  );
}
