import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { inspectCredentialRotation, rotateStoredCredentials } from "@/lib/credential-rotation";
import { db } from "@/lib/db";
import { currentEncryptionKeyId, decryptCredential, encryptCredential } from "@/lib/security";

const oldKey = Buffer.from("old-key-0123456789abcdef01234567").toString("base64");
const newKey = Buffer.from("new-key-0123456789abcdef01234567").toString("base64");

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await db.$disconnect();
});

describe("integration credential rotation", () => {
  it("decrypts a prior key, re-encrypts with the current key, and records sanitized evidence", async () => {
    const suffix = randomUUID();
    vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", oldKey);
    vi.stubEnv("INTEGRATION_ENCRYPTION_KEY_ID", "legacy-test");
    vi.stubEnv("INTEGRATION_ENCRYPTION_PREVIOUS_KEYS", "{}");
    const organization = await db.organization.create({ data: { name: "Credential Rotation Test", slug: `credential-rotation-${suffix}` } });
    const connection = await db.integrationConnection.create({
      data: {
        organizationId: organization.id,
        provider: "APOLLO",
        state: "CONNECTED",
        encryptedCredential: encryptCredential("rotation-test-secret"),
        credentialKeyId: currentEncryptionKeyId(),
      },
    });

    try {
      vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", newKey);
      vi.stubEnv("INTEGRATION_ENCRYPTION_KEY_ID", "current-test");
      vi.stubEnv("INTEGRATION_ENCRYPTION_PREVIOUS_KEYS", JSON.stringify({ "legacy-test": oldKey }));

      await expect(inspectCredentialRotation({ organizationId: organization.id })).resolves.toEqual({ total: 1, alreadyCurrent: 0, needsRotation: 1 });
      await expect(rotateStoredCredentials({ organizationId: organization.id })).resolves.toEqual({ total: 1, rotated: 1, alreadyCurrent: 0, changedConcurrently: 0 });

      const stored = await db.integrationConnection.findUniqueOrThrow({ where: { id: connection.id } });
      expect(stored.credentialKeyId).toBe("current-test");
      expect(stored.encryptedCredential).not.toBe(connection.encryptedCredential);
      expect(decryptCredential(stored.encryptedCredential!, stored.credentialKeyId!)).toBe("rotation-test-secret");
      await expect(db.auditLog.findFirstOrThrow({ where: { organizationId: organization.id, action: "INTEGRATION_CREDENTIAL_REENCRYPTED" } })).resolves.toMatchObject({
        actorUserId: null,
        targetType: "IntegrationConnection",
        targetId: connection.id,
        metadata: { provider: "APOLLO", fromKeyId: "legacy-test", toKeyId: "current-test" },
      });
    } finally {
      await db.organization.delete({ where: { id: organization.id } });
    }
  });
});
