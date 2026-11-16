import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { currentEncryptionKeyId, decryptCredential, encryptCredential, redact } from "./security";

beforeAll(() => { process.env.INTEGRATION_ENCRYPTION_KEY = Buffer.from("0123456789abcdef0123456789abcdef").toString("base64"); });
afterEach(() => vi.unstubAllEnvs());
describe("credential security", () => {
  it("round trips without embedding plaintext", () => { const encrypted=encryptCredential("apollo-secret-key"); expect(encrypted).not.toContain("apollo-secret-key"); expect(decryptCredential(encrypted)).toBe("apollo-secret-key"); });
  it("reads a prior key during a controlled rotation", () => {
    const oldKey = Buffer.from("old-key-0123456789abcdef01234567").toString("base64");
    const newKey = Buffer.from("new-key-0123456789abcdef01234567").toString("base64");
    vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", oldKey);
    vi.stubEnv("INTEGRATION_ENCRYPTION_KEY_ID", "legacy-test");
    const encrypted = encryptCredential("rotating-secret");
    vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", newKey);
    vi.stubEnv("INTEGRATION_ENCRYPTION_KEY_ID", "current-test");
    vi.stubEnv("INTEGRATION_ENCRYPTION_PREVIOUS_KEYS", JSON.stringify({ "legacy-test": oldKey }));
    expect(currentEncryptionKeyId()).toBe("current-test");
    expect(decryptCredential(encrypted, "legacy-test")).toBe("rotating-secret");
  });
  it("redacts nested sensitive fields", () => expect(redact({ apiKey:"secret", nested:{ password:"hidden" }, safe:"ok" })).toEqual({ apiKey:"[REDACTED]", nested:{password:"[REDACTED]"}, safe:"ok" }));
});
