/**
 * HMS Egypt - Security Utilities
 * Handles encryption, hashing, and audit log signing.
 */

import crypto from "crypto";

const KEY_BUFFER = process.env.ENCRYPTION_KEY?.length === 64 
  ? Buffer.from(process.env.ENCRYPTION_KEY, "hex")
  : Buffer.from(process.env.ENCRYPTION_KEY || "", "utf-8");

const AUDIT_HMAC_SECRET = process.env.AUDIT_HMAC_SECRET || "audit-secret-key";

/**
 * Encrypts sensitive data using AES-256-GCM.
 */
export function encryptField(text: string): string {
  if (KEY_BUFFER.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be exactly 32 bytes (256 bits). Check your environment variables.");
  }
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY_BUFFER, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

/**
 * Decrypts sensitive data.
 */
export function decryptField(data: string): string | null {
  if (KEY_BUFFER.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be exactly 32 bytes (256 bits). Check your environment variables.");
  }
  try {
    const buffer = Buffer.from(data, "base64");
    if (buffer.length < 32) return null; // Minimum IV + Tag length

    const iv = buffer.subarray(0, 16);
    const tag = buffer.subarray(16, 32);
    const encrypted = buffer.subarray(32);
    const decipher = crypto.createDecipheriv("aes-256-gcm", KEY_BUFFER, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  } catch (error) {
    console.error("Decryption failed: Integrity check failed or invalid data", error);
    return null;
  }
}

/**
 * Signs an audit record using HMAC-SHA256.
 */
export function signAuditRecord(record: Record<string, unknown>): string {
  const data = JSON.stringify(record);
  return crypto.createHmac("sha256", AUDIT_HMAC_SECRET).update(data).digest("hex");
}

/**
 * Verifies an audit record signature.
 */
export function verifyAuditRecord(record: Record<string, unknown>, signature: string): boolean {
  const expectedSignature = signAuditRecord(record);
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);

  if (sigBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expectedBuf);
}

/**
 * Generates a secure random token.
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString("hex");
}

/**
 * Sanitizes AI input to prevent prompt injection.
 */
export function sanitizeAiInput(input: string): string {
  // Basic sanitization, can be expanded.
  return input.replace(/[<>]/g, "").trim();
}
