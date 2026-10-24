DROP INDEX IF EXISTS "Membership_userId_idx";
CREATE UNIQUE INDEX "Membership_userId_key" ON "Membership"("userId");
