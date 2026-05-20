import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";

const intlMiddleware = createMiddleware({
  locales: ["ar", "en"],
  defaultLocale: "ar",
  localePrefix: "always",
});

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Handle next-intl routing
  const response = intlMiddleware(request);

  // 2. Auth protection logic (simulated for now until Better Auth is configured)
  // In a real app, you would check session here.
  const isAuthPage = pathname.includes("/login") || pathname.includes("/register");
  const isPublicApi = pathname.startsWith("/api/public");
  const isProtectedPage = pathname.includes("/dashboard") || pathname.includes("/portal") || pathname.includes("/surgical");

  // TODO: Implement Better Auth session check
  // if (isProtectedPage && !hasSession) {
  //   return NextResponse.redirect(new URL("/login", request.url));
  // }

  // 3. Rate limiting (simulated)
  // Using Upstash Rate Limit would happen here in production

  return response;
}

export const config = {
  // Match all pathnames except for
  // - /api (API routes)
  // - /_next (Next.js internals)
  // - /static (static files)
  // - /_vercel (Vercel internals)
  // - /favicon.ico, /sitemap.xml (SEO)
  matcher: ["/((?!api|_next|_vercel|static|.*\\..*).*)"],
};
