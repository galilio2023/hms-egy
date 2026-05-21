import { AppError, ErrorCode } from "@/lib/utils/errors";

/**
 * PDF Generation Service using Gotenberg.
 * Gotenberg is a highly scalable, stateless PDF conversion API utilizing Chromium.
 * Standard endpoint: /forms/chromium/convert/html
 */
export async function generatePdfFromHtml(htmlContent: string): Promise<Buffer> {
  const gotenbergUrl = process.env.GOTENBERG_URL || "http://localhost:3001";
  
  try {
    // Construct multipart form data with the raw index.html file
    const formData = new FormData();
    const htmlBlob = new Blob([htmlContent], { type: "text/html" });
    formData.append("files", htmlBlob, "index.html");

    // Configure optional headers (e.g., API keys if running behind a proxy)
    const headers: Record<string, string> = {};
    if (process.env.GOTENBERG_API_KEY) {
      headers["X-Api-Key"] = process.env.GOTENBERG_API_KEY;
    }

    const response = await fetch(`${gotenbergUrl}/forms/chromium/convert/html`, {
      method: "POST",
      body: formData,
      headers: headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new AppError(
        ErrorCode.INTERNAL_ERROR,
        `Gotenberg PDF generation failed: ${response.statusText}. Details: ${errorText}`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    if (error instanceof AppError) throw error;
    
    throw new AppError(
      ErrorCode.INTERNAL_ERROR,
      `Error calling PDF service: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}
