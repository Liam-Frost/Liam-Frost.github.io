-- CreateEnum
CREATE TYPE "ImageStorage" AS ENUM ('remote-url', 'local');

-- AlterTable
ALTER TABLE "Photo" ADD COLUMN     "storage" "ImageStorage" NOT NULL DEFAULT 'remote-url',
ADD COLUMN     "storageKey" TEXT,
ADD COLUMN     "variants" JSONB;
