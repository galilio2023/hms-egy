import { headers } from "next/headers";
import { type User } from "@/types/auth-api.types";

export interface Session {
  user: User;
  expiresAt: Date;
}

/**
 * Gets the current authenticated session on the server.
 * Since Authentication is in Phase 6, this returns a mock session for development/testing,
 * but is fully structured to match the Better Auth interface.
 */
export async function auth(): Promise<Session | null> {
  const reqHeaders = await headers();
  const mockUserHeader = reqHeaders.get("x-mock-user");
  
  if (mockUserHeader) {
    try {
      const user = JSON.parse(mockUserHeader);
      return {
        user,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      };
    } catch {
      // Ignored
    }
  }

  // Safe development fallback: returns the simulated default administrator or super admin
  // so development flow is not blocked before Phase 6 is complete.
  // In production, we'll check actual cookies/headers.
  if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") {
    const referer = reqHeaders.get("referer") || "";
    if (referer.includes("/super-admin")) {
      return {
        user: {
          id: "super-admin-id",
          email: "superadmin@hms.gov.eg",
          name: "Super Admin",
          role: "SUPER_ADMIN",
          hospitalId: "system-wide",
        },
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      };
    }

    // Default mock tenant administrator
    return {
      user: {
        id: "admin-id-1",
        email: "admin@alshifa.com.eg",
        name: "د. أحمد الشافعي",
        role: "ADMIN",
        hospitalId: "default-hospital-id",
      },
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    };
  }

  return null;
}
