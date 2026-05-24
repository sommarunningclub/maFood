import { NextResponse, type NextRequest } from "next/server";
import { verifySession, PDV_COOKIE } from "@/lib/auth/session";
import { verifyCustomer, CUSTOMER_COOKIE } from "@/lib/auth/customer-session";

const PDV_PUBLIC = [
  /^\/loja\/[^/]+\/login\/?$/,
  /^\/pdv\/login\/?$/,
];

// Rotas do cliente que podem ser acessadas sem login
function isCustomerPublic(pathname: string, venue: string) {
  return (
    pathname === `/${venue}/login` ||
    pathname === `/${venue}/login/`
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // APIs auth-públicas
  if (
    pathname.startsWith("/api/pdv/auth") ||
    pathname.startsWith("/api/customer/") ||
    pathname.startsWith("/api/landing/") ||
    pathname.startsWith("/api/webhooks/")
  ) {
    return NextResponse.next();
  }

  // ── Painel PDV (/loja/*, /pdv/*) ────────────────────────────────
  if (pathname.startsWith("/loja/") || pathname.startsWith("/pdv/")) {
    if (PDV_PUBLIC.some((re) => re.test(pathname))) return NextResponse.next();

    const token = req.cookies.get(PDV_COOKIE)?.value;
    const session = token ? await verifySession(token) : null;
    const m = pathname.match(/^\/(loja|pdv)\/([^/]+)/);
    const reqSegment = m?.[2];

    if (!session) {
      const url = req.nextUrl.clone();
      url.pathname =
        m?.[1] === "loja" && reqSegment ? `/loja/${reqSegment}/login` : "/pdv/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    if (reqSegment && reqSegment !== session.pdv_slug && reqSegment !== session.pdv_id) {
      const url = req.nextUrl.clone();
      url.pathname = `/loja/${session.pdv_slug}/pedidos`;
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // ── Cliente (/<venue>/...) ──────────────────────────────────────
  // Match /<venue>[/...] mas exclui rotas conhecidas (admin, loja, pdv, api, _next)
  const venueMatch = pathname.match(/^\/([^/]+)(?:\/|$)/);
  const venue = venueMatch?.[1];
  const RESERVED = new Set(["admin", "loja", "pdv", "api", "_next", "favicon.ico"]);
  if (venue && !RESERVED.has(venue) && !venue.includes(".")) {
    if (isCustomerPublic(pathname, venue)) return NextResponse.next();

    const token = req.cookies.get(CUSTOMER_COOKIE)?.value;
    const customer = token ? await verifyCustomer(token) : null;

    if (!customer) {
      const url = req.nextUrl.clone();
      url.pathname = `/${venue}/login`;
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Tudo exceto _next/static, _next/image, favicon, api (deixamos api passar acima e decidir)
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
