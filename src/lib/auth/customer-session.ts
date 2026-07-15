import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const CUSTOMER_COOKIE = "mafood_customer";
const TTL = 60 * 60 * 24 * 30; // 30 dias

export interface CustomerSession {
  customer_id: string;
  cpf: string;
  name: string;
  is_vip: boolean;
}

function getSecret() {
  const s = process.env.PDV_SESSION_SECRET; // reaproveita o secret
  if (!s) throw new Error("PDV_SESSION_SECRET ausente");
  return new TextEncoder().encode(s);
}

export async function signCustomer(payload: CustomerSession): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TTL}s`)
    .sign(getSecret());
}

export async function verifyCustomer(token: string): Promise<CustomerSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const { customer_id, cpf, name, is_vip } = payload as Record<string, unknown>;
    if (typeof customer_id !== "string" || typeof cpf !== "string" || typeof name !== "string") return null;
    return { customer_id, cpf, name, is_vip: Boolean(is_vip) };
  } catch {
    return null;
  }
}

export async function setCustomerCookie(token: string) {
  const c = await cookies();
  c.set(CUSTOMER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL,
  });
}

/** Preferível em Route Handlers: garante Set-Cookie no NextResponse.json. */
export function attachCustomerCookie(
  res: import("next/server").NextResponse,
  token: string
) {
  res.cookies.set(CUSTOMER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL,
  });
  return res;
}

export async function clearCustomerCookie() {
  const c = await cookies();
  c.delete(CUSTOMER_COOKIE);
}

export async function getCustomerSession(): Promise<CustomerSession | null> {
  const c = await cookies();
  const token = c.get(CUSTOMER_COOKIE)?.value;
  if (!token) return null;
  return verifyCustomer(token);
}
