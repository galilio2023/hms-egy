/**
 * HMS Egypt - Security Utilities
 * Handles encryption, hashing, and audit log signing.
 */

import crypto from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const AUDIT_HMAC_SECRET = process.env.AUDIT_HMAC_SECRET || "audit-secret-key";

/**
 * Encrypts sensitive data using AES-256-GCM.
 */
export function encryptField(text: string): string {
  if (!ENCRYPTION_KEY || Buffer.from(ENCRYPTION_KEY, "utf-8").length !== 32) {
    throw new Error("ENCRYPTION_KEY must be exactly 32 bytes (256 bits).");
  }
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", Buffer.from(ENCRYPTION_KEY, "utf-8"), iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

/**
 * Decrypts sensitive data.
 */
export function decryptField(data: string): string {
  if (!ENCRYPTION_KEY || Buffer.from(ENCRYPTION_KEY, "utf-8").length !== 32) {
    throw new Error("ENCRYPTION_KEY must be exactly 32 bytes (256 bits).");
  }
  const buffer = Buffer.from(data, "base64");
  const iv = buffer.subarray(0, 16);
  const tag = buffer.subarray(16, 32);
  const encrypted = buffer.subarray(32);
  const decipher = crypto.createDecipheriv("aes-256-gcm", Buffer.from(ENCRYPTION_KEY, "utf-8"), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

/**
 * Signs an audit record using HMAC-SHA256.
 */
export function signAuditRecord(record: any): string {
  const data = JSON.stringify(record);
  return crypto.createHmac("sha256", AUDIT_HMAC_SECRET).update(data).digest("hex");
}

/**
 * Verifies an audit record signature.
 */
export function verifyAuditRecord(record: any, signature: string): boolean {
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
