import { NextResponse } from "next/server";

import { getUserById, updateUser } from "@/lib/data/store";
import { verifyAnonymousToken } from "@/lib/tokens";

interface ShareBody {
  anonymousToken?: string;
  shareEnabled?: boolean;
}

export async function POST(request: Request) {
  const body = (await request.json()) as ShareBody;

  if (!body.anonymousToken || typeof body.shareEnabled !== "boolean") {
    return NextResponse.json({ error: "anonymousToken and shareEnabled are required" }, { status: 400 });
  }

  const tokenPayload = verifyAnonymousToken(body.anonymousToken);
  if (!tokenPayload) {
    return NextResponse.json({ error: "Invalid anonymous token" }, { status: 401 });
  }

  const user = getUserById(tokenPayload.sub);
  if (!user) {
    return NextResponse.json({ error: "Unknown user token" }, { status: 404 });
  }

  const updated = updateUser(user.id, {
    shareEnabled: body.shareEnabled,
  });

  if (!updated) {
    return NextResponse.json({ error: "Unable to update user" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    shareEnabled: updated.shareEnabled,
    profileUrl: `/u/${updated.id}`,
  });
}
