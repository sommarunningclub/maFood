/*
  Sessão de admin do backoffice maFood.
  - JWT HS256 assinado com PDV_SESSION_SECRET (reaproveita a mesma chave do PDV)
  - Cookie httpOnly `mafood_admin` (12h, igual ao PDV)
*/
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "mafood_admin";
const TTL = 60 * 60 * 12; // 12h

export interface AdminSession {
  admin_id: string;
  email: string;
  name: string;
}

function getSecret() {
  const s = process.env.PDV_SESSION_SECRET;
  if (!s) throw new Error("PDV_SESSION_SECRET ausente");
  return new TextEncoder().encode(s);
}

export async function signAdmin(payload: AdminSession): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TTL}s`)
    .sign(getSecret());
}

export async function verifyAdmin(token: string): Promise<AdminSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const { admin_id, email, name } = payload as Record<string, unknown>;
    if (typeof admin_id !== "string" || typeof email !== "string" || typeof name !== "string") {
      return null;
    }
    return { admin_id, email, name };
  } catch {
    return null;
  }
}

export async function setAdminCookie(token: string) {
  const c = await cookies();
  c.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL,
  });
}

export async function clearAdminCookie() {
  const c = await cookies();
  c.delete(ADMIN_COOKIE);
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const c = await cookies();
  const token = c.get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  return verifyAdmin(token);
}
