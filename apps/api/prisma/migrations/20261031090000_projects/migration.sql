-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('in-progress', 'completed', 'archived');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" JSONB NOT NULL,
    "summary" JSONB NOT NULL,
    "body" JSONB NOT NULL,
    "cover" JSONB,
    "gallery" JSONB NOT NULL,
    "techStack" JSONB NOT NULL,
    "links" JSONB NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'in-progress',
    "startedAt" TEXT,
    "endedAt" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "visibility" "Visibility" NOT NULL DEFAULT 'private',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- CreateIndex
CREATE INDEX "Project_visibility_sortOrder_idx" ON "Project"("visibility", "sortOrder");
