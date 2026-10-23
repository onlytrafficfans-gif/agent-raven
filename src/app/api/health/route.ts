import { db } from "@/lib/db";
export const dynamic="force-dynamic";
export async function GET(){let database:"operational"|"unavailable"="unavailable";try{await db.$queryRaw`SELECT 1`;database="operational"}catch{database="unavailable"}return Response.json({status:database==="unavailable"?"degraded":"operational",application:"operational",database,apollo:"credential status available only to authenticated organization members",timestamp:new Date().toISOString()},{status:database==="unavailable"?503:200,headers:{"cache-control":"no-store"}})}
