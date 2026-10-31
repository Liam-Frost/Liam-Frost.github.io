-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('public', 'private');

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" JSONB NOT NULL,
    "date" TEXT NOT NULL,
    "category" JSONB NOT NULL,
    "location" JSONB,
    "camera" TEXT,
    "lens" TEXT,
    "settings" TEXT,
    "description" JSONB,
    "tags" JSONB NOT NULL,
    "src" TEXT NOT NULL,
    "alt" JSONB NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "visibility" "Visibility" NOT NULL DEFAULT 'public',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Photo_slug_key" ON "Photo"("slug");

-- CreateIndex
CREATE INDEX "Photo_visibility_sortOrder_idx" ON "Photo"("visibility", "sortOrder");

-- CreateIndex
CREATE INDEX "Photo_date_idx" ON "Photo"("date");
