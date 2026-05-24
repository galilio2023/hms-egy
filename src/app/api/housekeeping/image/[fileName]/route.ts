import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import fs from "fs";
import path from "path";

/**
 * Authenticated Image Proxy for Housekeeping Photos.
 * Ensures clinical photos (PHI) are not publicly accessible.
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
  if (!fileName || !/^[a-zA-Z0-9-]+\.(jpg|png|webp)$/.test(fileName)) {
    return new NextResponse("Invalid filename", { status: 400 });
  }

  try {
    const filePath = path.join(process.cwd(), "storage", "housekeeping", fileName);

    if (!fs.existsSync(filePath)) {
      return new NextResponse("Image not found", { status: 404 });
    }

    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(fileName).toLowerCase();
    const contentType = ext === ".jpg" ? "image/jpeg" : ext === ".png" ? "image/png" : "image/webp";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[IMAGE_PROXY_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
