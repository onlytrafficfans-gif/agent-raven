import { requireContext } from "@/lib/authorization";
import { ApolloClient } from "@/lib/apollo";
import { runBudgetedApolloOperation } from "@/lib/budget";
import { db } from "@/lib/db";
import { correlatedJson, jsonError } from "@/lib/http";
import { correlationId } from "@/lib/logger";
import { enforceRateLimit } from "@/lib/rate-limit";
import { decryptCredential } from "@/lib/security";

export async function GET(request: Request, { params }: { params: Promise<{ providerId: string }> }) {
  const requestId = correlationId(request);
  try {
    const ctx = await requireContext(["OWNER", "ADMIN", "ANALYST"]);
    await enforceRateLimit({ organizationId: ctx.organizationId, userId: ctx.userId, policy: "apolloOperation" });
    const { providerId } = await params;
    const connection = await db.integrationConnection.findUnique({
      where: { organizationId_provider: { organizationId: ctx.organizationId, provider: "APOLLO" } },
    });
    if (!connection?.encryptedCredential || connection.state !== "CONNECTED") {
      return correlatedJson({ error: { code: "DISCONNECTED", message: "Apollo is not connected." } }, requestId, { status: 409 });
    }

    const company = await runBudgetedApolloOperation(
      {
        organizationId: ctx.organizationId,
        operation: "ORGANIZATION_DETAIL",
        correlationId: requestId,
        limit: Number(process.env.APOLLO_MONTHLY_OPERATION_LIMIT ?? 100),
      },
      () => new ApolloClient(decryptCredential(connection.encryptedCredential!)).company(providerId),
    );
    return correlatedJson({ company }, requestId);
  } catch (error) {
    return jsonError(error, requestId);
  }
}
