-- CreateTable
CREATE TABLE "ProjectTechnology" (
    "projectId" TEXT NOT NULL,
    "technologyId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectTechnology_pkey" PRIMARY KEY ("projectId","technologyId")
);

-- CreateIndex
CREATE INDEX "ProjectTechnology_technologyId_idx" ON "ProjectTechnology"("technologyId");

-- AddForeignKey
ALTER TABLE "ProjectTechnology" ADD CONSTRAINT "ProjectTechnology_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTechnology" ADD CONSTRAINT "ProjectTechnology_technologyId_fkey" FOREIGN KEY ("technologyId") REFERENCES "StackTechnology"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Links the projects' technology names (Project.techStack) to the technologies of the stack.
-- A name matches a technology when both are equal ignoring case, spaces, '.', '-' and '_', or are
-- common names of the same thing (the aliases below; the same list as src/projects/technology-matching.ts).
-- Names that match no technology, or more than one, stay in techStack as plain names, where the admin
-- shows them; `npm run db:link-project-technologies` reports them and links any that match later.
-- Linked names leave techStack: the link is the only record of them from now on.
CREATE TEMPORARY TABLE "_TechnologyAlias" ("alias" TEXT PRIMARY KEY, "canonical" TEXT NOT NULL);
INSERT INTO "_TechnologyAlias" ("alias", "canonical") VALUES
  ('reactjs', 'react'),
  ('vuejs', 'vue'),
  ('node', 'nodejs'),
  ('golang', 'go'),
  ('postgres', 'postgresql'),
  ('js', 'javascript'),
  ('ts', 'typescript'),
  ('cpp', 'c++'),
  ('css3', 'css'),
  ('html5', 'html'),
  ('k8s', 'kubernetes'),
  ('premiere', 'premierepro'),
  ('adobepremierepro', 'premierepro'),
  ('adobephotoshop', 'photoshop'),
  ('adobeaftereffects', 'aftereffects'),
  ('adobelightroom', 'lightroom'),
  ('lightroomclassic', 'lightroom'),
  ('davinci', 'davinciresolve');

CREATE TEMPORARY TABLE "_TechnologyKey" ("id" TEXT PRIMARY KEY, "key" TEXT NOT NULL);
INSERT INTO "_TechnologyKey" ("id", "key")
SELECT t."id", coalesce(a."canonical", k."key")
FROM "StackTechnology" t
CROSS JOIN LATERAL (SELECT regexp_replace(lower(btrim(t."name")), '[[:space:]._-]+', '', 'g') AS "key") k
LEFT JOIN "_TechnologyAlias" a ON a."alias" = k."key";
-- Keys shared by several technologies (namesakes in two categories) are ambiguous: not linked.
DELETE FROM "_TechnologyKey" WHERE "key" IN (SELECT "key" FROM "_TechnologyKey" GROUP BY "key" HAVING count(*) > 1);

CREATE TEMPORARY TABLE "_ProjectTechnologyName" ("projectId" TEXT NOT NULL, "position" BIGINT NOT NULL, "key" TEXT NOT NULL);
INSERT INTO "_ProjectTechnologyName" ("projectId", "position", "key")
SELECT p."id", e."ordinality" - 1, coalesce(a."canonical", k."key")
FROM "Project" p
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE WHEN jsonb_typeof(p."techStack") = 'array' THEN p."techStack" ELSE '[]'::jsonb END
) WITH ORDINALITY AS e("value", "ordinality")
CROSS JOIN LATERAL (SELECT regexp_replace(lower(btrim(e."value")), '[[:space:]._-]+', '', 'g') AS "key") k
LEFT JOIN "_TechnologyAlias" a ON a."alias" = k."key";

INSERT INTO "ProjectTechnology" ("projectId", "technologyId", "sortOrder")
SELECT DISTINCT ON (n."projectId", t."id") n."projectId", t."id", n."position"
FROM "_ProjectTechnologyName" n
JOIN "_TechnologyKey" t ON t."key" = n."key"
ORDER BY n."projectId", t."id", n."position"
ON CONFLICT DO NOTHING;

UPDATE "Project" p
SET "techStack" = coalesce((
  SELECT jsonb_agg(e."value" ORDER BY e."ordinality")
  FROM jsonb_array_elements_text(p."techStack") WITH ORDINALITY AS e("value", "ordinality")
  CROSS JOIN LATERAL (SELECT regexp_replace(lower(btrim(e."value")), '[[:space:]._-]+', '', 'g') AS "key") k
  LEFT JOIN "_TechnologyAlias" a ON a."alias" = k."key"
  WHERE coalesce(a."canonical", k."key") NOT IN (SELECT "key" FROM "_TechnologyKey")
), '[]'::jsonb)
WHERE jsonb_typeof(p."techStack") = 'array'
  AND EXISTS (SELECT 1 FROM "_ProjectTechnologyName" n JOIN "_TechnologyKey" t ON t."key" = n."key" WHERE n."projectId" = p."id");

DROP TABLE "_ProjectTechnologyName", "_TechnologyKey", "_TechnologyAlias";
