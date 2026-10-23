import { requireContext } from "@/lib/authorization";
import { ApolloClient } from "@/lib/apollo";
import { decideBudget } from "@/lib/budget";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { correlationId } from "@/lib/logger";
import { ProviderError } from "@/lib/provider-errors";
import { decryptCredential } from "@/lib/security";

export async function GET(request: Request, { params }: { params: Promise<{ providerId: string }> }) {
  const requestId = correlationId(request);
  try {
    const ctx = await requireContext(["OWNER", "ADMIN", "ANALYST"]);
    const { providerId } = await params;
    const connection = await db.integrationConnection.findUnique({
      where: { organizationId_provider: { organizationId: ctx.organizationId, provider: "APOLLO" } },
    });
    if (!connection?.encryptedCredential || connection.state !== "CONNECTED") {
      return Response.json({ error: { code: "DISCONNECTED", message: "Apollo is not connected." }, correlationId: requestId }, { status: 409 });
    }

    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const usage = await db.integrationUsage.aggregate({
      _sum: { usageUnits: true },
      where: { organizationId: ctx.organizationId, provider: "APOLLO", createdAt: { gte: monthStart } },
    });
    const decision = decideBudget(usage._sum.usageUnits ?? 0, 1, Number(process.env.APOLLO_MONTHLY_OPERATION_LIMIT ?? 100));
    if (!decision.allowed) throw new ProviderError("BUDGET_BLOCKED", decision.reason);

    const company = await new ApolloClient(decryptCredential(connection.encryptedCredential)).company(providerId);
    await db.integrationUsage.create({
      data: { organizationId: ctx.organizationId, provider: "APOLLO", operation: "ORGANIZATION_DETAIL", outcome: "SUCCEEDED", usageUnits: 1, correlationId: requestId },
    });
    return Response.json({ company, correlationId: requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
