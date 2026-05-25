import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadFile } from "@/lib/storage";
import { uploadLimiter } from "@/lib/utils/ratelimit";

/**
 * Temporary upload API for housekeeping photos.
 * 
 * ⚠️ PRODUCTION ALERT:
 * This implementation uses local filesystem writes which are ephemeral in serverless
 * environments (Vercel/Neon) and present a DoS risk. 
 * TODO: Replace with Cloudflare R2 or AWS S3 pre-signed URLs before production.
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
      return NextResponse.json({ error: "Too many upload requests. Please try again later." }, { status: 429 });
    }
  }

  // Role-Based Authorization Check
  const ALLOWED_UPLOAD_ROLES = ["SUPER_ADMIN", "ADMIN", "HOUSEKEEPING", "NURSE", "OR_NURSE"];
  if (!ALLOWED_UPLOAD_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden: Insufficient permissions to upload photos." }, { status: 403 });
  }

  try {
    // 1. Restrict body payload size (e.g. 5MB) using content-length header
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Payload too large (Max 5MB)" }, { status: 413 });
    }

    const { base64 } = await req.json();

    if (!base64 || !base64.startsWith("data:image")) {
      return NextResponse.json({ error: "Invalid image data" }, { status: 400 });
    }

    // 2. Magic Bytes Validation (Verification of actual file signatures)
    const imageContent = base64.split(",")[1];
    if (!imageContent || imageContent.length < 100) {
      return NextResponse.json({ error: "Image content too short or invalid" }, { status: 400 });
    }

    const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];
    // Extract format from data URL (e.g., data:image/jpeg;base64,...)
    const formatMatch = base64.match(/^data:image\/([a-zA-Z+]+);base64,/);
    const format = formatMatch ? formatMatch[1].toLowerCase() : "";
    const extension = format === "jpeg" ? "jpg" : format;

    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      return NextResponse.json({ error: "Security Error: Prohibited file extension detected" }, { status: 400 });
    }

    // Convert base64 to buffer for byte-level inspection
    const buffer = Buffer.from(imageContent, "base64");
    
    // Check for real image headers (Magic Bytes)
    const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
    const isWebp = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 && // "RIFF"
                   buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;  // "WEBP"

    if (!isJpeg && !isPng && !isWebp) {
      return NextResponse.json({ error: "Security Error: Unsupported or malicious file type detected" }, { status: 400 });
    }

    // 3. STORAGE STRATEGY (Security & Persistence Hardening)
    const isProduction = process.env.NODE_ENV === "production";
    const useCloudStorage = process.env.STORAGE_PROVIDER === "r2" || process.env.STORAGE_PROVIDER === "s3";

    if (isProduction && !useCloudStorage) {
      // Critical Safety: Prevent data loss in production due to ephemeral serverless filesystems
      console.error("[CRITICAL] Production upload attempted without cloud storage (R2/S3) configured.");
      return NextResponse.json({ error: "Server Configuration Error: Persistent storage not available." }, { status: 500 });
    }

    const fileId = crypto.randomUUID();
    const fileName = `hk-${fileId}.${isJpeg ? "jpg" : isPng ? "png" : "webp"}`;

    // 4. PERSISTENT STORAGE (S3/R2 with Local Fallback)
    const { publicUrl } = await uploadFile(buffer, fileName, "housekeeping");

    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    console.error("[UPLOAD_ERROR]", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
