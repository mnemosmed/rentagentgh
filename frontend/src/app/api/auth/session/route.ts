import { NextRequest, NextResponse } from "next/server";

import { ACCESS_COOKIE, REFRESH_COOKIE, cookieOptions } from "@/lib/auth-cookies";
import type { User } from "@/lib/types";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const access = body.access as string | undefined;
  const refresh = body.refresh as string | undefined;
  if (!access || !refresh) {
    return NextResponse.json({ detail: "Missing tokens." }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true, user: body.user as User | undefined });
  res.cookies.set(ACCESS_COOKIE, access, cookieOptions);
  res.cookies.set(REFRESH_COOKIE, refresh, cookieOptions);
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACCESS_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  return res;
}
