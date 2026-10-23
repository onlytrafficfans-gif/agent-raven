import { AuthorizationError, requireContext } from "@/lib/authorization";
import { ApolloClient } from "@/lib/apollo";
import { decideBudget } from "@/lib/budget";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { correlationId, logEvent } from "@/lib/logger";
import { ProviderError } from "@/lib/provider-errors";
import { companySearchSchema } from "@/lib/schemas";
import { decryptCredential } from "@/lib/security";

export async function POST(request: Request) {
  const requestId = correlationId(request);
  try {
    const ctx = await requireContext(["OWNER", "ADMIN", "ANALYST"]);
    const input = companySearchSchema.parse(await request.json());
    const connection = await db.integrationConnection.findUnique({
      where: { organizationId_provider: { organizationId: ctx.organizationId, provider: "APOLLO" } },
    });
    if (!connection?.encryptedCredential || connection.state !== "CONNECTED") {
      throw new ProviderError("INVALID_CREDENTIAL", "Connect and test Apollo before searching.");
    }

    const start = new Date();
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
    const used = await db.integrationUsage.aggregate({
      _sum: { usageUnits: true },
      where: { organizationId: ctx.organizationId, provider: "APOLLO", createdAt: { gte: start } },
    });
    const decision = decideBudget(used._sum.usageUnits ?? 0, 1, Number(process.env.APOLLO_MONTHLY_OPERATION_LIMIT ?? 100));
    if (!decision.allowed) throw new ProviderError("BUDGET_BLOCKED", decision.reason);

    const query = await db.searchQuery.create({
      data: { organizationId: ctx.organizationId, provider: "APOLLO", filters: input },
    });
    try {
      const result = await new ApolloClient(decryptCredential(connection.encryptedCredential)).search(input);
      await db.$transaction([
        db.searchRun.create({
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
        }),
        db.integrationUsage.create({
          data: {
            organizationId: ctx.organizationId,
            provider: "APOLLO",
            operation: "ORGANIZATION_SEARCH",
            outcome: "SUCCEEDED",
            usageUnits: result.usageUnits,
            correlationId: requestId,
          },
        }),
      ]);
      return Response.json({ ...result, correlationId: requestId });
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
