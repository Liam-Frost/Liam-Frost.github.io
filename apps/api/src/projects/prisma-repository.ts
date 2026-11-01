import type { LocalizedText, ProjectLinks, ProjectStatus } from "@liam-frost/shared";

import {
  Prisma,
  type PrismaClient,
  type Project as PrismaProject
} from "../generated/prisma/client";
import {
  SlugTakenError,
  type NewProject,
  type ProjectPatch,
  type ProjectRepository,
  type ProjectRow,
  type StoredImage
} from "./types";

const ORDER = [
  { sortOrder: "asc" },
  { createdAt: "desc" }
] satisfies Prisma.ProjectOrderByWithRelationInput[];

const STATUS_TO_DB = {
  "in-progress": "IN_PROGRESS",
  completed: "COMPLETED",
  archived: "ARCHIVED"
} as const;
const STATUS_FROM_DB: Record<PrismaProject["status"], ProjectStatus> = {
  IN_PROGRESS: "in-progress",
  COMPLETED: "completed",
  ARCHIVED: "archived"
};

function toRow(record: PrismaProject): ProjectRow {
  return {
    ...record,
    title: record.title as LocalizedText,
    summary: record.summary as LocalizedText,
    body: record.body as LocalizedText,
    cover: record.cover as StoredImage | null,
    gallery: record.gallery as StoredImage[],
    techStack: record.techStack as string[],
    links: record.links as ProjectLinks,
    status: STATUS_FROM_DB[record.status],
    visibility: record.visibility === "PRIVATE" ? "private" : "public"
  };
}

function toData(patch: ProjectPatch): Prisma.ProjectUpdateInput {
  const { cover, status, visibility, ...rest } = patch;
  const data: Prisma.ProjectUpdateInput = { ...rest };
  if (cover !== undefined) data.cover = cover === null ? Prisma.DbNull : cover;
  if (status !== undefined) data.status = STATUS_TO_DB[status];
  if (visibility !== undefined) data.visibility = visibility === "private" ? "PRIVATE" : "PUBLIC";
  return data;
}

function isSlugConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function isMissing(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

export class PrismaProjectRepository implements ProjectRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list({ includePrivate = false } = {}) {
    const records = await this.prisma.project.findMany({
      where: includePrivate ? undefined : { visibility: "PUBLIC" },
      orderBy: ORDER
    });
    return records.map(toRow);
  }

  async get(id: string) {
    const record = await this.prisma.project.findUnique({ where: { id } });
    return record ? toRow(record) : null;
  }

  async imageAccess(id: string) {
    const record = await this.prisma.project.findUnique({
      where: { id },
      select: { visibility: true, cover: true, gallery: true }
    });
    if (!record) return null;
    return {
      visibility: record.visibility === "PRIVATE" ? ("private" as const) : ("public" as const),
      cover: record.cover as StoredImage | null,
      gallery: record.gallery as StoredImage[]
    };
  }

  async getBySlug(slug: string) {
    const record = await this.prisma.project.findUnique({ where: { slug } });
    return record ? toRow(record) : null;
  }

  async create(project: NewProject) {
    const min =
      (await this.prisma.project.aggregate({ _min: { sortOrder: true } }))._min.sortOrder ?? 1;
    try {
      const record = await this.prisma.project.create({
        data: {
          ...project,
          summary: {},
          body: {},
          gallery: [],
          techStack: [],
          links: {},
          visibility: "PRIVATE",
          sortOrder: min - 1
        }
      });
      return toRow(record);
    } catch (error) {
      if (isSlugConflict(error)) throw new SlugTakenError(project.slug);
      throw error;
    }
  }

  async update(id: string, patch: ProjectPatch) {
    try {
      return toRow(await this.prisma.project.update({ where: { id }, data: toData(patch) }));
    } catch (error) {
      if (isMissing(error)) return null;
      if (isSlugConflict(error)) throw new SlugTakenError(patch.slug ?? "");
      throw error;
    }
  }

  async delete(id: string) {
    try {
      return toRow(await this.prisma.project.delete({ where: { id } }));
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
  }

  async reorder(ids: string[]) {
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.project.update({ where: { id }, data: { sortOrder: index } })
      )
    );
  }
}
