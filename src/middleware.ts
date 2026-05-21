import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";

const intlMiddleware = createMiddleware({
  locales: ["ar", "en"],
  defaultLocale: "ar",
  localePrefix: "always",
});

export default function middleware(request: NextRequest) {
  // 1. Handle next-intl routing
  const response = intlMiddleware(request);

  // 2. Auth protection logic (simulated for now until Better Auth is configured)
  // TODO: Implement Better Auth session check

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
