import { db } from "@/lib/db";

type RetentionScope = {
  userIds?: string[];
  verificationIdentifiers?: string[];
  rateLimitKeys?: string[];
};

export type AuthRetentionCounts = {
  expiredSessions: number;
  expiredVerifications: number;
  expiredRateLimits: number;
};

export const authRateLimitRetentionMs = 24 * 60 * 60 * 1_000;

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

function rateLimitWhere(now: Date, scope?: RetentionScope) {
  return {
    lastRequest: { lte: BigInt(now.getTime() - authRateLimitRetentionMs) },
    ...(scope?.rateLimitKeys ? { key: { in: scope.rateLimitKeys } } : {}),
  };
}

export async function inspectExpiredAuthData(now = new Date(), scope?: RetentionScope): Promise<AuthRetentionCounts> {
  const [expiredSessions, expiredVerifications, expiredRateLimits] = await Promise.all([
    db.session.count({ where: sessionWhere(now, scope) }),
    db.verification.count({ where: verificationWhere(now, scope) }),
    db.rateLimit.count({ where: rateLimitWhere(now, scope) }),
  ]);
  return { expiredSessions, expiredVerifications, expiredRateLimits };
}

export async function cleanupExpiredAuthData(now = new Date(), scope?: RetentionScope): Promise<AuthRetentionCounts> {
  const [sessions, verifications, rateLimits] = await db.$transaction([
    db.session.deleteMany({ where: sessionWhere(now, scope) }),
    db.verification.deleteMany({ where: verificationWhere(now, scope) }),
    db.rateLimit.deleteMany({ where: rateLimitWhere(now, scope) }),
  ]);
  return { expiredSessions: sessions.count, expiredVerifications: verifications.count, expiredRateLimits: rateLimits.count };
}
