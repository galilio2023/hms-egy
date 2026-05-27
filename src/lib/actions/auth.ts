"use server";

import { db, withBypassContext } from "@/lib/db";
import { users } from "@db/schema/auth";
import { eq } from "drizzle-orm";
import { authInstance } from "@/lib/auth";

/**
 * Server action to securely authenticate users.
 * Enforces a 5-failed-attempts account lockout mechanism for high-security clinical settings.
 */
export async function loginAction(
  prevState: unknown,
  formData: FormData
): Promise<{ success: boolean; error?: string; redirectTo?: string }> {
  const startTime = Date.now();
  const email = formData.get("email")?.toString().trim().toLowerCase();
  const password = formData.get("password")?.toString();

  if (!email || !password) {
    return { success: false, error: "يرجى إدخال البريد الإلكتروني وكلمة المرور." };
  }

  try {
    // 1. Check for account lockout before calling Better Auth
    const user = await withBypassContext(async (tx) => {
      return await tx.query.users.findFirst({
        where: eq(users.email, email),
      });
    });

    if (user) {
      if (user.lockoutUntil && new Date(user.lockoutUntil) > new Date()) {
        const diffMs = new Date(user.lockoutUntil).getTime() - Date.now();
        const minutes = Math.ceil(diffMs / 60000);
        return {
          success: false,
          error: `حسابك مغلق مؤقتاً بسبب محاولات دخول فاشلة متكررة. يرجى المحاولة بعد ${minutes} دقيقة.`,
        };
      }
    }

    // 2. Perform authenticating via Better Auth server API
    try {
      const result = await authInstance.api.signInEmail({
        body: {
          email,
          password,
        },
      });

      if (!result || !result.user) {
        throw new Error("Invalid credentials");
      }

      // 3. Reset failed attempts counter on success
      await withBypassContext(async (tx) => {
        await tx
          .update(users)
          .set({
            failedLoginAttempts: 0,
            lockoutUntil: null,
            updatedAt: new Date(),
          })
          .where(eq(users.email, email));
      });

      // 4. Handle forced password change check
      if (result.user.isPasswordExpired) {
        return { success: true, redirectTo: "/change-password" };
      }

      return { success: true, redirectTo: "/" };

    } catch (authError) {
      // 5. Track failed login attempt on credentials exception
      let errorMessage = "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
      
      if (user) {
        const attempts = user.failedLoginAttempts + 1;
        let lockoutUntil: Date | null = null;
        
        if (attempts >= 5) {
          lockoutUntil = new Date(Date.now() + 15 * 60 * 1000); // 15-minute lock
          errorMessage = "تم إغلاق حسابك لمدة ١٥ دقيقة بسبب تجاوز الحد الأقصى لمحاولات تسجيل الدخول الخاطئة.";
        } else {
          errorMessage = `بيانات الدخول غير صحيحة. المحاولات المتبقية قبل إغلاق الحساب: ${5 - attempts}`;
        }

        await withBypassContext(async (tx) => {
          await tx
            .update(users)
            .set({
              failedLoginAttempts: attempts,
              lockoutUntil,
              updatedAt: new Date(),
            })
            .where(eq(users.email, email));
        });
      }

      // Prevent user enumeration and timing attacks by padding the execution to a uniform target window
      const targetDuration = 600 + Math.floor(Math.random() * 150); // 600ms - 750ms target
      const elapsed = Date.now() - startTime;
      if (elapsed < targetDuration) {
        await new Promise((resolve) => setTimeout(resolve, targetDuration - elapsed));
      }

      return { success: false, error: errorMessage };
    }

  } catch (err) {
    console.error("[LOGIN_ACTION_ERROR]", err);
    return { success: false, error: "حدث خطأ غير متوقع أثناء تسجيل الدخول. يرجى المحاولة لاحقاً." };
  }
}

/**
 * Server action to let authenticated users unlock their clinical screen.
 */
export async function unlockWorkstationAction(password: string): Promise<{ success: boolean; error?: string }> {
  const reqHeaders = await headersHelper();
  
  try {
    const session = await authInstance.api.getSession({
      headers: reqHeaders,
    });

    if (!session || !session.user) {
      return { success: false, error: "لم يتم العثور على جلسة عمل نشطة." };
    }

    const email = session.user.email;

    // 1. Check for account lockout before calling Better Auth
    const user = await withBypassContext(async (tx) => {
      return await tx.query.users.findFirst({
        where: eq(users.email, email),
      });
    });

    if (user) {
      if (user.lockoutUntil && new Date(user.lockoutUntil) > new Date()) {
        const diffMs = new Date(user.lockoutUntil).getTime() - Date.now();
        const minutes = Math.ceil(diffMs / 60000);
        return {
          success: false,
          error: `حسابك مغلق مؤقتاً بسبب محاولات دخول فاشلة متكررة. يرجى المحاولة بعد ${minutes} دقيقة.`,
        };
      }
    }

    // 2. Validate password by attempting a verify call
    try {
      const result = await authInstance.api.signInEmail({
        body: {
          email,
          password,
        },
      });

      if (result && result.user) {
        // Reset failed attempts counter on success
        await withBypassContext(async (tx) => {
          await tx
            .update(users)
            .set({
              failedLoginAttempts: 0,
              lockoutUntil: null,
              updatedAt: new Date(),
            })
            .where(eq(users.id, user!.id));
        });

        return { success: true };
      }

      throw new Error("Invalid password");
    } catch {
      // 3. Track failed attempts on screen unlock failure
      let errorMessage = "كلمة المرور غير صحيحة.";
      
      if (user) {
        const attempts = user.failedLoginAttempts + 1;
        let lockoutUntil: Date | null = null;
        
        if (attempts >= 5) {
          lockoutUntil = new Date(Date.now() + 15 * 60 * 1000); // 15-minute lock
          errorMessage = "تم إغلاق حسابك لمدة ١٥ دقيقة بسبب تجاوز الحد الأقصى لمحاولات تسجيل الدخول الخاطئة.";
        } else {
          errorMessage = `كلمة المرور غير صحيحة. المحاولات المتبقية قبل إغلاق الحساب: ${5 - attempts}`;
        }

        await withBypassContext(async (tx) => {
          await tx
            .update(users)
            .set({
              failedLoginAttempts: attempts,
              lockoutUntil,
              updatedAt: new Date(),
            })
            .where(eq(users.id, user.id));
        });
      }

      return { success: false, error: errorMessage };
    }
  } catch (error) {
    console.error("[UNLOCK_ACTION_ERROR]", error);
    return { success: false, error: "حدث خطأ غير متوقع أثناء إلغاء قفل الشاشة." };
  }
}

/**
 * Server action to handle initial or forced administrative password updates.
 */
export async function changePasswordAction(oldPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  const reqHeaders = await headersHelper();
  try {
    const session = await authInstance.api.getSession({
      headers: reqHeaders,
    });
    
    if (!session || !session.user) {
      return { success: false, error: "لم يتم العثور على جلسة عمل نشطة." };
    }

    // Call Better Auth to update credentials
    await authInstance.api.changePassword({
      headers: reqHeaders,
      body: {
        currentPassword: oldPassword,
        newPassword: newPassword,
      },
    });

    // Reset password-expired flag on users table inside bypass RLS context
    await withBypassContext(async (tx) => {
      await tx
        .update(users)
        .set({
          isPasswordExpired: false,
          updatedAt: new Date(),
        })
        .where(eq(users.id, session.user.id));
    });

    return { success: true };
  } catch (error) {
    console.error("[CHANGE_PASSWORD_ERROR]", error);
    const message = error instanceof Error ? error.message : String(error);
    return { 
      success: false, 
      error: "فشل تحديث كلمة المرور. يرجى التحقق من صحة كلمة المرور الحالية والمحاولة مجدداً: " + message
    };
  }
}

// Private helper to fetch headers asynchronously in server action scope
async function headersHelper() {
  const { headers } = await import("next/headers");
  return await headers();
}
