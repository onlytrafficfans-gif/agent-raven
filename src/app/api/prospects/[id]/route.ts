import { Prisma } from "@prisma/client";
import { requireContext } from "@/lib/authorization";
import { db } from "@/lib/db";
import { correlatedJson, jsonError } from "@/lib/http";
import { correlationId } from "@/lib/logger";
import { prospectUpdateSchema } from "@/lib/schemas";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = correlationId(request);
  try {
    const ctx = await requireContext(["OWNER", "ADMIN", "ANALYST"]);
    const { id } = await params;
    const input = prospectUpdateSchema.parse(await request.json());
    const existing = await db.prospectCompany.findFirst({ where: { id, organizationId: ctx.organizationId } });
    if (!existing) return correlatedJson({ error: { code: "NOT_FOUND", message: "Prospect not found." } }, requestId, { status: 404 });

    const updated = await db.$transaction(async (tx) => {
      const prospect = await tx.prospectCompany.update({
        where: { id },
        data: {
          ...(input.status ? { status: input.status } : {}),
          ...(input.tags ? {
            tags: {
              deleteMany: {},
              create: input.tags.map((name) => ({ tag: { connectOrCreate: { where: { organizationId_name: { organizationId: ctx.organizationId, name: name.toLowerCase() } }, create: { organizationId: ctx.organizationId, name: name.toLowerCase() } } } })),
            },
          } : {}),
        },
      });
      if (input.note) await tx.prospectNote.create({ data: { prospectId: id, authorId: ctx.userId, body: input.note } });
      await tx.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          prospectId: id,
          action: input.status && input.status !== existing.status ? "PROSPECT_STATUS_CHANGED" : "PROSPECT_UPDATED",
          targetType: "ProspectCompany",
          targetId: id,
          correlationId: requestId,
          metadata: { previousStatus: existing.status, newStatus: input.status, noteAdded: Boolean(input.note), tagsChanged: Boolean(input.tags) } as Prisma.InputJsonValue,
        },
      });
      return prospect;
    });
    return correlatedJson({ prospect: { id: updated.id, status: updated.status, updatedAt: updated.updatedAt } }, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
