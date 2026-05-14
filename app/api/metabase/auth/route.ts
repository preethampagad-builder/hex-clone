import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { metabaseUrl, apiKey, email, password } = await req.json();
  const base = metabaseUrl.replace(/\/$/, "");

  // API key auth — verify it works and return it as the "token"
  if (apiKey) {
    try {
      const res = await fetch(`${base}/api/database`, {
        headers: { "X-API-KEY": apiKey },
      });
      if (!res.ok) {
        const err = await res.text();
        return NextResponse.json({ error: `API key invalid: ${err}` }, { status: 401 });
      }
      // Return the API key as the token; downstream routes detect it via x-metabase-auth-type
      return NextResponse.json({ token: apiKey, authType: "apikey" });
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }

  // Username/password auth (fallback for non-SSO accounts)
  try {
    const res = await fetch(`${base}/api/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: email, password }),
    });
    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Auth failed: ${err}` }, { status: 401 });
    }
    const data = await res.json();
    return NextResponse.json({ token: data.id, authType: "session" });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
