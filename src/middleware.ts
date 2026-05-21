import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";

const intlMiddleware = createMiddleware({
  locales: ["ar", "en"],
  defaultLocale: "ar",
  localePrefix: "always",
});

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Identify locale and segments
  const segments = pathname.split("/").filter(Boolean);
  const hasLocale = ["ar", "en"].includes(segments[0]);
  const locale = hasLocale ? segments[0] : "ar";
  const normalizedSegments = hasLocale ? segments.slice(1) : segments;

  const primarySegment = normalizedSegments[0];

  const isLoginPage = primarySegment === "login";
  const isChangePasswordPage = primarySegment === "change-password";
  const isOnboardingPage = primarySegment === "onboarding";
  
  // Dashboard routes represent any non-auth, non-onboarding, and non-empty path
  const isDashboardRoute = primarySegment && !isLoginPage && !isChangePasswordPage && !isOnboardingPage;

  // 2. Optimistic session check using cookies (fully compatible with Edge Runtime)
  // Better Auth uses 'better-auth.session_token' (HTTP) and '__Secure-better-auth.session_token' (HTTPS)
  const isDev = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";

  const hasSession = request.cookies.has("better-auth.session_token") || 
                     request.cookies.has("__Secure-better-auth.session_token") ||
                     // Development mock fallbacks
                     (isDev && (
                       request.cookies.has("mock_super_admin") ||
                       request.headers.has("x-mock-user")
                     ));

  // 3. Routing & Redirection Guards
  if (isDashboardRoute || isChangePasswordPage) {
    if (!hasSession) {
      // Unauthenticated, redirect to login
      const loginUrl = new URL(`/${locale}/login`, request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (isLoginPage && hasSession) {
    // Authenticated user trying to access login, redirect to home or super-admin
    // (Actual role-based dashboard landing pages are handled securely inside pages/layouts)
    return NextResponse.redirect(new URL(`/${locale}`, request.url));
  }

  // 4. Handle next-intl routing
  return intlMiddleware(request);
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


