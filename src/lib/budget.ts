import { db } from "@/lib/db";
import { logEvent } from "@/lib/logger";
import { monthlyUsageWindowStart } from "@/lib/operations";
import { ProviderError } from "@/lib/provider-errors";

export type BudgetDecision = { allowed: true; remaining: number } | { allowed: false; remaining: 0; reason: string };

export function decideBudget(used: number, requested: number, limit: number): BudgetDecision {
  if (![used, requested, limit].every(Number.isFinite) || used < 0 || requested < 1 || limit < 0) return { allowed: false, remaining: 0, reason: "Invalid budget configuration." };
  if (used + requested > limit) return { allowed: false, remaining: 0, reason: "Configured Apollo monthly operation limit reached." };
  return { allowed: true, remaining: limit - used - requested };
}

type BudgetedOperationInput = {
  organizationId: string;
  operation: string;
  correlationId: string;
  limit: number;
  requested?: number;
  now?: Date;
};

export async function reserveApolloOperation(input: BudgetedOperationInput) {
  const requested = input.requested ?? 1;
  const now = input.now ?? new Date();
  const windowStart = monthlyUsageWindowStart(now);
  const windowEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const lockKey = `apollo-budget:${input.organizationId}:${windowStart.toISOString()}`;

  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
    const usage = await tx.integrationUsage.aggregate({
      _sum: { usageUnits: true },
      where: {
        organizationId: input.organizationId,
        provider: "APOLLO",
        createdAt: { gte: windowStart, lt: windowEnd },
      },
    });
    const decision = decideBudget(usage._sum.usageUnits ?? 0, requested, input.limit);
    if (!decision.allowed) throw new ProviderError("BUDGET_BLOCKED", decision.reason);

    const reservation = await tx.integrationUsage.create({
      data: {
        organizationId: input.organizationId,
        provider: "APOLLO",
        operation: input.operation,
        outcome: "RESERVED",
        usageUnits: requested,
        correlationId: input.correlationId,
      },
      select: { id: true },
    });
    return { id: reservation.id, remaining: decision.remaining, usageUnits: requested };
  });
}

export async function runBudgetedApolloOperation<T>(input: BudgetedOperationInput, operation: () => Promise<T>): Promise<T> {
  const reservation = await reserveApolloOperation(input);
  try {
    const result = await operation();
    await db.integrationUsage.update({ where: { id: reservation.id }, data: { outcome: "SUCCEEDED" } });
    return result;
  } catch (error) {
    const outcome = error instanceof ProviderError ? error.code : "INTERNAL_ERROR";
    try {
      await db.integrationUsage.update({ where: { id: reservation.id }, data: { outcome } });
    } catch (finalizeError) {
      logEvent("error", "apollo.usage_finalize_failed", {
        correlationId: input.correlationId,
        errorType: finalizeError instanceof Error ? finalizeError.name : "UnknownError",
      });
    }
    throw error;
  }
}
