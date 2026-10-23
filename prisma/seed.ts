import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

const db = new PrismaClient();
async function main() {
  const email = process.env.SEED_OWNER_EMAIL;
  const password = process.env.SEED_OWNER_PASSWORD;
  if (!email || !password || password.length < 16) {
    throw new Error("SEED_OWNER_EMAIL and a SEED_OWNER_PASSWORD of at least 16 characters are required.");
  }
  const organization = await db.organization.upsert({ where: { slug: "raven-digital" }, update: {}, create: { name: "Raven Digital", slug: "raven-digital" } });
  const user = await db.user.upsert({ where: { email }, update: {}, create: { email, name: "Raven", emailVerified: true } });
  const passwordHash = await hashPassword(password);
  await db.account.upsert({ where: { providerId_accountId: { providerId: "credential", accountId: user.id } }, update: { password: passwordHash }, create: { providerId: "credential", accountId: user.id, userId: user.id, password: passwordHash } });
  await db.membership.upsert({ where: { organizationId_userId: { organizationId: organization.id, userId: user.id } }, update: { role: "OWNER" }, create: { organizationId: organization.id, userId: user.id, role: "OWNER" } });
  await db.integrationConnection.upsert({ where: { organizationId_provider: { organizationId: organization.id, provider: "APOLLO" } }, update: {}, create: { organizationId: organization.id, provider: "APOLLO", state: "DISCONNECTED" } });
}
main().finally(() => db.$disconnect());
