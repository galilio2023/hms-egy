/**
 * HMS Egypt - Security Utilities
 * Handles encryption, hashing, and audit log signing.
 */

import crypto from "crypto";

const rawKey = process.env.ENCRYPTION_KEY;
if (!rawKey || rawKey.length !== 64) {
  throw new Error(
    "CRITICAL: ENCRYPTION_KEY must be configured as a 64-character hex string (32 bytes) in environment variables."
  );
}

const KEY_BUFFER = Buffer.from(rawKey, "hex");

const AUDIT_HMAC_SECRET = process.env.AUDIT_HMAC_SECRET;
if (!AUDIT_HMAC_SECRET) {
  throw new Error("CRITICAL: AUDIT_HMAC_SECRET must be configured in environment variables.");
}

/**
 * Encrypts sensitive data using AES-256-GCM.
 */
export function encryptField(text: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY_BUFFER, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

/**
 * Decrypts sensitive data.
 */
export function decryptField(data: string): string | null {
  try {
    const buffer = Buffer.from(data, "base64");
    if (buffer.length < 28) return null; // Minimum IV (12) + Tag (16) length

    const iv = buffer.subarray(0, 12);
    const tag = buffer.subarray(12, 28);
    const encrypted = buffer.subarray(28);
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
  return crypto.createHmac("sha256", AUDIT_HMAC_SECRET as string).update(data).digest("hex");
}

/**
 * Verifies an audit record signature.
 */
export function verifyAuditRecord(record: Record<string, unknown>, signature: string): boolean {
  const expectedSignature = signAuditRecord(record);
  
  // Use 'hex' encoding explicitly since HMAC digest is in hex
  const sigBuf = Buffer.from(signature, "hex");
  const expectedBuf = Buffer.from(expectedSignature, "hex");

  if (sigBuf.length !== expectedBuf.length || sigBuf.length === 0) {
    return false;
  }
  
  return crypto.timingSafeEqual(sigBuf, expectedBuf);
}

/**
 * Generates a secure random token.
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString("hex");
}

/**
 * Sanitizes AI input to reduce the risk of structural injection (e.g., HTML/XML tags).
 * WARNING: This is a basic filter. It does NOT prevent semantic prompt injection 
 * (e.g., "Ignore previous instructions"). For production, use LLM-native security 
 * layers (like LLM Guard) and strict output schema enforcement.
 */
export function sanitizeAiInput(input: string): string {
  return input
    .replace(/[<>]/g, "") // Prevent basic tag injection
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}
