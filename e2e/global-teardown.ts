import { PrismaClient } from "@prisma/client";

export default async function globalTeardown() {
  const db = new PrismaClient();
  try {
    const authUsers = await db.user.findMany({
      where: { email: { startsWith: "e2e-auth-" } },
      include: { memberships: true },
    });
    const authUserIds = authUsers.map(({ id }) => id);
    const authOrganizationIds = authUsers.flatMap(({ memberships }) => memberships.map(({ organizationId }) => organizationId));
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
    if (authUserIds.length) await db.user.deleteMany({ where: { id: { in: authUserIds } } });
    if (authOrganizationIds.length) await db.organization.deleteMany({ where: { id: { in: authOrganizationIds } } });
  } finally {
    await db.$disconnect();
  }
}
