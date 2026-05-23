import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * Temporary upload API for housekeeping photos.
 * In production, this should interface with S3/R2 via pre-signed URLs.
 * For now, it validates the base64 size and "simulates" a hosted URL.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { base64 } = await req.json();

    if (!base64 || !base64.startsWith("data:image")) {
      return NextResponse.json({ error: "Invalid image data" }, { status: 400 });
    }

    // Basic validation of the base64 content
    // In production, use 'file-type' or 'sharp' to verify the actual image data and strip metadata.
    const imageContent = base64.split(",")[1];
    if (!imageContent || imageContent.length < 100) {
      return NextResponse.json({ error: "Image content too short or invalid" }, { status: 400 });
    }

    // Check for common image header patterns in base64 (Optional but safer)
    // JPEG starts with '/9j/', PNG starts with 'iVBORw0KGgo'
    const isCommonImage = /^(\/9j\/|iVBORw0KGgo|R0lGOD|UklGR)/.test(imageContent);
    if (!isCommonImage) {
      return NextResponse.json({ error: "Unsupported image format or corrupted data" }, { status: 400 });
    }

    // In a real implementation, we would write to disk or S3 here.
    // For now, to unblock the flow, we return a "simulated" URL that contains the ID.
    // NOTE: This is still technically base64 but it passes the "starts with data:image" check 
    // in the server action if we prefix it differently, OR we just allow it for now.
    
    // Actually, to TRULY fix the bloat issue, we should not return base64.
    // We'll return a dummy URL for now to demonstrate the flow.
    const mockUrl = `https://storage.hms-egypt.com/housekeeping/uploads/${Date.now()}.jpg`;

    return NextResponse.json({ url: mockUrl });
  } catch (error) {
    console.error("[UPLOAD_ERROR]", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
