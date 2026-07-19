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

async function readBody(request: NextRequest): Promise<{
  body: BodyInit | undefined;
  contentType: string | null;
}> {
  if (request.method === "GET" || request.method === "HEAD") {
    return { body: undefined, contentType: null };
  }

  const contentType = request.headers.get("content-type") || "";

  // Multipart: pass raw bytes and preserve boundary Content-Type.
  if (contentType.includes("multipart/form-data")) {
    const buf = await request.arrayBuffer();
    return { body: buf, contentType };
  }

  const text = await request.text();
  return { body: text || undefined, contentType: contentType || "application/json" };
}

async function forward(
  pathParts: string[],
  method: string,
  search: string,
  body: BodyInit | undefined,
  contentType: string | null,
  accessToken?: string
) {
  const target = `${API_URL}/api/${pathParts.join("/")}${pathParts.length ? "/" : ""}${search}`;
  const headers = new Headers();
  if (contentType) headers.set("Content-Type", contentType);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  return fetch(target, {
    method,
    headers,
    body,
    cache: "no-store",
  });
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
  const search = request.nextUrl.search;
  const { body, contentType } = await readBody(request);

  let access = await getAccessToken();
  let upstream = await forward(
    path,
    request.method,
    search,
    body,
    contentType,
    access
  );

  if (upstream.status === 401) {
    const refresh = await getRefreshToken();
    if (refresh) {
      const newAccess = await refreshAccess(refresh);
      if (newAccess) {
        access = newAccess;
        upstream = await forward(
          path,
          request.method,
          search,
          body,
          contentType,
          access
        );
        const resBody = await upstream.text();
        const res = new NextResponse(resBody, {
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

  const resBody = await upstream.text();
  return new NextResponse(resBody, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") || "application/json",
    },
  });
}
