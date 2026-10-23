import { describe, expect, it } from "vitest";
import { companySearchSchema, prospectStatusSchema } from "./schemas";

describe("boundary schemas", () => {
  it("requires at least one company criterion", () => expect(companySearchSchema.safeParse({ page:1, perPage:25 }).success).toBe(false));
  it("rejects reversed employee ranges", () => expect(companySearchSchema.safeParse({ industry:"roofing", employeeMin:20, employeeMax:10, page:1, perPage:25 }).success).toBe(false));
  it("accepts only Phase 1 statuses", () => { expect(prospectStatusSchema.safeParse("QUALIFIED").success).toBe(true); expect(prospectStatusSchema.safeParse("CONTACTED").success).toBe(false); });
});
