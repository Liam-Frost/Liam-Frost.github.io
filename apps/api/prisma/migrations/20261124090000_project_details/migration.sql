-- What the owner did in a project (ProjectDetails in packages/shared); existing projects have none.
ALTER TABLE "Project" ADD COLUMN "details" JSONB NOT NULL DEFAULT '{}';
