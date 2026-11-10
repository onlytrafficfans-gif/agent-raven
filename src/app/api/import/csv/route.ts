import { Prisma } from "@prisma/client";
import { requireContext } from "@/lib/authorization";
import { parseProspectCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { correlatedJson, jsonError } from "@/lib/http";
import { correlationId } from "@/lib/logger";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const requestId = correlationId(request);
  try {
    const ctx = await requireContext(["OWNER", "ADMIN", "ANALYST"]);
    await enforceRateLimit({ organizationId: ctx.organizationId, userId: ctx.userId, policy: "csvImport" });
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size > 2_000_000) {
      return correlatedJson({ error: { code: "INVALID_FILE", message: "Upload a CSV file no larger than 2 MB." } }, requestId, { status: 400 });
    }
    const result = parseProspectCsv(await file.text());
    let created = 0;
    let duplicates = 0;
    let suppressed = 0;
    const suppressedDomains = new Set((await db.prospectSuppression.findMany({
      where: { organizationId: ctx.organizationId, normalizedDomain: { in: result.valid.map((row) => row.normalizedDomain) } },
      select: { normalizedDomain: true },
    })).flatMap(({ normalizedDomain }) => normalizedDomain ? [normalizedDomain] : []));
    for (const row of result.valid) {
      if (suppressedDomains.has(row.normalizedDomain)) {
        suppressed++;
        result.errors.push({ row: row.row, message: "This domain was deleted and suppressed from re-import." });
        continue;
      }
      try {
        await db.$transaction(async (tx) => {
          const prospect = await tx.prospectCompany.create({
            data: {
              organizationId: ctx.organizationId,
              source: "CSV_IMPORT",
              providerName: "CSV import",
              normalizedDomain: row.normalizedDomain,
              name: row.name,
              websiteUrl: row.websiteUrl,
              industry: row.industry,
              location: row.location,
              employeeCount: row.employeeCount,
              estimatedRevenue: row.estimatedRevenue === null ? null : BigInt(row.estimatedRevenue),
              retrievedAt: new Date(),
              provenance: { source: "CSV import", row: row.row },
            },
          });
          await tx.auditLog.create({
            data: {
              organizationId: ctx.organizationId,
              actorUserId: ctx.userId,
              prospectId: prospect.id,
              action: "PROSPECT_CREATED",
              targetType: "ProspectCompany",
              targetId: prospect.id,
              correlationId: requestId,
              metadata: { source: "CSV import", row: row.row },
            },
          });
        });
        created++;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") duplicates++;
        else result.errors.push({ row: row.row, message: "Row could not be persisted." });
      }
    }
    return correlatedJson({ summary: { valid: result.valid.length, created, duplicates, suppressed, errors: result.errors.length }, errors: result.errors }, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
