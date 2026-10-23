import { requirePageContext } from "@/lib/page-context";
import { SearchWorkspace } from "@/components/search-workspace";
import { db } from "@/lib/db";
export const dynamic="force-dynamic";
export default async function FindBusinessesPage(){const ctx=await requirePageContext();const connection=await db.integrationConnection.findUnique({where:{organizationId_provider:{organizationId:ctx.organizationId,provider:"APOLLO"}}});return <SearchWorkspace connected={connection?.state==="CONNECTED"}/>}
