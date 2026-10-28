import { z } from "zod";
import { auth } from "@/lib/auth";
import { isPasswordResetEmailConfigured } from "@/lib/email";
import { correlatedJson } from "@/lib/http";
import { correlationId } from "@/lib/logger";

const bodySchema = z.object({ email: z.email().max(254) }).strict();

export async function POST(request: Request) {
  const requestId = correlationId(request);
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return correlatedJson({ error: { code: "VALIDATION_ERROR", message: "Enter a valid email address." } }, requestId, { status: 400 });
  if (!isPasswordResetEmailConfigured()) return correlatedJson({ error: { code: "EMAIL_NOT_CONFIGURED", message: "Password email delivery is not configured." } }, requestId, { status: 503 });

  await auth.api.requestPasswordReset({
    body: { email: parsed.data.email, redirectTo: "/reset-password" },
    headers: request.headers,
  });
  return correlatedJson({ data: { message: "If this account exists, a reset email has been sent." } }, requestId);
}
