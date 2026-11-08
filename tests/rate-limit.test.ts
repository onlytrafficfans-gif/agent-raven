import { describe, expect, it } from "vitest";
import { fixedWindowStart, rateLimitPolicies } from "@/lib/rate-limit";

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
    expect(rateLimitPolicies.prospectExport).toMatchObject({ limit: 5, sharedByOrganization: false });
  });
});
