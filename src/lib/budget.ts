export type BudgetDecision = { allowed: true; remaining: number } | { allowed: false; remaining: 0; reason: string };

export function decideBudget(used: number, requested: number, limit: number): BudgetDecision {
  if (![used, requested, limit].every(Number.isFinite) || used < 0 || requested < 1 || limit < 0) return { allowed: false, remaining: 0, reason: "Invalid budget configuration." };
  if (used + requested > limit) return { allowed: false, remaining: 0, reason: "Configured Apollo monthly operation limit reached." };
  return { allowed: true, remaining: limit - used - requested };
}
