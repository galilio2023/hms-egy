import { createAuthClient } from "better-auth/react";

/**
 * Better Auth client instance for client-side React actions and state management.
 */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
});

export const { signIn, signUp, signOut, useSession } = authClient;
