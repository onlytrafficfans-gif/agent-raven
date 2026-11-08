import { Prisma } from "@prisma/client";
import { requireContext } from "@/lib/authorization";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { correlationId } from "@/lib/logger";
import { buildProspectExportCsv, prospectExportLimit } from "@/lib/prospect-export";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = correlationId(request);
  try {
    const ctx = await requireContext(["OWNER", "ADMIN"]);
    await enforceRateLimit({ organizationId: ctx.organizationId, userId: ctx.userId, policy: "prospectExport" });
    const prospects = await db.$transaction(async (tx) => {
      const count = await tx.prospectCompany.count({ where: { organizationId: ctx.organizationId } });
      if (count > prospectExportLimit) throw new ExportLimitError();
      const rows = await tx.prospectCompany.findMany({
        where: { organizationId: ctx.organizationId },
        include: {
          tags: { include: { tag: true }, orderBy: { tag: { name: "asc" } } },
          notes: { select: { body: true, createdAt: true }, orderBy: { createdAt: "asc" } },
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      await tx.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: "PROSPECTS_EXPORTED",
          targetType: "ProspectCompany",
          correlationId: requestId,
          metadata: { format: "csv", recordCount: rows.length },
        },
      });
      return rows;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });

    const date = new Date().toISOString().slice(0, 10);
    return new Response(buildProspectExportCsv(prospects), {
      status: 200,
      headers: {
        "cache-control": "no-store",
        "content-disposition": `attachment; filename="agent-raven-prospects-${date}.csv"`,
        "content-type": "text/csv; charset=utf-8",
        "x-content-type-options": "nosniff",
        "x-request-id": requestId,
      },
    });
  } catch (error) {
    if (error instanceof ExportLimitError) {
      return Response.json(
        { error: { code: "EXPORT_LIMIT_EXCEEDED", message: `Exports are limited to ${prospectExportLimit} prospects per file.` }, correlationId: requestId },
        { status: 413, headers: { "cache-control": "no-store", "x-request-id": requestId } },
      );
    }
    return jsonError(error, requestId);
  }
}

class ExportLimitError extends Error {}
