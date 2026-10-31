// Tests must not depend on a developer's local apps/api/.env or a running database.
// Keys are set to "" rather than deleted: dotenv never overrides an existing key, so a local .env cannot fill them in.
for (const key of Object.keys(process.env)) {
  if (key.startsWith("ADMIN_")) {
    delete process.env[key];
  }
}
process.env.DATABASE_URL = "";
