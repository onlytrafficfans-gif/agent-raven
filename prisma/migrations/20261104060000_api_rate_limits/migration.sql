CREATE TABLE "ApiRateLimitBucket" (
    "organizationId" UUID NOT NULL,
    "bucketKey" VARCHAR(160) NOT NULL,
    "windowStart" TIMESTAMP(3) WITH TIME ZONE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ApiRateLimitBucket_pkey" PRIMARY KEY ("organizationId", "bucketKey", "windowStart")
);

CREATE INDEX "ApiRateLimitBucket_windowStart_idx" ON "ApiRateLimitBucket"("windowStart");

ALTER TABLE "ApiRateLimitBucket"
ADD CONSTRAINT "ApiRateLimitBucket_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
