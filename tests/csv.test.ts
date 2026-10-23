import { describe,expect,it } from "vitest";
import { parseProspectCsv } from "@/lib/csv";
describe("CSV fallback",()=>{it("validates rows and deduplicates normalized domains",()=>{const result=parseProspectCsv("company_name,domain,industry\nAcme,https://www.EXAMPLE.com/a,Roofing\nDuplicate,example.com,Roofing\nMissing,,Roofing");expect(result.valid).toHaveLength(1);expect(result.valid[0].normalizedDomain).toBe("example.com");expect(result.errors).toHaveLength(2)})});
