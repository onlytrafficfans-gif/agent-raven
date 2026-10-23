import { PrismaClient } from "@prisma/client";

export default async function globalTeardown() {
  const db = new PrismaClient();
  try {
    const prospects = await db.prospectCompany.findMany({
      where: { name: { startsWith: "E2E Roofing " } },
      select: { id: true },
    });
    const prospectIds = prospects.map(({ id }) => id);

    await db.$transaction([
      db.auditLog.deleteMany({
        where: {
          OR: [
            { correlationId: { startsWith: "e2e-" } },
            { prospectId: { in: prospectIds } },
            { targetId: { in: prospectIds } },
          ],
        },
      }),
      db.prospectCompany.deleteMany({ where: { id: { in: prospectIds } } }),
      db.tag.deleteMany({ where: { prospects: { none: {} } } }),
      db.session.deleteMany({ where: { userAgent: { startsWith: "AgentRaven-E2E/" } } }),
    ]);
  } finally {
    await db.$disconnect();
  }
}
