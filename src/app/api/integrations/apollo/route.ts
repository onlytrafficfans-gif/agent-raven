import { requireContext } from "@/lib/authorization";
import { ApolloClient } from "@/lib/apollo";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { correlationId, logEvent } from "@/lib/logger";
import { integrationCredentialSchema } from "@/lib/schemas";
import { encryptCredential } from "@/lib/security";

export async function POST(request: Request) {
  const requestId = correlationId(request);
  try {
    const ctx = await requireContext(["OWNER", "ADMIN"]);
    const { apiKey } = integrationCredentialSchema.parse(await request.json());
    await new ApolloClient(apiKey).testConnection();
    const encryptedCredential = encryptCredential(apiKey);
    const testedAt = new Date();
    await db.$transaction([
      db.integrationConnection.upsert({
        where: { organizationId_provider: { organizationId: ctx.organizationId, provider: "APOLLO" } },
        create: { organizationId: ctx.organizationId, provider: "APOLLO", state: "CONNECTED", encryptedCredential, credentialKeyId: "v1", lastTestedAt: testedAt, sanitizedDiagnostic: "Credential validated through Apollo auth health." },
        update: { state: "CONNECTED", encryptedCredential, credentialKeyId: "v1", lastTestedAt: testedAt, sanitizedDiagnostic: "Credential validated through Apollo auth health." },
      }),
      db.auditLog.create({
        data: { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "INTEGRATION_CONNECTED", targetType: "IntegrationConnection", correlationId: requestId, metadata: { provider: "APOLLO" } },
      }),
    ]);
    logEvent("info", "apollo.connected", { organizationId: ctx.organizationId, correlationId: requestId });
    return Response.json({ provider: "APOLLO", state: "CONNECTED", lastTestedAt: testedAt.toISOString(), correlationId: requestId });
  } catch (error) {
    logEvent("warn", "apollo.connection_failed", { correlationId: requestId, error: error instanceof Error ? error.message : "unknown" });
    return jsonError(error, requestId);
  }
}

export async function DELETE(request: Request) {
  const requestId = correlationId(request);
  try {
    const ctx = await requireContext(["OWNER", "ADMIN"]);
    await db.$transaction([
      db.integrationConnection.upsert({
        where: { organizationId_provider: { organizationId: ctx.organizationId, provider: "APOLLO" } },
        create: { organizationId: ctx.organizationId, provider: "APOLLO", state: "DISCONNECTED" },
        update: { state: "DISCONNECTED", encryptedCredential: null, credentialKeyId: null, sanitizedDiagnostic: "Disconnected by authorized user." },
      }),
      db.auditLog.create({
        data: { organizationId: ctx.organizationId, actorUserId: ctx.userId, action: "INTEGRATION_DISCONNECTED", targetType: "IntegrationConnection", correlationId: requestId, metadata: { provider: "APOLLO" } },
      }),
    ]);
    return Response.json({ state: "DISCONNECTED", correlationId: requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
