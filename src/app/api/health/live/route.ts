import { correlatedJson } from "@/lib/http";
import { correlationId } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = correlationId(request);
  return correlatedJson(
    { status: "operational", application: "operational", timestamp: new Date().toISOString() },
    requestId,
    { headers: { "cache-control": "no-store", "x-health-status": "operational" } },
  );
}
