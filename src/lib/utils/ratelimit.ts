import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * HMS Egypt - Global Rate Limiter
 * Uses Upstash Redis for serverless-friendly rate limiting.
 */

// Initialize Redis only if environment variables are available
const redis = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

/**
 * Creates a rate limiter for a specific window.
 * Default: 60 requests per minute.
 */
export function createLimiter(requests: number = 60, window: `${number} ${"s" | "m" | "h" | "d"}` = "1 m") {
  if (!redis) return null;

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window),
    analytics: true,
    prefix: "hms_ratelimit",
  });
}

// Pre-defined limiters
export const searchLimiter = createLimiter(30, "1 m"); // 30 searches per minute per IP
export const authLimiter = createLimiter(5, "1 m");   // 5 login attempts per minute per IP
export const uploadLimiter = createLimiter(10, "1 m"); // 10 uploads per minute per IP
