import { requirePageContext } from "@/lib/page-context";
import { db } from "@/lib/db";
import { ProspectsWorkspace, type ProspectView } from "@/components/prospects-workspace";

export const dynamic="force-dynamic";
export default async function ProspectsPage(){const ctx=await requirePageContext();const rows=await db.prospectCompany.findMany({where:{organizationId:ctx.organizationId},include:{tags:{include:{tag:true}}},orderBy:{updatedAt:"desc"},take:50});const data:ProspectView[]=rows.map(r=>({id:r.id,name:r.name,domain:r.normalizedDomain,status:r.status,industry:r.industry,location:r.location,source:r.source==="CSV_IMPORT"?"CSV import":"Apollo",tags:r.tags.map(x=>x.tag.name),updatedAt:r.updatedAt.toISOString(),retrievedAt:r.retrievedAt.toISOString()}));return <ProspectsWorkspace initial={data}/>}
