import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { enforcePublicRateLimit, fixedWindowStart, publicRateLimitBucketKey, publicRateLimitPolicies, rateLimitPolicies } from "@/lib/rate-limit";

afterAll(async () => {
  await db.$disconnect();
});

describe("rate-limit policy", () => {
  it("aligns requests to a deterministic fixed window", () => {
    const now = new Date("2026-11-04T14:03:47.443Z");
    expect(fixedWindowStart(now, 60_000).toISOString()).toBe("2026-11-04T14:03:00.000Z");
    expect(fixedWindowStart(now, 10 * 60_000).toISOString()).toBe("2026-11-04T14:00:00.000Z");
  });

  it("shares paid-provider limits across the organization and isolates write limits by user", () => {
    expect(rateLimitPolicies.apolloOperation.sharedByOrganization).toBe(true);
    expect(rateLimitPolicies.apolloConnection.sharedByOrganization).toBe(true);
    expect(rateLimitPolicies.prospectCreate.sharedByOrganization).toBe(false);
    expect(rateLimitPolicies.prospectUpdate.sharedByOrganization).toBe(false);
    expect(rateLimitPolicies.prospectDelete).toMatchObject({ limit: 20, sharedByOrganization: false });
    expect(rateLimitPolicies.prospectExport).toMatchObject({ limit: 5, sharedByOrganization: false });
  });

  it("stores only an opaque password-reset subject and enforces the public limit", async () => {
    const email = `Reset.Target.${crypto.randomUUID()}@Example.com`;
    const secret = process.env.BETTER_AUTH_SECRET;
    expect(secret?.length).toBeGreaterThanOrEqual(32);
    const bucketKey = publicRateLimitBucketKey("passwordReset", email);
    const now = new Date("2026-11-20T14:15:00.000Z");
    try {
      expect(bucketKey).not.toContain(email.toLowerCase());
      for (let attempt = 0; attempt < publicRateLimitPolicies.passwordReset.limit; attempt++) {
        await expect(enforcePublicRateLimit({ subject: email, policy: "passwordReset", now })).resolves.toMatchObject({
          limit: 3,
          remaining: 2 - attempt,
        });
      }
      await expect(enforcePublicRateLimit({ subject: email.toLowerCase(), policy: "passwordReset", now })).rejects.toMatchObject({
        code: "RATE_LIMITED",
        status: 429,
      });
      await expect(db.publicRateLimitBucket.findUniqueOrThrow({
        where: { bucketKey_windowStart: { bucketKey, windowStart: fixedWindowStart(now, publicRateLimitPolicies.passwordReset.windowMs) } },
      })).resolves.toMatchObject({ count: 4 });
    } finally {
      await db.publicRateLimitBucket.deleteMany({ where: { bucketKey } });
    }
  });
});
