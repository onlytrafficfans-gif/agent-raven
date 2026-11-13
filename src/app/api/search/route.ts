import { AuthorizationError, requireContext } from "@/lib/authorization";
import { ApolloClient } from "@/lib/apollo";
import { runBudgetedApolloOperation } from "@/lib/budget";
import { db } from "@/lib/db";
import { correlatedJson, jsonError } from "@/lib/http";
import { correlationId, logEvent } from "@/lib/logger";
import { ProviderError } from "@/lib/provider-errors";
import { enforceRateLimit } from "@/lib/rate-limit";
import { companySearchSchema } from "@/lib/schemas";
import { decryptCredential } from "@/lib/security";

export async function POST(request: Request) {
  const requestId = correlationId(request);
  try {
    const ctx = await requireContext(["OWNER", "ADMIN", "ANALYST"]);
    await enforceRateLimit({ organizationId: ctx.organizationId, userId: ctx.userId, policy: "apolloOperation" });
    const input = companySearchSchema.parse(await request.json());
    const connection = await db.integrationConnection.findUnique({
      where: { organizationId_provider: { organizationId: ctx.organizationId, provider: "APOLLO" } },
    });
    if (!connection?.encryptedCredential || connection.state !== "CONNECTED") {
      throw new ProviderError("INVALID_CREDENTIAL", "Connect and test Apollo before searching.");
    }

    const query = await db.searchQuery.create({
      data: { organizationId: ctx.organizationId, provider: "APOLLO", filters: input },
    });
    try {
      const result = await runBudgetedApolloOperation(
        {
          organizationId: ctx.organizationId,
          operation: "ORGANIZATION_SEARCH",
          correlationId: requestId,
          limit: Number(process.env.APOLLO_MONTHLY_OPERATION_LIMIT ?? 100),
        },
        () => new ApolloClient(decryptCredential(connection.encryptedCredential!)).search(input),
      );
      await db.searchRun.create({
        data: {
          organizationId: ctx.organizationId,
          searchQueryId: query.id,
          runByUserId: ctx.userId,
          provider: "APOLLO",
          page: result.page,
          perPage: result.perPage,
          outcome: result.companies.length ? "SUCCEEDED" : "EMPTY",
          resultCount: result.companies.length,
          usageUnits: result.usageUnits,
          correlationId: requestId,
        },
      });
      return correlatedJson({ ...result }, requestId);
    } catch (error) {
      if (error instanceof ProviderError) {
        await db.searchRun.create({
          data: {
            organizationId: ctx.organizationId,
            searchQueryId: query.id,
            runByUserId: ctx.userId,
            provider: "APOLLO",
            page: input.page,
            perPage: input.perPage,
            outcome: error.code,
            errorCategory: error.code,
            correlationId: requestId,
          },
        });
      }
      throw error;
    }
  } catch (error) {
    if (!(error instanceof AuthorizationError)) {
      logEvent("warn", "apollo.search_failed", { correlationId: requestId, error: error instanceof Error ? error.message : "unknown" });
    }
    return jsonError(error, requestId);
  }
}
