import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import fs from "fs";
import path from "path";

/**
 * Temporary upload API for housekeeping photos.
 * In production, this should interface with S3/R2 via pre-signed URLs.
 * For now, it validates the base64 size, verifies magic bytes, and 
 * saves to local disk as a fallback to prevent silent data loss.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    // Convert base64 to buffer for byte-level inspection
    const buffer = Buffer.from(imageContent, "base64");
    
    // Check for real image headers (Magic Bytes)
    const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
    const isWebp = buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;

    if (!isJpeg && !isPng && !isWebp) {
      return NextResponse.json({ error: "Security Error: Unsupported or malicious file type detected" }, { status: 400 });
    }

    // 3. DEVELOPMENT FALLBACK: Save to local public/uploads directory
    // This ensures that even without S3, the files exist on disk for audit/review.
    const fileName = `hk-${Date.now()}.${isJpeg ? "jpg" : isPng ? "png" : "webp"}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "housekeeping");
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, buffer);

    // Return the accessible public URL
    const publicUrl = `/uploads/housekeeping/${fileName}`;

    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    console.error("[UPLOAD_ERROR]", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
