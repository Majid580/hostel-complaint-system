import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/jwt";

/**
 * Two jobs:
 *   1. Keep unauthenticated visitors out of /student and /staff (the API
 *      enforces this too — this is just a nicer redirect than a 401 page).
 *   2. Attach security headers to every response.
 *
 * Deliberately does NOT hit the database: this runs on every request and a DB
 * round trip here would double our latency. Full validation (tokenVersion,
 * isActive) happens in `getCurrentUser()` on the routes that matter.
 */

/**
 * Content-Security-Policy, built per request so each response carries a fresh
 * nonce. Next.js reads the nonce back out of this header and stamps it onto its
 * own bootstrap scripts, which is what lets `script-src` stay free of
 * 'unsafe-inline' in production.
 *
 * The loose entries are all deliberate:
 *   style-src 'unsafe-inline'  — Next injects inline styles for next/font and
 *                                for streamed CSS; nonces do not reach them.
 *   'unsafe-eval' in dev only  — React Fast Refresh needs it.
 *   *.cloudinary.com           — photos and voice notes are uploaded straight
 *                                from the browser and served back from there.
 *   blob:                      — MediaRecorder preview of a voice note before
 *                                it is uploaded.
 */
function contentSecurityPolicy(nonce: string, isDev: boolean): string {
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https://res.cloudinary.com`,
    `media-src 'self' blob: https://res.cloudinary.com`,
    `font-src 'self' data:`,
    `connect-src 'self' https://api.cloudinary.com https://res.cloudinary.com${isDev ? " ws: wss:" : ""}`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `manifest-src 'self'`,
    ...(isDev ? [] : [`upgrade-insecure-requests`]),
  ].join("; ");
}

function securityHeaders(response: NextResponse, csp?: string): NextResponse {
  if (csp) response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-DNS-Prefetch-Control", "off");
  response.headers.set(
    "Permissions-Policy",
    "camera=(self), microphone=(self), geolocation=(), interest-cohort=()",
  );
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const isDev = process.env.NODE_ENV === "development";
  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce, isDev);

  /* --- CSRF: mutating requests must come from our own origin ------------- */
  if (["POST", "PATCH", "PUT", "DELETE"].includes(request.method) && pathname.startsWith("/api/")) {
    const origin = request.headers.get("origin");
    if (origin) {
      const host = request.headers.get("host");
      try {
        if (new URL(origin).host !== host) {
          return securityHeaders(
            NextResponse.json(
              { ok: false, error: { code: "FORBIDDEN", message: "Cross-origin request blocked." } },
              { status: 403 },
            ),
            csp,
          );
        }
      } catch {
        return securityHeaders(
          NextResponse.json(
            { ok: false, error: { code: "FORBIDDEN", message: "Invalid origin." } },
            { status: 403 },
          ),
          csp,
        );
      }
    }
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  const isProtected = pathname.startsWith("/student") || pathname.startsWith("/staff");
  const isAuthPage = pathname === "/login" || pathname === "/register";

  if (isProtected && !session) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return securityHeaders(NextResponse.redirect(url), csp);
  }

  if (session) {
    // Staff have no student panel and vice versa.
    if (pathname.startsWith("/staff") && session.role === "STUDENT") {
      const url = request.nextUrl.clone();
      url.pathname = "/student";
      url.search = "";
      return securityHeaders(NextResponse.redirect(url), csp);
    }
    if (pathname.startsWith("/student") && session.role !== "STUDENT") {
      const url = request.nextUrl.clone();
      url.pathname = "/staff";
      url.search = "";
      return securityHeaders(NextResponse.redirect(url), csp);
    }
    // Force the password change before anything else.
    if (session.mcp && isProtected && pathname !== "/change-password") {
      const url = request.nextUrl.clone();
      url.pathname = "/change-password";
      url.search = "";
      return securityHeaders(NextResponse.redirect(url), csp);
    }
    if (isAuthPage) {
      const url = request.nextUrl.clone();
      url.pathname = session.role === "STUDENT" ? "/student" : "/staff";
      url.search = "";
      return securityHeaders(NextResponse.redirect(url), csp);
    }
  }

  // Next.js reads the nonce back out of the request's CSP header and stamps it
  // onto its own scripts, so it must be set on the request as well as the
  // response.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  return securityHeaders(NextResponse.next({ request: { headers: requestHeaders } }), csp);
}

export const config = {
  matcher: [
    /*
     * Everything except Next internals and static assets.
     */
    "/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
