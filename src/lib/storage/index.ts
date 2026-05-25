import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "fs";
import path from "path";

/**
 * HMS Egypt - Storage Engine
 * 
 * Provides a unified interface for local (Dev) and S3-compatible (Prod/Cloud) storage.
 * Designed for R2, S3, or any S3-compliant provider.
 */

const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER; // 's3', 'r2', or 'local'
const BUCKET_NAME = process.env.S3_BUCKET_NAME;
const REGION = process.env.S3_REGION || "auto";

const s3Client = (STORAGE_PROVIDER === "s3" || STORAGE_PROVIDER === "r2")
  ? new S3Client({
      region: REGION,
      endpoint: process.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
    })
  : null;

/**
 * Generates a pre-signed URL for direct browser-to-cloud upload.
 * Bypasses Next.js server payload limits (e.g. Vercel 4.5MB).
 */
export async function getUploadPresignedUrl(
  fileName: string,
  contentType: string,
  folder: string = "general"
): Promise<{ uploadUrl: string; publicUrl: string; isLocal: boolean }> {
  if (s3Client && BUCKET_NAME) {
    const key = `${folder}/${fileName}`;
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 600 }); // 10 minutes
    return {
      uploadUrl,
      publicUrl: `/api/housekeeping/image/${fileName}`, // Still proxied for BOLA
      isLocal: false,
    };
  }

  // Local fallback: Return the API endpoint for standard multipart upload
  return {
    uploadUrl: `/api/housekeeping/upload`, 
    publicUrl: `/api/housekeeping/image/${fileName}`,
    isLocal: true,
  };
}

export interface UploadResult {
  fileName: string;
  publicUrl: string;
}

/**
 * Uploads a file (buffer) to the configured storage provider.
 */
export async function uploadFile(
  buffer: Buffer,
  fileName: string,
  folder: string = "general"
): Promise<UploadResult> {
  if (s3Client && BUCKET_NAME) {
    const key = `${folder}/${fileName}`;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: getContentType(fileName),
      })
    );

    return {
      fileName,
      publicUrl: `/api/housekeeping/image/${fileName}`, // Still proxied for BOLA protection
    };
  }

  // Local Fallback (Development)
  const storageDir = path.join(process.cwd(), "storage", folder);
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }

  const filePath = path.join(storageDir, fileName);
  fs.writeFileSync(filePath, buffer);

  return {
    fileName,
    publicUrl: `/api/housekeeping/image/${fileName}`,
  };
}

/**
 * Retrieves a file from the configured storage provider.
 */
export async function getFile(fileName: string, folder: string = "general"): Promise<Buffer> {
  if (s3Client && BUCKET_NAME) {
    const key = `${folder}/${fileName}`;
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })
    );

    if (!response.Body) {
      throw new Error("File body is empty");
    }

    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
  }

  // Local Fallback
  const filePath = path.join(process.cwd(), "storage", folder, fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error("File not found on local storage");
  }

  return fs.readFileSync(filePath);
}

function getContentType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}
