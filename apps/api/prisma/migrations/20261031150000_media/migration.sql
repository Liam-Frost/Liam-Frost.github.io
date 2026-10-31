-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('movie', 'tv', 'anime', 'track', 'album');

-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('want', 'watching', 'done', 'dropped');

-- CreateTable
CREATE TABLE "MediaItem" (
    "id" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "source" TEXT NOT NULL,
    "sourceId" TEXT,
    "sourceUrl" TEXT,
    "title" JSONB NOT NULL,
    "originalTitle" TEXT,
    "year" INTEGER,
    "genres" JSONB NOT NULL,
    "credits" JSONB NOT NULL,
    "overview" JSONB NOT NULL,
    "poster" JSONB,
    "status" "MediaStatus",
    "rating" INTEGER,
    "review" JSONB NOT NULL,
    "watchedOn" TEXT,
    "rewatchCount" INTEGER NOT NULL DEFAULT 0,
    "progress" JSONB,
    "extra" JSONB NOT NULL,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "visibility" "Visibility" NOT NULL DEFAULT 'public',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MediaItem_kind_visibility_idx" ON "MediaItem"("kind", "visibility");

-- CreateIndex
CREATE UNIQUE INDEX "MediaItem_source_sourceId_key" ON "MediaItem"("source", "sourceId");
