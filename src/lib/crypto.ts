import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY || process.env.AUTH_SECRET;
  if (!raw) throw new Error("ENCRYPTION_KEY or AUTH_SECRET must be set");
  // Derive a 32-byte key from the secret (SHA-256 hash)
  return Buffer.from(
    require("crypto").createHash("sha256").update(raw).digest()
  );
}

/** Encrypt a plaintext string. Returns a hex-encoded string (iv:tag:ciphertext). */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

/** Decrypt a previously encrypted string. */
export function decrypt(encoded: string): string {
  const key = getEncryptionKey();
  const [ivHex, tagHex, dataHex] = encoded.split(":");
  if (!ivHex || !tagHex || !dataHex) throw new Error("Invalid encrypted format");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const data = Buffer.from(dataHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

/** Mask an API key for display (show first 8 and last 4 chars). */
export function maskKey(key: string): string {
  if (key.length <= 12) return "••••••••";
  return key.slice(0, 8) + "••••" + key.slice(-4);
}
