import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
export { redact } from "@/lib/redaction";

const keyIdPattern = /^[A-Za-z0-9._-]{1,64}$/;

function decodeEncryptionKey(raw: string | undefined, label: string): Buffer {
  if (!raw) throw new Error(`${label} is not configured`);
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32 || key.toString("base64") !== raw) throw new Error(`${label} must be canonical base64 encoding exactly 32 bytes`);
  return key;
}

export function currentEncryptionKeyId(): string {
  const keyId = process.env.INTEGRATION_ENCRYPTION_KEY_ID?.trim() || "v1";
  if (!keyIdPattern.test(keyId)) throw new Error("INTEGRATION_ENCRYPTION_KEY_ID is invalid");
  return keyId;
}

function previousEncryptionKeys(): Record<string, string> {
  const raw = process.env.INTEGRATION_ENCRYPTION_PREVIOUS_KEYS?.trim();
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("INTEGRATION_ENCRYPTION_PREVIOUS_KEYS must be a JSON object");
  }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error("INTEGRATION_ENCRYPTION_PREVIOUS_KEYS must be a JSON object");
  return parsed as Record<string, string>;
}

function encryptionKey(keyId = currentEncryptionKeyId()): Buffer {
  if (!keyIdPattern.test(keyId)) throw new Error("Credential key ID is invalid");
  if (keyId === currentEncryptionKeyId()) return decodeEncryptionKey(process.env.INTEGRATION_ENCRYPTION_KEY, "INTEGRATION_ENCRYPTION_KEY");
  const previous = previousEncryptionKeys()[keyId];
  if (typeof previous !== "string") throw new Error("Credential encryption key is unavailable");
  return decodeEncryptionKey(previous, "Previous integration encryption key");
}

export function encryptCredential(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptCredential(payload: string, keyId?: string): string {
  const [version, iv, tag, ciphertext] = payload.split(".");
  if (version !== "v1" || !iv || !tag || !ciphertext) throw new Error("Unsupported encrypted credential format");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(keyId), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}
