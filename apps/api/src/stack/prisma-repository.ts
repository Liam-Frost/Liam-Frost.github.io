import type { LocalizedText, StackIconProvider, StackProminence } from "@liam-frost/shared";

import {
  Prisma,
  type PrismaClient,
  type StackCategory as PrismaCategory,
  type StackTechnology as PrismaTechnology
} from "../generated/prisma/client";
import type { StoredImage } from "../projects/types";
import type {
  NewStackCategory,
  NewStackTechnology,
  StackCategoryPatch,
  StackCategoryRow,
  StackLayout,
  StackRepository,
  StackTechnologyPatch,
  StackTechnologyRow
} from "./types";

const PROVIDER_TO_DB = {
  none: "NONE",
  devicon: "DEVICON",
  simpleicons: "SIMPLEICONS",
  custom: "CUSTOM"
} as const satisfies Record<StackIconProvider, PrismaTechnology["iconProvider"]>;
const PROVIDER_FROM_DB: Record<PrismaTechnology["iconProvider"], StackIconProvider> = {
  NONE: "none",
  DEVICON: "devicon",
  SIMPLEICONS: "simpleicons",
  CUSTOM: "custom"
};
const PROMINENCE_TO_DB = { primary: "PRIMARY", standard: "STANDARD" } as const;
const PROMINENCE_FROM_DB: Record<PrismaTechnology["prominence"], StackProminence> = {
  PRIMARY: "primary",
  STANDARD: "standard"
};

function toTechnology(record: PrismaTechnology): StackTechnologyRow {
  return {
    ...record,
    iconProvider: PROVIDER_FROM_DB[record.iconProvider],
    customIcon: record.customIcon as StoredImage | null,
    prominence: PROMINENCE_FROM_DB[record.prominence]
  };
}

function toCategory(
  record: PrismaCategory & { technologies: PrismaTechnology[] }
): StackCategoryRow {
  return {
    ...record,
    name: record.name as LocalizedText,
    description: record.description as LocalizedText,
    technologies: record.technologies.map(toTechnology)
  };
}

function technologyData(patch: StackTechnologyPatch): Prisma.StackTechnologyUncheckedUpdateInput {
  const { iconProvider, prominence, customIcon, ...rest } = patch;
  const data: Prisma.StackTechnologyUncheckedUpdateInput = { ...rest };
  if (iconProvider !== undefined) data.iconProvider = PROVIDER_TO_DB[iconProvider];
  if (prominence !== undefined) data.prominence = PROMINENCE_TO_DB[prominence];
  if (customIcon !== undefined) data.customIcon = customIcon === null ? Prisma.DbNull : customIcon;
  return data;
}

const isMissing = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";

const ORDER = [{ sortOrder: "asc" }, { createdAt: "asc" }] as const;

export class PrismaStackRepository implements StackRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list() {
    const records = await this.prisma.stackCategory.findMany({
      orderBy: [...ORDER],
      include: { technologies: { orderBy: [...ORDER] } }
    });
    return records.map(toCategory);
  }

  private async nextTechnologyOrder(
    categoryId: string,
    client: Prisma.TransactionClient = this.prisma
  ) {
    const max = await client.stackTechnology.aggregate({
      where: { categoryId },
      _max: { sortOrder: true }
    });
    return (max._max.sortOrder ?? -1) + 1;
  }

  async createCategory(category: NewStackCategory) {
    const max = await this.prisma.stackCategory.aggregate({ _max: { sortOrder: true } });
    await this.prisma.stackCategory.create({
      data: { ...category, sortOrder: (max._max.sortOrder ?? -1) + 1 }
    });
  }

  async updateCategory(id: string, patch: StackCategoryPatch) {
    try {
      await this.prisma.stackCategory.update({ where: { id }, data: patch });
      return true;
    } catch (error) {
      if (isMissing(error)) return false;
      throw error;
    }
  }

  async deleteCategory(id: string) {
    try {
      await this.prisma.stackCategory.delete({ where: { id } });
      return true;
    } catch (error) {
      if (isMissing(error)) return false;
      throw error;
    }
  }

  async createTechnology(technology: NewStackTechnology) {
    await this.prisma.stackTechnology.create({
      data: {
        ...technology,
        iconProvider: PROVIDER_TO_DB[technology.iconProvider],
        prominence: PROMINENCE_TO_DB[technology.prominence],
        sortOrder: await this.nextTechnologyOrder(technology.categoryId)
      }
    });
  }

  async updateTechnology(id: string, patch: StackTechnologyPatch) {
    try {
      await this.prisma.$transaction(async (tx) => {
        const data = technologyData(patch);
        if (patch.categoryId !== undefined) {
          const current = await tx.stackTechnology.findUniqueOrThrow({ where: { id } });
          if (current.categoryId !== patch.categoryId)
            data.sortOrder = await this.nextTechnologyOrder(patch.categoryId, tx);
        }
        await tx.stackTechnology.update({ where: { id }, data });
      });
      return true;
    } catch (error) {
      if (isMissing(error)) return false;
      throw error;
    }
  }

  async deleteTechnology(id: string) {
    try {
      await this.prisma.stackTechnology.delete({ where: { id } });
      return true;
    } catch (error) {
      if (isMissing(error)) return false;
      throw error;
    }
  }

  async moveTechnologies(fromId: string, toId: string) {
    await this.prisma.$transaction(async (tx) => {
      const start = await this.nextTechnologyOrder(toId, tx);
      const moving = await tx.stackTechnology.findMany({
        where: { categoryId: fromId },
        orderBy: [...ORDER],
        select: { id: true }
      });
      for (const [index, { id }] of moving.entries()) {
        await tx.stackTechnology.update({
          where: { id },
          data: { categoryId: toId, sortOrder: start + index }
        });
      }
    });
  }

  async reorder(layout: StackLayout) {
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.stackTechnology.findMany({
        select: { id: true, categoryId: true, name: true }
      });
      const target = new Map(
        layout.flatMap((category) => category.technologies.map((id) => [id, category.id] as const))
      );
      const moving = current.filter(
        (t) => target.get(t.id) !== undefined && target.get(t.id) !== t.categoryId
      );
      // (categoryId, name) is unique and checked on every statement. Swapping two namesakes between
      // categories would collide halfway, so technologies changing category first get a placeholder
      // name no real one can have (names cannot contain control characters), and their own name back
      // once they are in place.
      for (const t of moving) {
        await tx.stackTechnology.update({ where: { id: t.id }, data: { name: `\u0001${t.id}` } });
      }
      const names = new Map(moving.map((t) => [t.id, t.name]));
      for (const [index, category] of layout.entries()) {
        await tx.stackCategory.update({ where: { id: category.id }, data: { sortOrder: index } });
        for (const [position, id] of category.technologies.entries()) {
          await tx.stackTechnology.update({
            where: { id },
            data: {
              categoryId: category.id,
              sortOrder: position,
              ...(names.has(id) ? { name: names.get(id)! } : {})
            }
          });
        }
      }
    });
  }
}
