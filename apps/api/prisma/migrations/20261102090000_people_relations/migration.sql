-- CreateEnum
CREATE TYPE "RelationType" AS ENUM ('soundtrack', 'adaptation', 'sequel', 'related', 'credit');

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceId" TEXT,
    "sourceUrl" TEXT,
    "name" JSONB NOT NULL,
    "originalName" TEXT,
    "photo" JSONB,
    "bio" JSONB NOT NULL,
    "links" JSONB NOT NULL,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "visibility" "Visibility" NOT NULL DEFAULT 'public',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaRelation" (
    "id" TEXT NOT NULL,
    "fromMediaId" TEXT,
    "fromPersonId" TEXT,
    "toMediaId" TEXT NOT NULL,
    "type" "RelationType" NOT NULL,
    "role" TEXT,
    "note" JSONB NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaRelation_pkey" PRIMARY KEY ("id"),
    -- A relation starts at an entry or a person, never both.
    CONSTRAINT "MediaRelation_one_start" CHECK (("fromMediaId" IS NULL) <> ("fromPersonId" IS NULL))
);

-- CreateIndex
CREATE UNIQUE INDEX "Person_source_sourceId_key" ON "Person"("source", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaRelation_key_key" ON "MediaRelation"("key");

-- CreateIndex
CREATE INDEX "MediaRelation_fromMediaId_idx" ON "MediaRelation"("fromMediaId");

-- CreateIndex
CREATE INDEX "MediaRelation_fromPersonId_idx" ON "MediaRelation"("fromPersonId");

-- CreateIndex
CREATE INDEX "MediaRelation_toMediaId_idx" ON "MediaRelation"("toMediaId");

-- AddForeignKey
ALTER TABLE "MediaRelation" ADD CONSTRAINT "MediaRelation_fromMediaId_fkey" FOREIGN KEY ("fromMediaId") REFERENCES "MediaItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaRelation" ADD CONSTRAINT "MediaRelation_fromPersonId_fkey" FOREIGN KEY ("fromPersonId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaRelation" ADD CONSTRAINT "MediaRelation_toMediaId_fkey" FOREIGN KEY ("toMediaId") REFERENCES "MediaItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
