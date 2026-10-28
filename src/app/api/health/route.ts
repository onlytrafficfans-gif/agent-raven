import { db } from "@/lib/db";
import { correlatedJson } from "@/lib/http";
import { correlationId } from "@/lib/logger";
export const dynamic="force-dynamic";
export async function GET(request: Request){const requestId=correlationId(request);let database:"operational"|"unavailable"="unavailable";try{await db.$queryRaw`SELECT 1`;database="operational"}catch{database="unavailable"}return correlatedJson({status:database==="unavailable"?"degraded":"operational",application:"operational",database,apollo:"credential status available only to authenticated organization members",timestamp:new Date().toISOString()},requestId,{status:database==="unavailable"?503:200,headers:{"cache-control":"no-store"}})}
