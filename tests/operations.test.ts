import { describe, expect, it } from "vitest";
import { configuredOperationLimit, monthlyUsageWindowStart } from "@/lib/operations";

describe("operations evidence", () => {
  it("uses a deterministic UTC calendar-month usage window", () => {
    expect(monthlyUsageWindowStart(new Date("2026-11-09T13:57:38.259Z")).toISOString()).toBe("2026-11-01T00:00:00.000Z");
  });

  it("accepts only positive integer provider-operation limits", () => {
    expect(configuredOperationLimit("100")).toBe(100);
    expect(configuredOperationLimit("0")).toBeNull();
    expect(configuredOperationLimit("1.5")).toBeNull();
    expect(configuredOperationLimit(undefined)).toBeNull();
  });
});
