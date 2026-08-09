import { NextRequest, NextResponse } from "next/server"

/** Allow Expo / mobile clients to call the API (esp. Expo web). */
export function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next()
  }

  if (req.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders(),
    })
  }

  const res = NextResponse.next()
  for (const [k, v] of Object.entries(corsHeaders())) {
    res.headers.set(k, v)
  }
  return res
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-setup-secret",
  }
}

export const config = {
  matcher: "/api/:path*",
}
