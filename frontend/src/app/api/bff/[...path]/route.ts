import { NextRequest, NextResponse } from "next/server";

import {
  ACCESS_COOKIE,
  cookieOptions,
  getAccessToken,
  getRefreshToken,
} from "@/lib/auth-cookies";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

async function refreshAccess(refresh: string): Promise<string | null> {
  const res = await fetch(`${API_URL}/api/auth/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.access || null;
}

async function forward(
  request: NextRequest,
  pathParts: string[],
  accessToken?: string
) {
  const search = request.nextUrl.search;
  const target = `${API_URL}/api/${pathParts.join("/")}${pathParts.length ? "/" : ""}${search}`;
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: "no-store",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.text();
  }

  return fetch(target, init);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return handle(request, context);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return handle(request, context);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return handle(request, context);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return handle(request, context);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return handle(request, context);
}

async function handle(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  let access = await getAccessToken();
  let upstream = await forward(request, path, access);

  if (upstream.status === 401) {
    const refresh = await getRefreshToken();
    if (refresh) {
      const newAccess = await refreshAccess(refresh);
      if (newAccess) {
        access = newAccess;
        upstream = await forward(request, path, access);
        const body = await upstream.text();
        const res = new NextResponse(body, {
          status: upstream.status,
          headers: {
            "Content-Type":
              upstream.headers.get("Content-Type") || "application/json",
          },
        });
        res.cookies.set(ACCESS_COOKIE, newAccess, cookieOptions);
        return res;
      }
    }
  }

  const body = await upstream.text();
  return new NextResponse(body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") || "application/json",
    },
  });
}
