import { requirePageContext } from "@/lib/page-context";
import { db } from "@/lib/db";
import { ApolloConnection } from "@/components/apollo-connection";
export const dynamic="force-dynamic";
export default async function IntegrationsPage(){const ctx=await requirePageContext();const state=(await db.integrationConnection.findUnique({where:{organizationId_provider:{organizationId:ctx.organizationId,provider:"APOLLO"}}}))?.state??"DISCONNECTED";return <><h1 className="page-title">Integrations</h1><p className="page-subtitle">Manage server-held provider credentials and connection health.</p><ApolloConnection initialState={state}/></>}
