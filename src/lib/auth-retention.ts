import { db } from "@/lib/db";

type RetentionScope = {
  userIds?: string[];
  verificationIdentifiers?: string[];
};

export type AuthRetentionCounts = {
  expiredSessions: number;
  expiredVerifications: number;
};

function sessionWhere(now: Date, scope?: RetentionScope) {
  return {
    expiresAt: { lte: now },
    ...(scope?.userIds ? { userId: { in: scope.userIds } } : {}),
  };
}

function verificationWhere(now: Date, scope?: RetentionScope) {
  return {
    expiresAt: { lte: now },
    ...(scope?.verificationIdentifiers ? { identifier: { in: scope.verificationIdentifiers } } : {}),
  };
}

export async function inspectExpiredAuthData(now = new Date(), scope?: RetentionScope): Promise<AuthRetentionCounts> {
  const [expiredSessions, expiredVerifications] = await Promise.all([
    db.session.count({ where: sessionWhere(now, scope) }),
    db.verification.count({ where: verificationWhere(now, scope) }),
  ]);
  return { expiredSessions, expiredVerifications };
}

export async function cleanupExpiredAuthData(now = new Date(), scope?: RetentionScope): Promise<AuthRetentionCounts> {
  const [sessions, verifications] = await db.$transaction([
    db.session.deleteMany({ where: sessionWhere(now, scope) }),
    db.verification.deleteMany({ where: verificationWhere(now, scope) }),
  ]);
  return { expiredSessions: sessions.count, expiredVerifications: verifications.count };
}
