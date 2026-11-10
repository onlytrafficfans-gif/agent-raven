-- CreateTable
CREATE TABLE "ProspectSuppression" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "normalizedDomain" TEXT,
    "providerName" TEXT,
    "providerOrganizationId" TEXT,
    "reason" VARCHAR(80) NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProspectSuppression_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProspectSuppression_organizationId_createdAt_idx" ON "ProspectSuppression"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProspectSuppression_organizationId_normalizedDomain_key" ON "ProspectSuppression"("organizationId", "normalizedDomain");

-- CreateIndex
CREATE UNIQUE INDEX "ProspectSuppression_organizationId_providerName_providerOrg_key" ON "ProspectSuppression"("organizationId", "providerName", "providerOrganizationId");

-- AddForeignKey
ALTER TABLE "ProspectSuppression" ADD CONSTRAINT "ProspectSuppression_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectSuppression" ADD CONSTRAINT "ProspectSuppression_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
