CREATE TABLE "PublicRateLimitBucket" (
    "bucketKey" VARCHAR(160) NOT NULL,
    "windowStart" TIMESTAMP(3) WITH TIME ZONE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "PublicRateLimitBucket_pkey" PRIMARY KEY ("bucketKey", "windowStart")
);

CREATE INDEX "PublicRateLimitBucket_windowStart_idx" ON "PublicRateLimitBucket"("windowStart");
