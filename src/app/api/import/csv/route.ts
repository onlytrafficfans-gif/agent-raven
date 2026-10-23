import { Prisma } from "@prisma/client";
import { requireContext } from "@/lib/authorization";
import { parseProspectCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { correlationId } from "@/lib/logger";

export async function POST(request: Request) {
  const requestId = correlationId(request);
  try {
    const ctx = await requireContext(["OWNER", "ADMIN", "ANALYST"]);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size > 2_000_000) {
      return Response.json({ error: { code: "INVALID_FILE", message: "Upload a CSV file no larger than 2 MB." }, correlationId: requestId }, { status: 400 });
    }
    const result = parseProspectCsv(await file.text());
    let created = 0;
    let duplicates = 0;
    for (const row of result.valid) {
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
    return Response.json({ summary: { valid: result.valid.length, created, duplicates, errors: result.errors.length }, errors: result.errors, correlationId: requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
