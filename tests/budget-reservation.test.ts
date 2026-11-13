import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { reserveApolloOperation, runBudgetedApolloOperation } from "@/lib/budget";
import { db } from "@/lib/db";
import { ProviderError } from "@/lib/provider-errors";

afterAll(async () => {
  await db.$disconnect();
});

describe("persistent Apollo budget reservations", () => {
  it("serializes concurrent reservations and never exceeds the organization limit", async () => {
    const suffix = randomUUID();
    const organization = await db.organization.create({
      data: { name: "Budget Concurrency Test", slug: `e2e-budget-${suffix}` },
    });

    try {
      const attempts = await Promise.allSettled(Array.from({ length: 12 }, (_, index) => reserveApolloOperation({
        organizationId: organization.id,
        operation: "TEST_RESERVATION",
        correlationId: `budget-reservation-${index}-${suffix}`,
        limit: 5,
      })));
      const accepted = attempts.filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof reserveApolloOperation>>> => result.status === "fulfilled");
      const blocked = attempts.filter((result): result is PromiseRejectedResult => result.status === "rejected");

      expect(accepted).toHaveLength(5);
      expect(blocked).toHaveLength(7);
      expect(blocked.every((result) => result.reason instanceof ProviderError && result.reason.code === "BUDGET_BLOCKED")).toBe(true);
      await expect(db.integrationUsage.aggregate({
        where: { organizationId: organization.id, provider: "APOLLO" },
        _sum: { usageUnits: true },
        _count: { _all: true },
      })).resolves.toMatchObject({ _sum: { usageUnits: 5 }, _count: { _all: 5 } });
    } finally {
      await db.organization.delete({ where: { id: organization.id } });
    }
  });

  it("records failed provider attempts against the limit with a sanitized outcome", async () => {
    const suffix = randomUUID();
    const organization = await db.organization.create({
      data: { name: "Budget Failure Test", slug: `e2e-budget-failure-${suffix}` },
    });

    try {
      await expect(runBudgetedApolloOperation({
        organizationId: organization.id,
        operation: "TEST_FAILURE",
        correlationId: `budget-failure-${suffix}`,
        limit: 1,
      }, async () => {
        throw new ProviderError("RATE_LIMITED", "Provider rate limit reached.");
      })).rejects.toMatchObject({ code: "RATE_LIMITED" });

      await expect(db.integrationUsage.findFirstOrThrow({ where: { organizationId: organization.id } })).resolves.toMatchObject({
        operation: "TEST_FAILURE",
        outcome: "RATE_LIMITED",
        usageUnits: 1,
      });
      await expect(reserveApolloOperation({
        organizationId: organization.id,
        operation: "TEST_RETRY",
        correlationId: `budget-retry-${suffix}`,
        limit: 1,
      })).rejects.toMatchObject({ code: "BUDGET_BLOCKED" });
    } finally {
      await db.organization.delete({ where: { id: organization.id } });
    }
  });
});
