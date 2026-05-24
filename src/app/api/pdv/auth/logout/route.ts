import { NextResponse } from "next/server";
import { clearPdvSessionCookie } from "@/lib/auth/session";

export async function POST() {
  await clearPdvSessionCookie();
  return NextResponse.json({ ok: true });
}
