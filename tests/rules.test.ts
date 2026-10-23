import { describe,expect,it } from "vitest";
import { decideBudget } from "@/lib/budget";
import { companySearchSchema,prospectStatusSchema } from "@/lib/schemas";
import { mapApolloStatus } from "@/lib/provider-errors";
import { redact } from "@/lib/security";
describe("Phase 1 rules",()=>{
  it("requires a meaningful search criterion",()=>expect(companySearchSchema.safeParse({page:1,perPage:25}).success).toBe(false));
  it("accepts only Phase 1 prospect statuses",()=>{expect(prospectStatusSchema.safeParse("QUALIFIED").success).toBe(true);expect(prospectStatusSchema.safeParse("CONTACTED").success).toBe(false)});
  it("blocks an operation before exceeding budget",()=>expect(decideBudget(10,1,10)).toMatchObject({allowed:false}));
  it.each([[401,"INVALID_CREDENTIAL"],[403,"INSUFFICIENT_PERMISSION"],[422,"INVALID_REQUEST"],[429,"RATE_LIMITED"],[503,"PROVIDER_UNAVAILABLE"]])("maps Apollo %i",(status,code)=>expect(mapApolloStatus(status).code).toBe(code));
  it("redacts nested secret fields and inline values",()=>expect(redact({apiKey:"secret",message:"token=abc"})).toEqual({apiKey:"[REDACTED]",message:"token=[REDACTED]"}));
});
