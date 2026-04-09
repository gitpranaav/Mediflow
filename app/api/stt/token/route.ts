import { NextResponse } from "next/server";

import { getServerSession } from "@/src/lib/auth/session";

export async function POST() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Missing DEEPGRAM_API_KEY" }, { status: 500 });

  // Dev-friendly: return the API key and authenticate via websocket subprotocol.
  // This avoids putting tokens in the URL (which can be blocked/logged by proxies) and matches your other project.
  return NextResponse.json({ token: apiKey, mode: "subprotocol_token" });
}

