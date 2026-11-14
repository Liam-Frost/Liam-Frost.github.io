-- Photo versions: several images of one photo, with one current. Existing photos get one version each.
ALTER TABLE "Photo" ADD COLUMN     "currentVersionId" TEXT;

-- CreateTable
CREATE TABLE "PhotoVersion" (
    "id" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "src" TEXT NOT NULL,
    "storage" "ImageStorage" NOT NULL,
    "storageKey" TEXT,
    "variants" JSONB,
    "source" JSONB,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PhotoVersion_storageKey_key" ON "PhotoVersion"("storageKey");

-- CreateIndex
CREATE INDEX "PhotoVersion_photoId_idx" ON "PhotoVersion"("photoId");

-- AddForeignKey
ALTER TABLE "PhotoVersion" ADD CONSTRAINT "PhotoVersion_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Every existing photo's image becomes its first, current version.
INSERT INTO "PhotoVersion" ("id", "photoId", "label", "src", "storage", "storageKey", "variants", "source", "width", "height", "createdAt")
SELECT gen_random_uuid()::text, "id", '', "src", "storage", "storageKey", "variants", "source", "width", "height", "createdAt"
FROM "Photo";

UPDATE "Photo" SET "currentVersionId" = "PhotoVersion"."id"
FROM "PhotoVersion"
WHERE "PhotoVersion"."photoId" = "Photo"."id";
