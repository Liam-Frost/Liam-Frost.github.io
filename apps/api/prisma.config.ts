import "dotenv/config";

import { defineConfig } from "prisma/config";

const databaseUrl = process.env.DATABASE_URL?.trim();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx src/db/seed.ts"
  },
  // `prisma generate` does not need a database, so CI can generate the client without DATABASE_URL.
  ...(databaseUrl ? { datasource: { url: databaseUrl } } : {})
});
