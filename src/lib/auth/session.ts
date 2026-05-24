import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const PDV_COOKIE = "mafood_pdv_session";
const SESSION_TTL_SEC = 60 * 60 * 12; // 12h — turno do evento

export interface PdvSession {
  pdv_id: string;
  pdv_slug: string;
}

function getSecret() {
  const s = process.env.PDV_SESSION_SECRET;
  if (!s) throw new Error("PDV_SESSION_SECRET ausente em .env.local");
  return new TextEncoder().encode(s);
}

/** Assina um JWT e devolve a string. */
export async function signSession(payload: PdvSession): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SEC}s`)
    .sign(getSecret());
}

/** Verifica um JWT e devolve o payload, ou null se inválido/expirado. */
export async function verifySession(token: string): Promise<PdvSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.pdv_id !== "string" || typeof payload.pdv_slug !== "string") return null;
    return { pdv_id: payload.pdv_id, pdv_slug: payload.pdv_slug };
  } catch {
    return null;
  }
}

// ── Cookie helpers (Route Handlers / Server Actions apenas) ─────────

export async function setPdvSessionCookie(token: string) {
  const c = await cookies();
  c.set(PDV_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SEC,
  });
}

export async function clearPdvSessionCookie() {
  const c = await cookies();
  c.delete(PDV_COOKIE);
}

/** Lê a sessão do cookie atual (Server Component / Route Handler). */
export async function getPdvSession(): Promise<PdvSession | null> {
  const c = await cookies();
  const token = c.get(PDV_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}
