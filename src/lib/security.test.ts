import { beforeAll, describe, expect, it } from "vitest";
import { decryptCredential, encryptCredential, redact } from "./security";

beforeAll(() => { process.env.INTEGRATION_ENCRYPTION_KEY = Buffer.from("0123456789abcdef0123456789abcdef").toString("base64"); });
describe("credential security", () => {
  it("round trips without embedding plaintext", () => { const encrypted=encryptCredential("apollo-secret-key"); expect(encrypted).not.toContain("apollo-secret-key"); expect(decryptCredential(encrypted)).toBe("apollo-secret-key"); });
  it("redacts nested sensitive fields", () => expect(redact({ apiKey:"secret", nested:{ password:"hidden" }, safe:"ok" })).toEqual({ apiKey:"[REDACTED]", nested:{password:"[REDACTED]"}, safe:"ok" }));
});
