export const databaseLatencyWarningMs = 250;

export type DatabaseHealth = {
  status: "operational" | "degraded" | "unavailable";
  latencyMs: number;
  warningThresholdMs: number;
};

export function classifyDatabaseHealth(input: {
  available: boolean;
  latencyMs: number;
  warningThresholdMs?: number;
}): DatabaseHealth {
  const warningThresholdMs = input.warningThresholdMs ?? databaseLatencyWarningMs;
  const latencyMs = Math.max(0, Math.round(input.latencyMs));
  return {
    status: !input.available ? "unavailable" : latencyMs >= warningThresholdMs ? "degraded" : "operational",
    latencyMs,
    warningThresholdMs,
  };
}
