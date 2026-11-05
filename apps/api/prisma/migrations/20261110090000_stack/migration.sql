-- CreateEnum
CREATE TYPE "StackIconProvider" AS ENUM ('none', 'devicon', 'simpleicons', 'custom');

-- CreateEnum
CREATE TYPE "StackProminence" AS ENUM ('primary', 'standard');

-- CreateTable
CREATE TABLE "StackCategory" (
    "id" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "description" JSONB NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StackCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StackTechnology" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "iconProvider" "StackIconProvider" NOT NULL DEFAULT 'none',
    "iconKey" TEXT,
    "customIcon" JSONB,
    "websiteUrl" TEXT,
    "prominence" "StackProminence" NOT NULL DEFAULT 'standard',
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StackTechnology_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StackCategory_sortOrder_idx" ON "StackCategory"("sortOrder");

-- CreateIndex
CREATE INDEX "StackTechnology_categoryId_sortOrder_idx" ON "StackTechnology"("categoryId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "StackTechnology_categoryId_name_key" ON "StackTechnology"("categoryId", "name");

-- AddForeignKey
ALTER TABLE "StackTechnology" ADD CONSTRAINT "StackTechnology_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "StackCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- The tech stack the home page showed until now (apps/web/src/data/skills.ts), in its order. Runs once,
-- with the migration, so the admin's later changes are never overwritten; ON CONFLICT keeps a re-run
-- (e.g. a restored database) from adding anything twice. "core" skills became primary.
INSERT INTO "StackCategory" ("id", "name", "description", "visible", "sortOrder", "createdAt", "updatedAt") VALUES
  ('f0f11d0c-bbd4-43cc-8df8-64f1417979f4',
   '{"zh":"Frontend","zh-Hant":"Frontend","en":"Frontend","fr":"Frontend","ja":"Frontend"}',
   '{"zh":"前端工程与现代 Web 交付。","zh-Hant":"前端工程與現代 Web 交付。","en":"UI engineering and modern web delivery.","fr":"Ingénierie UI et delivery web moderne.","ja":"UI実装とモダンなWeb開発。"}',
   true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('408fd6b6-d152-4f96-841a-93e53f9dbcf9',
   '{"zh":"Backend","zh-Hant":"Backend","en":"Backend","fr":"Backend","ja":"Backend"}',
   '{"zh":"后端工程与性能和可靠性。","zh-Hant":"後端工程與效能和可靠性。","en":"Backend engineering, performance, and reliability.","fr":"Ingénierie backend, performance, fiabilité.","ja":"後端工程、性能、信頼性。"}',
   true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('9d487a5f-9e5c-49b2-8d69-1fd33d88be5e',
   '{"zh":"Creative","zh-Hant":"Creative","en":"Creative","fr":"Créatif","ja":"Creative"}',
   '{"zh":"设计工具与视觉 / 动效能力。","zh-Hant":"設計工具與視覺 / 動效能力。","en":"Design tools and visual/motion craft.","fr":"Outils design et sens du visuel/motion.","ja":"デザインツールと視覚／モーションの感覚。"}',
   true, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- Lightroom is in neither icon library (Simple Icons removed Adobe's logos): it shows its initials
-- until a logo is uploaded in the admin.
INSERT INTO "StackTechnology" ("id", "categoryId", "name", "iconProvider", "iconKey", "prominence", "visible", "sortOrder", "createdAt", "updatedAt") VALUES
  ('fbe4f958-0bbc-4c5b-8825-85a7e54a8113', 'f0f11d0c-bbd4-43cc-8df8-64f1417979f4', 'React', 'devicon', 'react', 'primary', true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('68c832f4-8a73-454f-8178-7c0bc235b809', 'f0f11d0c-bbd4-43cc-8df8-64f1417979f4', 'React Router', 'devicon', 'reactrouter', 'standard', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('3566cc22-bbf4-4b0c-8bb3-b800a46974d0', 'f0f11d0c-bbd4-43cc-8df8-64f1417979f4', 'CSS', 'devicon', 'css3', 'standard', true, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('794bc8fc-3cc7-400d-be17-2cd92873a8fa', 'f0f11d0c-bbd4-43cc-8df8-64f1417979f4', 'TypeScript', 'devicon', 'typescript', 'standard', true, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('3007dad0-42a8-42c7-9389-0a88d3851d32', 'f0f11d0c-bbd4-43cc-8df8-64f1417979f4', 'Vite', 'devicon', 'vitejs', 'standard', true, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('892dfd38-9665-47d7-88f5-ff0a2d5b9c2b', '408fd6b6-d152-4f96-841a-93e53f9dbcf9', 'Java', 'devicon', 'java', 'primary', true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('32184b64-06a1-4f18-8744-bc9589164729', '408fd6b6-d152-4f96-841a-93e53f9dbcf9', 'C++', 'devicon', 'cplusplus', 'standard', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('d600911d-23b5-41d9-82c6-8e27ae4d250b', '408fd6b6-d152-4f96-841a-93e53f9dbcf9', 'Python', 'devicon', 'python', 'standard', true, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('72591816-3030-4b81-8c5f-e345d5ceba1e', '408fd6b6-d152-4f96-841a-93e53f9dbcf9', 'Spring Boot', 'simpleicons', 'springboot', 'standard', true, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('6ad57cb9-3928-4033-b230-74ae3faa5a02', '9d487a5f-9e5c-49b2-8d69-1fd33d88be5e', 'Lightroom', 'none', NULL, 'primary', true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('b248d5a8-f011-4e90-a288-204a089595bf', '9d487a5f-9e5c-49b2-8d69-1fd33d88be5e', 'Photoshop', 'devicon', 'photoshop', 'standard', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('5e25a4c9-4a49-4d6c-bb93-3fe27ede1ce4', '9d487a5f-9e5c-49b2-8d69-1fd33d88be5e', 'After Effects', 'devicon', 'aftereffects', 'standard', true, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('98ed7d81-96eb-446f-a872-fa33527585b1', '9d487a5f-9e5c-49b2-8d69-1fd33d88be5e', 'DaVinci Resolve', 'simpleicons', 'davinciresolve', 'standard', true, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('8a979531-7fc4-4af4-9be4-f8ca19d77806', '9d487a5f-9e5c-49b2-8d69-1fd33d88be5e', 'Premiere', 'devicon', 'premierepro', 'standard', true, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
