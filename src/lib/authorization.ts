import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export type RequestContext = { userId: string; organizationId: string; organizationName: string; role: "OWNER" | "ADMIN" | "ANALYST" | "VIEWER" };

export class AuthorizationError extends Error {
  constructor(
    public status: 401 | 403,
    public code: "UNAUTHENTICATED" | "FORBIDDEN",
    message: string,
  ) {
    super(message);
  }
}

export async function requireContext(allowed: RequestContext["role"][] = ["OWNER", "ADMIN", "ANALYST", "VIEWER"]): Promise<RequestContext> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new AuthorizationError(401, "UNAUTHENTICATED", "Authentication is required.");
  const membership = await db.membership.findFirst({ where: { userId: session.user.id }, include: { organization: true }, orderBy: { createdAt: "asc" } });
  if (!membership || !allowed.includes(membership.role)) {
    throw new AuthorizationError(403, "FORBIDDEN", "This account cannot perform the requested operation.");
  }
  return { userId: session.user.id, organizationId: membership.organizationId, organizationName: membership.organization.name, role: membership.role };
}

export async function optionalContext(): Promise<RequestContext | null> {
  try {
    return await requireContext();
  } catch (error) {
    if (error instanceof AuthorizationError) return null;
    throw error;
  }
}
