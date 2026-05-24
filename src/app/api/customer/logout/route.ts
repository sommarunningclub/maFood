import { NextResponse } from "next/server";
import { clearCustomerCookie } from "@/lib/auth/customer-session";

export async function POST() {
  await clearCustomerCookie();
  return NextResponse.json({ ok: true });
}
