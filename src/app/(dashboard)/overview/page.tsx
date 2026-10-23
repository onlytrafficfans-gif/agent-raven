import Link from "next/link";
import { Database, PlugZap, Search, Users } from "lucide-react";
import { requirePageContext } from "@/lib/page-context";
import { db } from "@/lib/db";

export const dynamic="force-dynamic";

export default async function OverviewPage(){
  const ctx=await requirePageContext();
  const summary=await Promise.all([
    db.integrationConnection.findUnique({where:{organizationId_provider:{organizationId:ctx.organizationId,provider:"APOLLO"}}}),
    db.prospectCompany.count({where:{organizationId:ctx.organizationId}}),
    db.searchRun.count({where:{organizationId:ctx.organizationId}}),
  ]).then(([connection,prospects,searches])=>({connected:connection?.state==="CONNECTED",prospects,searches}));
  return <>
    <h1 className="page-title">Overview</h1><p className="page-subtitle">Discovery operations at a glance</p>
    <div className="grid-2">
      <section className="panel"><div className="panel-head chrome-head"><div><h2>Discovery sequence</h2><p>Complete the steps to start finding and saving businesses.</p></div></div><div className="workflow">
        <div className="workflow-step"><div className="step-number">1</div><div><strong>Connect Apollo</strong><p>{summary.connected?"Authorized company discovery is available.":"Add and test a server-held Apollo credential."}</p></div><Link className="btn ghost" href="/integrations">Manage connection</Link></div>
        <div className="workflow-step"><div className="step-number">2</div><div><strong>Search for companies</strong><p>{summary.searches?`${summary.searches} search run recorded.`:"Search history will appear after the first run."}</p></div><Link className="btn primary" href="/find-businesses">Find businesses</Link></div>
        <div className="workflow-step"><div className="step-number">3</div><div><strong>Save prospects</strong><p>{summary.prospects?`${summary.prospects} durable prospect records.`:"Save reviewed companies into the CRM."}</p></div><Link className="btn ghost" href="/prospects">View prospects</Link></div>
      </div></section>
      <section className="panel"><div className="panel-head chrome-head"><div><h2>System status</h2><p>Core systems required for Phase 1.</p></div></div><div className="status-list">
        <div className="status-row"><div><div className="status-name"><Search size={15} style={{verticalAlign:"middle",marginRight:8}}/>Application</div><div className="status-detail">Web app and server interfaces</div></div><div className="status-dot"><i className="dot"/>Operational</div></div>
        <div className="status-row"><div><div className="status-name"><Database size={15} style={{verticalAlign:"middle",marginRight:8}}/>Database</div><div className="status-detail">Organization-scoped PostgreSQL</div></div><div className="status-dot"><i className="dot"/>Operational</div></div>
        <div className="status-row"><div><div className="status-name"><PlugZap size={15} style={{verticalAlign:"middle",marginRight:8}}/>Apollo</div><div className="status-detail">Authorized external provider</div></div><div className={`status-dot ${summary.connected?"connected":"disconnected"}`}><i className="dot"/>{summary.connected?"Connected":"Disconnected"}</div></div>
      </div></section>
    </div>
    <section className="panel section-space"><div className="panel-head chrome-head"><div><h2>Discovery record</h2><p>No decorative analytics—only durable Phase 1 outcomes.</p></div></div><div className="record-grid"><div className="record-item"><span><Users size={17}/>Saved prospects</span><strong>{summary.prospects}</strong></div><div className="record-item"><span>Recorded search runs</span><strong>{summary.searches}</strong></div></div></section>
  </>
}
