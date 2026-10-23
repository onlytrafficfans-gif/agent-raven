import { describe,expect,it,vi } from "vitest";
import { ApolloClient } from "@/lib/apollo";
describe("Apollo adapter contract fixture",()=>{
  it("uses the zero-credit auth health endpoint for connection tests",async()=>{const fetcher=vi.fn(async()=>new Response("{}",{status:200}));await new ApolloClient("sanitized-test-key",fetcher as typeof fetch).testConnection();expect(fetcher).toHaveBeenCalledWith("https://api.apollo.io/api/v1/auth/health",expect.objectContaining({method:"GET"}))});
  it("normalizes only fields actually returned",async()=>{const fetcher=vi.fn(async()=>Response.json({organizations:[{id:"org-1",name:"Fixture Roofing",primary_domain:"fixture.example",industry:"construction",city:"Las Vegas",state:"Nevada",estimated_num_employees:42}],pagination:{total_entries:1}}));const result=await new ApolloClient("sanitized-test-key",fetcher as typeof fetch).search({industry:"construction",location:"Las Vegas",page:1,perPage:25});expect(result.companies[0]).toMatchObject({providerOrganizationId:"org-1",name:"Fixture Roofing",domain:"fixture.example",estimatedRevenue:null});expect(result.usageUnits).toBe(1)});
});
