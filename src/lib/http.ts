import { ProviderError } from "@/lib/provider-errors";
import { AuthorizationError } from "@/lib/authorization";
import { ZodError } from "zod";

export function correlatedJson(body: Record<string, unknown>, correlationId: string, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("x-request-id", correlationId);
  return Response.json({ ...body, correlationId }, { ...init, headers });
}

export function jsonError(error: unknown, correlationId?: string): Response {
  const requestId = correlationId ?? crypto.randomUUID();
  if (error instanceof Response) {
    const headers = new Headers(error.headers);
    headers.set("x-request-id", requestId);
    return new Response(error.body, { status: error.status, statusText: error.statusText, headers });
  }
  if (error instanceof AuthorizationError) {
    return correlatedJson(
      { error: { code: error.code, message: error.message } },
      requestId,
      { status: error.status },
    );
  }
  if (error instanceof ZodError) return correlatedJson({ error: { code: "VALIDATION_ERROR", message: "Check the submitted fields.", fields: error.flatten().fieldErrors } }, requestId, { status: 400 });
  if (error instanceof ProviderError) {
    const status = error.code === "INVALID_CREDENTIAL" ? 401 : error.code === "INSUFFICIENT_PERMISSION" ? 403 : error.code === "RATE_LIMITED" ? 429 : error.code === "INVALID_REQUEST" ? 422 : error.code === "BUDGET_BLOCKED" ? 402 : 503;
    return correlatedJson({ error: { code: error.code, message: error.message, retryAfter: error.retryAfter } }, requestId, { status });
  }
  return correlatedJson({ error: { code: "INTERNAL_ERROR", message: "The request could not be completed." } }, requestId, { status: 500 });
}
