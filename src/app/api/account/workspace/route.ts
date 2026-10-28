import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { correlatedJson } from "@/lib/http";
import { correlationId, logEvent } from "@/lib/logger";

const bodySchema = z.object({ workspaceName: z.string().trim().min(2).max(80).optional() }).strict();

export async function POST(request: Request) {
  const requestId = correlationId(request);
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return correlatedJson({ error: { code: "UNAUTHORIZED", message: "Sign in is required." } }, requestId, { status: 401 });

  const raw = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return correlatedJson({ error: { code: "VALIDATION_ERROR", message: "Workspace name must be between 2 and 80 characters." } }, requestId, { status: 400 });

  const existing = await db.membership.findUnique({ where: { userId: session.user.id } });
  if (existing) return correlatedJson({ data: { membershipId: existing.id, created: false } }, requestId);

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
    return correlatedJson({ data: { membershipId: membership.id, created: true } }, requestId, { status: 201 });
  } catch (error) {
    const raced = await db.membership.findUnique({ where: { userId: session.user.id } });
    if (raced) return correlatedJson({ data: { membershipId: raced.id, created: false } }, requestId);
    logEvent("error", "workspace.provisioning_failed", { correlationId: requestId, errorType: error instanceof Error ? error.name : "UnknownError" });
    return correlatedJson({ error: { code: "WORKSPACE_SETUP_FAILED", message: "The workspace could not be prepared." } }, requestId, { status: 500 });
  }
}
