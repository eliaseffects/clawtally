import { NextResponse } from "next/server";

import pkg from "@/package.json";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "clawboard",
      version: pkg.version,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}
