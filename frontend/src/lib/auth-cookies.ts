import { cookies } from "next/headers";

export const ACCESS_COOKIE = "rag_access";
export const REFRESH_COOKIE = "rag_refresh";

const secure = process.env.NODE_ENV === "production";

export const cookieOptions = {
  httpOnly: true as const,
  secure,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

export async function getAccessToken(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(ACCESS_COOKIE)?.value;
}

export async function getRefreshToken(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(REFRESH_COOKIE)?.value;
}
