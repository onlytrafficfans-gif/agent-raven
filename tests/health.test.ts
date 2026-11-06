import { describe, expect, it } from "vitest";
import { classifyDatabaseHealth, databaseLatencyWarningMs } from "@/lib/health";

describe("database health classification", () => {
  it("reports a responsive database as operational", () => {
    expect(classifyDatabaseHealth({ available: true, latencyMs: databaseLatencyWarningMs - 1 })).toEqual({
      status: "operational",
      latencyMs: databaseLatencyWarningMs - 1,
      warningThresholdMs: databaseLatencyWarningMs,
    });
  });

  it("reports a slow but reachable database as degraded", () => {
    expect(classifyDatabaseHealth({ available: true, latencyMs: databaseLatencyWarningMs + 0.6 })).toEqual({
      status: "degraded",
      latencyMs: databaseLatencyWarningMs + 1,
      warningThresholdMs: databaseLatencyWarningMs,
    });
  });

  it("reports a failed database query as unavailable without negative timing", () => {
    expect(classifyDatabaseHealth({ available: false, latencyMs: -4 })).toEqual({
      status: "unavailable",
      latencyMs: 0,
      warningThresholdMs: databaseLatencyWarningMs,
    });
  });
});
