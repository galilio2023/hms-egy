import { headers, cookies } from "next/headers";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db";
import * as schema from "../../../db/schema";
import { type User } from "@/types/auth-api.types";

export interface Session {
  user: User;
  expiresAt: Date;
  activeHospitalId?: string;
}

/**
 * Better Auth Server Instance configured for HMS Egypt's multi-tenant PG schema.
 */
export const authInstance = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  // Custom user fields corresponding to our users database table
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
      },
      hospitalId: {
        type: "string",
        required: false,
      },
      departmentId: {
        type: "string",
        required: false,
      },
      isPasswordExpired: {
        type: "boolean",
        required: false,
        defaultValue: false,
      },
      failedLoginAttempts: {
        type: "number",
        required: false,
        defaultValue: 0,
      },
      lockoutUntil: {
        type: "date",
        required: false,
      },
    },
  },
  // Custom session fields corresponding to our sessions database table
  session: {
    additionalFields: {
      activeHospitalId: {
        type: "string",
        required: false,
      },
    },
  },
  plugins: [
    nextCookies(),
  ],
});

/**
 * High-compatibility auth helper that acts as the primary server session retriever.
 * Checks for a real Better Auth session, with seamless fallback to development mock headers/cookies.
 */
export async function auth(): Promise<Session | null> {
  const reqHeaders = await headers();
  
  // 1. Check real Better Auth session
  try {
    const session = await authInstance.api.getSession({
      headers: reqHeaders,
    });
    
    if (session) {
      return {
        user: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          role: session.user.role as string,
          hospitalId: session.user.hospitalId || "system-wide",
          departmentId: session.user.departmentId || undefined,
          isPasswordExpired: session.user.isPasswordExpired ?? false,
        },
        expiresAt: new Date(session.session.expiresAt),
        activeHospitalId: session.session.activeHospitalId || undefined,
      };
    }
  } catch (error) {
    console.error("[AUTH_SESSION_ERROR] Error fetching Better Auth session:", error);
  }

  // 2. Development mock fallbacks (only in development or test modes)
  if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") {
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

    const cookieStore = await cookies();
    const isMockSuperAdmin = cookieStore.get("mock_super_admin")?.value === "true";
    
    if (isMockSuperAdmin) {
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

    const isMockAdmin = process.env.NODE_ENV === "development" && cookieStore.get("mock_tenant_admin")?.value === "true";
    if (isMockAdmin) {
      // Find the actual UUID for 'al-shifa' to prevent 404 UUID mismatch errors
      let mockHospitalId = "al-shifa";
      try {
        const alShifa = await db.query.hospitals.findFirst({
          where: (hospitals, { eq }) => eq(hospitals.slug, "al-shifa"),
        });
        if (alShifa) {
          mockHospitalId = alShifa.id;
        }
      } catch (err) {
        console.error("Failed to resolve al-shifa UUID for mock admin:", err);
      }

      return {
        user: {
          id: "admin-id-1",
          email: "admin@alshifa.com.eg",
          name: "د. أحمد الشافعي",
          role: "ADMIN",
          hospitalId: mockHospitalId,
        },
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      };
    }
  }

  return null;
}
