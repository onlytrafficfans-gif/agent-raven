import Papa from "papaparse";
import { z } from "zod";
import { normalizeDomain } from "@/lib/domain";

const rowSchema = z.object({
  company_name: z.string().trim().min(1).max(240), domain: z.string().trim().min(1).max(500),
  website_url: z.string().trim().optional().default(""), industry: z.string().trim().optional().default(""),
  location: z.string().trim().optional().default(""), employee_count: z.string().trim().optional().default(""),
  estimated_revenue: z.string().trim().optional().default(""),
});
export type CsvProspect = { row:number; name:string; normalizedDomain:string; websiteUrl:string|null; industry:string|null; location:string|null; employeeCount:number|null; estimatedRevenue:number|null };
export type CsvResult = { valid:CsvProspect[]; errors:{row:number;message:string}[] };

export function parseProspectCsv(text:string):CsvResult{
  const parsed=Papa.parse<Record<string,string>>(text,{header:true,skipEmptyLines:"greedy",transformHeader:h=>h.trim().toLowerCase()});
  const valid:CsvProspect[]=[],errors:{row:number;message:string}[]=[];const domains=new Set<string>();
  for(const parseError of parsed.errors)errors.push({row:(parseError.row??0)+2,message:parseError.message});
  parsed.data.forEach((raw,index)=>{const row=index+2;const result=rowSchema.safeParse(raw);if(!result.success){errors.push({row,message:result.error.issues.map(i=>i.message).join("; ")});return}const domain=normalizeDomain(result.data.domain);if(!domain){errors.push({row,message:"Domain is invalid."});return}if(domains.has(domain)){errors.push({row,message:"Duplicate normalized domain in this file."});return}domains.add(domain);const employeeCount=result.data.employee_count?Number(result.data.employee_count):null;const estimatedRevenue=result.data.estimated_revenue?Number(result.data.estimated_revenue):null;if(employeeCount!==null&&(!Number.isInteger(employeeCount)||employeeCount<0)){errors.push({row,message:"Employee count must be a non-negative integer."});return}if(estimatedRevenue!==null&&(!Number.isFinite(estimatedRevenue)||estimatedRevenue<0)){errors.push({row,message:"Estimated revenue must be non-negative."});return}valid.push({row,name:result.data.company_name,normalizedDomain:domain,websiteUrl:result.data.website_url||null,industry:result.data.industry||null,location:result.data.location||null,employeeCount,estimatedRevenue});});
  return {valid,errors};
}
