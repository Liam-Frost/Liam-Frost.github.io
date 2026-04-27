import "dotenv/config";

import { photos } from "@liam-frost/content";
import { PrismaClient } from "@prisma/client";

type PhotoDelegate = {
  upsert: (args: unknown) => Promise<unknown>;
};

type PhotoPrismaClient = PrismaClient & {
  photo: PhotoDelegate;
};

const prisma = new PrismaClient() as PhotoPrismaClient;

async function main() {
  for (const [index, photo] of photos.entries()) {
    const data = {
      id: photo.id,
      slug: photo.id,
      title: photo.title,
      date: photo.date,
      category: photo.category,
      location: photo.location ?? null,
      camera: photo.camera ?? null,
      lens: photo.lens ?? null,
      settings: photo.settings ?? null,
      description: photo.description ?? null,
      tags: photo.tags,
      src: photo.src,
      alt: photo.alt,
      width: photo.width,
      height: photo.height,
      visibility: "public",
      sortOrder: index
    };

    await prisma.photo.upsert({
      where: { id: photo.id },
      update: data,
      create: data
    });
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
