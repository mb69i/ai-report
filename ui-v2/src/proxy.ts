/**
 * Atlas V2 – Route Proxy (Next.js 16+ Route Middleware)
 *
 * Runs on every request before rendering.
 * - Unauthenticated users are redirected to /login.
 * - /login is always accessible.
 * - Static files and API routes are never intercepted.
 */
import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = new Set(["/login"]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow public routes and internal Next.js assets
  if (
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // Check for the auth token stored as a cookie (set by the client via JS)
  const token = request.cookies.get("atlas_token")?.value;

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - /api/* (backend proxied separately)
     * - /_next/static, /_next/image (Next.js internals)
     * - /favicon.ico
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
