import { db } from "@/lib/db";
import { classifyDatabaseHealth } from "@/lib/health";
import { correlatedJson } from "@/lib/http";
import { correlationId, logEvent } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = correlationId(request);
  const startedAt = performance.now();
  let available = true;
  try {
    await db.$queryRaw`SELECT 1`;
  } catch {
    available = false;
  }
  const database = classifyDatabaseHealth({ available, latencyMs: performance.now() - startedAt });
  const status = database.status === "operational" ? "operational" : "degraded";
  if (database.status !== "operational") {
    logEvent(database.status === "unavailable" ? "error" : "warn", "health.database_degraded", {
      correlationId: requestId,
      databaseStatus: database.status,
      databaseLatencyMs: database.latencyMs,
      databaseLatencyWarningMs: database.warningThresholdMs,
    });
  }
  return correlatedJson(
    {
      status,
      application: "operational",
      database: database.status,
      databaseLatencyMs: database.latencyMs,
      databaseLatencyWarningMs: database.warningThresholdMs,
      apollo: "credential status available only to authenticated organization members",
      timestamp: new Date().toISOString(),
    },
    requestId,
    {
      status: database.status === "unavailable" ? 503 : 200,
      headers: {
        "cache-control": "no-store",
        "server-timing": `database;dur=${database.latencyMs}`,
        "x-health-status": status,
      },
    },
  );
}
