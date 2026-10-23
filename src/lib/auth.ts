import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "@/lib/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const auth = betterAuth({
  appName: "Agent.Raven",
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, disableSignUp: true },
  session: { expiresIn: 60 * 60 * 8, updateAge: 60 * 30 },
  rateLimit: { enabled: process.env.E2E !== "true" },
  advanced: { database: { generateId: "uuid", transaction: true } },
  trustedOrigins: [process.env.BETTER_AUTH_URL ?? "http://localhost:3000"],
});

export type AppSession = { userId: string; organizationId: string; role: "OWNER" | "ADMIN" | "ANALYST" | "VIEWER"; name: string; email: string };

export async function getSession(): Promise<AppSession | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const membership = await db.membership.findFirst({ where: { userId: session.user.id }, orderBy: { createdAt: "asc" } });
  if (!membership) return null;
  return { userId: session.user.id, organizationId: membership.organizationId, role: membership.role, name: session.user.name, email: session.user.email };
}

export async function requireSession() { const session = await getSession(); if (!session) redirect("/sign-in"); return session; }
export async function requireRole(roles: AppSession["role"][]) { const session = await requireSession(); if (!roles.includes(session.role)) throw new Error("FORBIDDEN"); return session; }
