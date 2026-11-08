import { db } from "@/lib/db";

const dayMs = 24 * 60 * 60 * 1000;

export const rateLimitPolicies = {
  apolloOperation: { limit: 10, windowMs: 60_000, sharedByOrganization: true },
  apolloConnection: { limit: 5, windowMs: 10 * 60_000, sharedByOrganization: true },
  integrationMutation: { limit: 20, windowMs: 60_000, sharedByOrganization: true },
  csvImport: { limit: 10, windowMs: 60_000, sharedByOrganization: false },
  prospectCreate: { limit: 60, windowMs: 60_000, sharedByOrganization: false },
  prospectUpdate: { limit: 120, windowMs: 60_000, sharedByOrganization: false },
  prospectExport: { limit: 5, windowMs: 10 * 60_000, sharedByOrganization: false },
} as const;

export type RateLimitPolicyName = keyof typeof rateLimitPolicies;

export class RateLimitError extends Error {
  readonly code = "RATE_LIMITED";
  readonly status = 429;

  constructor(public retryAfter: number) {
    super("Too many requests. Try again after the indicated delay.");
  }
}

export function fixedWindowStart(now: Date, windowMs: number): Date {
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

export async function enforceRateLimit(input: {
  organizationId: string;
  userId: string;
  policy: RateLimitPolicyName;
  now?: Date;
}): Promise<{ limit: number; remaining: number; retryAfter: number }> {
  const policy = rateLimitPolicies[input.policy];
  const now = input.now ?? new Date();
  const windowStart = fixedWindowStart(now, policy.windowMs);
  const bucketKey = policy.sharedByOrganization ? input.policy : `${input.policy}:${input.userId}`;
  const bucket = await db.apiRateLimitBucket.upsert({
    where: {
      organizationId_bucketKey_windowStart: {
        organizationId: input.organizationId,
        bucketKey,
        windowStart,
      },
    },
    create: { organizationId: input.organizationId, bucketKey, windowStart, count: 1 },
    update: { count: { increment: 1 } },
  });

  if (bucket.count === 1) {
    await db.apiRateLimitBucket.deleteMany({ where: { windowStart: { lt: new Date(now.getTime() - dayMs) } } });
  }

  const retryAfter = Math.max(1, Math.ceil((windowStart.getTime() + policy.windowMs - now.getTime()) / 1000));
  if (bucket.count > policy.limit) throw new RateLimitError(retryAfter);
  return { limit: policy.limit, remaining: Math.max(0, policy.limit - bucket.count), retryAfter };
}
