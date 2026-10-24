import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const bodySchema = z.object({ workspaceName: z.string().trim().min(2).max(80).optional() }).strict();

function apiError(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return apiError("UNAUTHORIZED", "Sign in is required.", 401);

  const raw = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Workspace name must be between 2 and 80 characters.", 400);

  const existing = await db.membership.findUnique({ where: { userId: session.user.id } });
  if (existing) return Response.json({ data: { membershipId: existing.id, created: false } });

  const workspaceName = parsed.data.workspaceName ?? `${session.user.name.trim() || "Agent.Raven"}'s Workspace`;
  try {
    const membership = await db.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: workspaceName,
          slug: `workspace-${session.user.id.replaceAll("-", "")}`,
        },
      });
      const created = await tx.membership.create({ data: { organizationId: organization.id, userId: session.user.id, role: "OWNER" } });
      await tx.integrationConnection.create({ data: { organizationId: organization.id, provider: "APOLLO", state: "DISCONNECTED" } });
      return created;
    });
    return Response.json({ data: { membershipId: membership.id, created: true } }, { status: 201 });
  } catch (error) {
    const raced = await db.membership.findUnique({ where: { userId: session.user.id } });
    if (raced) return Response.json({ data: { membershipId: raced.id, created: false } });
    console.error("Workspace provisioning failed.", error instanceof Error ? error.name : "UnknownError");
    return apiError("WORKSPACE_SETUP_FAILED", "The workspace could not be prepared.", 500);
  }
}
