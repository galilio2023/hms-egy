import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUploadPresignedUrl } from "@/lib/storage";
import { uploadLimiter } from "@/lib/utils/ratelimit";

/**
 * API to generate pre-signed URLs for high-performance direct cloud uploads.
 * Bypasses serverless payload limits and reduces server overhead.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 0. Rate Limiting (DoS Mitigation)
  if (uploadLimiter) {
    const ip = req.headers.get("x-forwarded-for") || "anonymous";
    const { success } = await uploadLimiter.limit(ip);
    if (!success) {
      return NextResponse.json({ error: "Too many upload requests." }, { status: 429 });
    }
  }

  // Role-Based Authorization
  const ALLOWED_UPLOAD_ROLES = ["SUPER_ADMIN", "ADMIN", "HOUSEKEEPING", "NURSE", "OR_NURSE"];
  if (!ALLOWED_UPLOAD_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { contentType, extension } = await req.json();

    if (!contentType || !contentType.startsWith("image/")) {
      return NextResponse.json({ error: "Invalid content type" }, { status: 400 });
    }

    const fileId = crypto.randomUUID();
    const fileName = `hk-${fileId}.${extension || 'jpg'}`;

    const { uploadUrl, publicUrl, isLocal } = await getUploadPresignedUrl(
      fileName,
      contentType,
      "housekeeping"
    );

    return NextResponse.json({ 
      uploadUrl, 
      publicUrl, 
      isLocal,
      fileName
    });
  } catch (error) {
    console.error("[PRESIGN_ERROR]", error);
    return NextResponse.json({ error: "Failed to generate upload URL" }, { status: 500 });
  }
}
