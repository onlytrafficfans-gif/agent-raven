import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { currentEncryptionKeyId, decryptCredential, encryptCredential } from "@/lib/security";

type RotationScope = { organizationId?: string };

function storedKeyId(keyId: string | null): string {
  return keyId ?? "v1";
}

async function credentialRows(scope: RotationScope) {
  return db.integrationConnection.findMany({
    where: {
      organizationId: scope.organizationId,
      encryptedCredential: { not: null },
    },
    select: {
      id: true,
      organizationId: true,
      provider: true,
      encryptedCredential: true,
      credentialKeyId: true,
    },
    orderBy: { id: "asc" },
  });
}

export async function inspectCredentialRotation(scope: RotationScope = {}) {
  const currentKeyId = currentEncryptionKeyId();
  const rows = await credentialRows(scope);
  let alreadyCurrent = 0;
  for (const row of rows) {
    decryptCredential(row.encryptedCredential!, storedKeyId(row.credentialKeyId));
    if (storedKeyId(row.credentialKeyId) === currentKeyId) alreadyCurrent += 1;
  }
  return { total: rows.length, alreadyCurrent, needsRotation: rows.length - alreadyCurrent };
}

export async function rotateStoredCredentials(scope: RotationScope = {}) {
  const currentKeyId = currentEncryptionKeyId();
  const rows = await credentialRows(scope);
  let rotated = 0;
  let alreadyCurrent = 0;
  let changedConcurrently = 0;

  for (const row of rows) {
    const fromKeyId = storedKeyId(row.credentialKeyId);
    const plaintext = decryptCredential(row.encryptedCredential!, fromKeyId);
    if (fromKeyId === currentKeyId) {
      alreadyCurrent += 1;
      continue;
    }
    const encryptedCredential = encryptCredential(plaintext);
    const correlationId = `credential-rotation-${randomUUID()}`;
    const updated = await db.$transaction(async (tx) => {
      const result = await tx.integrationConnection.updateMany({
        where: { id: row.id, encryptedCredential: row.encryptedCredential, credentialKeyId: row.credentialKeyId },
        data: { encryptedCredential, credentialKeyId: currentKeyId },
      });
      if (result.count !== 1) return false;
      await tx.auditLog.create({
        data: {
          organizationId: row.organizationId,
          action: "INTEGRATION_CREDENTIAL_REENCRYPTED",
          targetType: "IntegrationConnection",
          targetId: row.id,
          correlationId,
          metadata: { provider: row.provider, fromKeyId, toKeyId: currentKeyId },
        },
      });
      return true;
    });
    if (updated) rotated += 1;
    else changedConcurrently += 1;
  }

  return { total: rows.length, rotated, alreadyCurrent, changedConcurrently };
}
