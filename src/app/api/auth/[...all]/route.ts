import { authInstance } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

/**
 * API route handler exposing Better Auth's core auth endpoints.
 */
export const { GET, POST } = toNextJsHandler(authInstance);
