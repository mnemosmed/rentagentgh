import type { ApiError } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export class ApiRequestError extends Error {
  status: number;
  body: ApiError;

  constructor(status: number, body: ApiError) {
    super(body.detail || `Request failed (${status})`);
    this.status = status;
    this.body = body;
  }
}

async function parseJson(res: Response) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { detail: text };
  }
}

/** Server-side call to Django (no cookies). */
export async function djangoFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, headers, ...rest } = options;
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    cache: "no-store",
  });
  const data = await parseJson(res);
  if (!res.ok) throw new ApiRequestError(res.status, data);
  return data as T;
}

/** Browser call via Next BFF proxy (attaches JWT from httpOnly cookies). */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`/api/bff${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const data = await parseJson(res);
  if (!res.ok) throw new ApiRequestError(res.status, data);
  return data as T;
}

export { API_URL };
