-- The trash: deleted photos and versions are marked, then removed for good after the retention period.
ALTER TABLE "Photo" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PhotoVersion" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Photo_deletedAt_idx" ON "Photo"("deletedAt");

-- CreateIndex
CREATE INDEX "PhotoVersion_deletedAt_idx" ON "PhotoVersion"("deletedAt");

