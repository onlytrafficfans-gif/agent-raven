import { Prisma } from "@prisma/client";
import { requireContext } from "@/lib/authorization";
import { db } from "@/lib/db";
import { normalizeDomain } from "@/lib/domain";
import { jsonError } from "@/lib/http";
import { correlationId } from "@/lib/logger";
import { saveProspectSchema } from "@/lib/schemas";
import { serializeProspect } from "@/lib/serialization";

export async function POST(request: Request) {
  const requestId = correlationId(request);
  try {
    const ctx = await requireContext(["OWNER", "ADMIN", "ANALYST"]);
    const input = saveProspectSchema.parse(await request.json());
    const normalizedDomain = normalizeDomain(input.domain ?? input.websiteUrl);
    const source = input.providerName === "Apollo" ? "APOLLO" : "CSV_IMPORT";
    const providerId = input.providerOrganizationId ?? null;
    const identity = [
      ...(providerId ? [{ providerName: input.providerName, providerOrganizationId: providerId }] : []),
      ...(normalizedDomain ? [{ normalizedDomain }] : []),
    ];
    const matches = await db.prospectCompany.findMany({ where: { organizationId: ctx.organizationId, OR: identity } });
    if (matches.length) {
      if (new Set(matches.map((item) => item.id)).size > 1) {
        return Response.json({ error: { code: "IDENTITY_CONFLICT", message: "Provider identity and normalized domain point to different records; manual review is required." }, correlationId: requestId }, { status: 409 });
      }
      return Response.json({ prospect: serializeProspect(matches[0]), created: false, correlationId: requestId });
    }
    try {
      const prospect = await db.$transaction(async (tx) => {
        const created = await tx.prospectCompany.create({
          data: {
            organizationId: ctx.organizationId,
            source,
            providerName: input.providerName,
            providerOrganizationId: providerId,
            normalizedDomain,
            name: input.name,
            websiteUrl: input.websiteUrl,
            industry: input.industry,
            location: input.location,
            employeeCount: input.employeeCount,
            estimatedRevenue: input.estimatedRevenue ? BigInt(input.estimatedRevenue) : null,
            retrievedAt: input.retrievedAt,
            provenance: input.provenance as Prisma.InputJsonValue,
          },
        });
        await tx.auditLog.create({
          data: { organizationId: ctx.organizationId, actorUserId: ctx.userId, prospectId: created.id, action: "PROSPECT_CREATED", targetType: "ProspectCompany", targetId: created.id, correlationId: requestId, metadata: { source } },
        });
        return created;
      });
      return Response.json({ prospect: serializeProspect(prospect), created: true, correlationId: requestId }, { status: 201 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await db.prospectCompany.findFirst({ where: { organizationId: ctx.organizationId, OR: identity } });
        if (existing) return Response.json({ prospect: serializeProspect(existing), created: false, correlationId: requestId });
      }
      throw error;
    }
  } catch (error) {
    return jsonError(error, requestId);
  }
}

export async function GET(request: Request) {
  try {
    const ctx = await requireContext();
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim();
    const status = url.searchParams.get("status") as "NEW" | "REVIEWING" | "QUALIFIED" | "REJECTED" | null;
    const prospects = await db.prospectCompany.findMany({
      where: {
        organizationId: ctx.organizationId,
        ...(status ? { status } : {}),
        ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { normalizedDomain: { contains: q, mode: "insensitive" } }] } : {}),
      },
      include: { tags: { include: { tag: true } } },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });
    return Response.json({ prospects: prospects.map(serializeProspect) });
  } catch (error) {
    return jsonError(error);
  }
}
