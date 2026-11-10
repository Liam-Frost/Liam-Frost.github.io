-- Every site-hosted image folder, registered for duplicate detection, the trash and the storage scan.
CREATE TABLE "ImageAsset" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "originalName" TEXT,
    "format" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "totalBytes" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "variants" JSONB NOT NULL,
    "sha256" TEXT,
    "uploadId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "trashedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImageAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ImageAsset_storageKey_key" ON "ImageAsset"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "ImageAsset_uploadId_key" ON "ImageAsset"("uploadId");

-- CreateIndex
CREATE INDEX "ImageAsset_sha256_idx" ON "ImageAsset"("sha256");

-- CreateIndex
CREATE INDEX "ImageAsset_ownerType_ownerId_idx" ON "ImageAsset"("ownerType", "ownerId");

-- CreateIndex
CREATE INDEX "ImageAsset_status_idx" ON "ImageAsset"("status");

