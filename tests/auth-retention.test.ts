import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { cleanupExpiredAuthData, inspectExpiredAuthData } from "@/lib/auth-retention";
import { db } from "@/lib/db";

afterAll(async () => {
  await db.$disconnect();
});

describe("authentication retention", () => {
  it("deletes expired records in scope without touching active sessions or verifications", async () => {
    const suffix = randomUUID();
    const now = new Date("2026-11-05T14:00:00.000Z");
    const expiredIdentifier = `e2e-retention-expired-${suffix}`;
    const activeIdentifier = `e2e-retention-active-${suffix}`;
    const user = await db.user.create({
      data: { name: "Retention Test", email: `e2e-retention-${suffix}@example.com`, emailVerified: true },
    });

    try {
      await db.session.createMany({ data: [
        { id: randomUUID(), token: `expired-${suffix}`, userId: user.id, expiresAt: new Date(now.getTime() - 1_000) },
        { id: randomUUID(), token: `active-${suffix}`, userId: user.id, expiresAt: new Date(now.getTime() + 60_000) },
      ] });
      await db.verification.createMany({ data: [
        { id: randomUUID(), identifier: expiredIdentifier, value: user.id, expiresAt: new Date(now.getTime() - 1_000) },
        { id: randomUUID(), identifier: activeIdentifier, value: user.id, expiresAt: new Date(now.getTime() + 60_000) },
      ] });
      const scope = { userIds: [user.id], verificationIdentifiers: [expiredIdentifier, activeIdentifier] };

      await expect(inspectExpiredAuthData(now, scope)).resolves.toEqual({ expiredSessions: 1, expiredVerifications: 1 });
      await expect(cleanupExpiredAuthData(now, scope)).resolves.toEqual({ expiredSessions: 1, expiredVerifications: 1 });
      await expect(inspectExpiredAuthData(now, scope)).resolves.toEqual({ expiredSessions: 0, expiredVerifications: 0 });
      await expect(db.session.count({ where: { userId: user.id } })).resolves.toBe(1);
      await expect(db.verification.count({ where: { identifier: activeIdentifier } })).resolves.toBe(1);
    } finally {
      await db.verification.deleteMany({ where: { identifier: { in: [expiredIdentifier, activeIdentifier] } } });
      await db.user.delete({ where: { id: user.id } });
    }
  });
});
