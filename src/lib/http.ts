import { ProviderError } from "@/lib/provider-errors";
import { AuthorizationError } from "@/lib/authorization";
import { ZodError } from "zod";

export function jsonError(error: unknown, correlationId?: string): Response {
  if (error instanceof Response) return error;
  if (error instanceof AuthorizationError) {
    return Response.json(
      { error: { code: error.code, message: error.message }, correlationId },
      { status: error.status },
    );
  }
  if (error instanceof ZodError) return Response.json({ error: { code: "VALIDATION_ERROR", message: "Check the submitted fields.", fields: error.flatten().fieldErrors }, correlationId }, { status: 400 });
  if (error instanceof ProviderError) {
    const status = error.code === "INVALID_CREDENTIAL" ? 401 : error.code === "INSUFFICIENT_PERMISSION" ? 403 : error.code === "RATE_LIMITED" ? 429 : error.code === "INVALID_REQUEST" ? 422 : error.code === "BUDGET_BLOCKED" ? 402 : 503;
    return Response.json({ error: { code: error.code, message: error.message, retryAfter: error.retryAfter }, correlationId }, { status });
  }
  return Response.json({ error: { code: "INTERNAL_ERROR", message: "The request could not be completed." }, correlationId }, { status: 500 });
}
