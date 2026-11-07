ALTER TABLE "Person" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'person', ADD COLUMN "aliases" JSONB NOT NULL DEFAULT '[]';
CREATE TABLE "PersonIdentity" (
 "id" TEXT NOT NULL PRIMARY KEY, "personId" TEXT NOT NULL REFERENCES "Person"("id") ON DELETE CASCADE,
 "provider" TEXT NOT NULL, "externalId" TEXT NOT NULL, "confirmed" BOOLEAN NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX "PersonIdentity_provider_externalId_key" ON "PersonIdentity"("provider", "externalId");
CREATE INDEX "PersonIdentity_personId_idx" ON "PersonIdentity"("personId");
INSERT INTO "PersonIdentity" ("id","personId","provider","externalId","confirmed")
 SELECT 'legacy:' || "id", "id", 'tmdb', "sourceId", true FROM "Person" WHERE "source"='tmdb' AND "sourceId" IS NOT NULL;

CREATE TABLE "PersonMembership" (
 "groupId" TEXT NOT NULL REFERENCES "Person"("id") ON DELETE CASCADE,
 "personId" TEXT NOT NULL REFERENCES "Person"("id") ON DELETE CASCADE,
 "role" TEXT, "startYear" INTEGER, "endYear" INTEGER,
 PRIMARY KEY ("groupId", "personId"),
 CHECK ("groupId" <> "personId"),
 CHECK ("endYear" IS NULL OR "startYear" IS NULL OR "endYear" >= "startYear")
);
CREATE INDEX "PersonMembership_personId_idx" ON "PersonMembership"("personId");
