import { z } from "zod";
import { auth } from "@/lib/auth";
import { isPasswordResetEmailConfigured } from "@/lib/email";

const bodySchema = z.object({ email: z.email().max(254) }).strict();

function apiError(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Enter a valid email address.", 400);
  if (!isPasswordResetEmailConfigured()) return apiError("EMAIL_NOT_CONFIGURED", "Password email delivery is not configured.", 503);

  await auth.api.requestPasswordReset({
    body: { email: parsed.data.email, redirectTo: "/reset-password" },
    headers: request.headers,
  });
  return Response.json({ data: { message: "If this account exists, a reset email has been sent." } });
}
