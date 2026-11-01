// Production build: bundles the API, the workspace packages (@liam-frost/*) and the generated Prisma
// client into dist/. npm dependencies stay external and are installed in the runtime image.
import { build } from "esbuild";
import { readFileSync, rmSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const external = Object.keys(pkg.dependencies)
  .filter((name) => !name.startsWith("@liam-frost/"))
  .flatMap((name) => [name, `${name}/*`]);

rmSync(new URL("../dist", import.meta.url), { recursive: true, force: true });

await build({
  entryPoints: {
    server: "src/server.ts",
    "hash-password": "src/auth/hash-password.ts",
    seed: "src/db/seed.ts"
  },
  outdir: "dist",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  splitting: true,
  sourcemap: true,
  external,
  // Bundled CommonJS code may call require(); give ESM output a real one.
  banner: {
    js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);'
  },
  logLevel: "info"
});
