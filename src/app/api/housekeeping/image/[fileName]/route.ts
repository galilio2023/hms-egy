import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import path from "path";
import { housekeepingTasks } from "@db/schema/housekeeping";
import { eq, and } from "drizzle-orm";
import { withTenantContext } from "@/lib/db/tenant";
import { getFile } from "@/lib/storage";

/**
 * Authenticated Image Proxy for Housekeeping Photos.
 * Ensures clinical photos (PHI) are not publicly accessible.
 * Implements BOLA protection to verify tenant ownership.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fileName: string }> }
) {
  const session = await auth();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { fileName } = await params;

  // 1. Basic filename validation to prevent directory traversal
  if (!fileName || !/^[a-zA-Z0-9-]+\.(jpg|png|webp|jpeg)$/.test(fileName)) {
    return new NextResponse("Invalid filename", { status: 400 });
  }

  // 2. BOLA Protection: Verify tenant ownership of the clinical image
  const isSuperAdmin = session.user.role === "SUPER_ADMIN";
  const hospitalId = session.activeHospitalId || session.user.hospitalId;

  if (!isSuperAdmin) {
    if (!hospitalId || hospitalId === "system-wide") {
      return new NextResponse("Forbidden: Missing hospital context", { status: 403 });
    }

    try {
      const publicUrl = `/api/housekeeping/image/${fileName}`;
      const hasAccess = await withTenantContext(hospitalId, async (tx) => {
        const [task] = await tx
          .select({ id: housekeepingTasks.id })
          .from(housekeepingTasks)
          .where(and(
            eq(housekeepingTasks.completionPhotoUrl, publicUrl),
            eq(housekeepingTasks.hospitalId, hospitalId)
          ))
          .limit(1);
        return !!task;
      });

      if (!hasAccess) {
        return new NextResponse("Forbidden: Access to this resource is restricted to its owner hospital", { status: 403 });
      }
    } catch (dbError) {
      console.error("[IMAGE_BOLA_CHECK_ERROR]", dbError);
      return new NextResponse("Internal Server Error", { status: 500 });
    }
  }

  try {
    // 3. Retrieve image from configured storage provider (Local or S3/R2)
    const buffer = await getFile(fileName, "housekeeping");
    const ext = path.extname(fileName).toLowerCase();
    const contentType = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : ext === ".png" ? "image/png" : "image/webp";

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[IMAGE_PROXY_ERROR]", error);
    if (error instanceof Error && error.message.includes("not found")) {
      return new NextResponse("Image not found", { status: 404 });
    }
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
