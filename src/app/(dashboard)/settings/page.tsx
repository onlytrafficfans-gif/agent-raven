import { Prisma } from "@prisma/client";
import { Activity, Database, Gauge, PlugZap } from "lucide-react";
import { db } from "@/lib/db";
import { configuredOperationLimit, monthlyUsageWindowStart } from "@/lib/operations";
import { requirePageContext } from "@/lib/page-context";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ctx = await requirePageContext();
  const canViewOperations = ctx.role === "OWNER" || ctx.role === "ADMIN";
  const operationLimit = configuredOperationLimit(process.env.APOLLO_MONTHLY_OPERATION_LIMIT);
  const snapshot = canViewOperations ? await loadOperationsSnapshot(ctx.organizationId) : null;

  return <>
    <h1 className="page-title">Settings</h1>
    <p className="page-subtitle">Phase 1 organization controls and operational evidence.</p>
    <section className="panel">
      <div className="panel-head"><div><h2>Discovery controls</h2><p>Provider budgets are enforced before paid operations.</p></div></div>
      <div style={{padding:20,maxWidth:620}}>
        <div className="field"><label htmlFor="apollo-operation-limit">Apollo monthly operation limit</label><input id="apollo-operation-limit" className="input" value={operationLimit ?? "Configuration required"} readOnly/></div>
        <p style={{color:"var(--muted)",fontSize:12,lineHeight:1.6}}>Change this server-side environment value and redeploy. The browser cannot raise provider limits.</p>
      </div>
    </section>
    {snapshot ? <>
      <section className="panel section-space" aria-labelledby="operations-heading">
        <div className="panel-head chrome-head"><div><h2 id="operations-heading">Operations evidence</h2><p>Live organization-scoped PostgreSQL state. No projected or decorative analytics.</p></div><span className="badge">UTC month</span></div>
        <div className="operations-grid">
          <div className="record-item"><span><PlugZap/>Apollo state</span><strong className="operations-value">{snapshot.integrationState}</strong></div>
          <div className="record-item"><span><Gauge/>Monthly usage</span><strong className="operations-value">{snapshot.usageUnits}{operationLimit ? ` / ${operationLimit}` : ""}</strong></div>
          <div className="record-item"><span><Database/>Saved prospects</span><strong>{snapshot.prospectCount}</strong></div>
          <div className="record-item"><span><Activity/>Audit events</span><strong>{snapshot.auditCount}</strong></div>
        </div>
        <div className="operations-footnote">{snapshot.usageOperations} provider operation{snapshot.usageOperations === 1 ? "" : "s"} recorded since {snapshot.windowStart.toISOString().slice(0,10)}. Last connection test: {snapshot.lastTestedAt ? snapshot.lastTestedAt.toLocaleString() : "Not yet tested"}.</div>
      </section>
      <section className="panel section-space" aria-labelledby="audit-heading">
        <div className="panel-head"><div><h2 id="audit-heading">Recent audit activity</h2><p>The latest 25 material Phase 1 actions. Secret values and event metadata are not displayed.</p></div></div>
        {snapshot.audits.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Time</th><th>Action</th><th>Actor</th><th>Target</th><th>Request ID</th></tr></thead><tbody>{snapshot.audits.map((event) => <tr key={event.id}><td>{event.createdAt.toLocaleString()}</td><td><span className="badge">{event.action.replaceAll("_", " ")}</span></td><td>{event.actor?.name ?? "System"}</td><td>{event.targetType}</td><td className="mono-cell">{event.correlationId}</td></tr>)}</tbody></table></div> : <div className="empty"><strong>No audit activity yet</strong>Material Phase 1 actions will appear here after they occur.</div>}
      </section>
    </> : <section className="panel section-space"><div className="panel-head"><div><h2>Operations evidence</h2><p>Restricted operational records.</p></div></div><div className="empty"><strong>Owner or Admin access required</strong>Provider usage and audit activity are restricted to organization operators.</div></section>}
  </>;
}

async function loadOperationsSnapshot(organizationId: string) {
  const windowStart = monthlyUsageWindowStart();
  const [connection, usage, prospectCount, auditCount, audits] = await db.$transaction([
    db.integrationConnection.findUnique({
      where: { organizationId_provider: { organizationId, provider: "APOLLO" } },
      select: { state: true, lastTestedAt: true },
    }),
    db.integrationUsage.aggregate({
      where: { organizationId, provider: "APOLLO", createdAt: { gte: windowStart } },
      _sum: { usageUnits: true },
      _count: { _all: true },
    }),
    db.prospectCompany.count({ where: { organizationId } }),
    db.auditLog.count({ where: { organizationId } }),
    db.auditLog.findMany({
      where: { organizationId },
      select: { id: true, action: true, targetType: true, correlationId: true, createdAt: true, actor: { select: { name: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 25,
    }),
  ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  return {
    integrationState: connection?.state.replaceAll("_", " ") ?? "NOT CONFIGURED",
    lastTestedAt: connection?.lastTestedAt ?? null,
    usageUnits: usage._sum.usageUnits ?? 0,
    usageOperations: usage._count._all,
    prospectCount,
    auditCount,
    audits,
    windowStart,
  };
}
