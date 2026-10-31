import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv, type Plugin } from "vite";

import { ADMIN_PATH_META, isAdminPagePath, normalizeAdminPath } from "../../packages/shared/src/adminPath.ts";

/**
 * Dev only: mirror the API (apps/api/src/routes/admin-app.ts). The admin path is written into the page
 * only when the admin path itself is requested; any other URL renders the app's "not found" screen.
 */
function adminPathPlugin(adminPath: string): Plugin {
  return {
    name: "lf-admin-path",
    apply: "serve",
    transformIndexHtml: {
      order: "pre",
      handler(html, ctx) {
        const pathname = (ctx.originalUrl ?? ctx.path).split("?")[0];
        // The dev server serves everything from "/", so relative URLs in index.html must resolve against
        // the root even on nested routes like /admin/photos.
        const tags = ['<base href="/" />'];
        if (isAdminPagePath(pathname, adminPath)) {
          tags.push(`<meta name="${ADMIN_PATH_META}" content="${adminPath}" />`);
        }
        return html.replace("<head>", `<head>\n    ${tags.join("\n    ")}`);
      }
    }
  };
}

export default defineConfig(({ command, mode }) => {
  // Same ADMIN_PATH as the API reads (apps/api/.env or the environment), so dev and production agree.
  // PORT is deliberately not read from here: loadEnv also returns process.env, where PORT is this dev server's own port.
  const apiEnv = loadEnv(mode, "../api", "");
  // 127.0.0.1, not localhost: the API listens on IPv4 and localhost may resolve to ::1 first.
  const apiTarget = apiEnv.ADMIN_API_PROXY || "http://127.0.0.1:8787";

  return {
    // Relative asset URLs: the API serves the build under whatever ADMIN_PATH is configured,
    // and injects <base href="<ADMIN_PATH>/"> so nested routes still resolve ./assets/...
    base: command === "build" ? "./" : "/",
    plugins: [react(), tailwindcss(), adminPathPlugin(normalizeAdminPath(apiEnv.ADMIN_PATH))],
    server: {
      port: 5174,
      strictPort: true,
      proxy: {
        "/api": { target: apiTarget, changeOrigin: false },
        "/uploads": { target: apiTarget, changeOrigin: false }
      }
    },
    preview: { port: 4174 },
    build: { outDir: "dist", sourcemap: false }
  };
});
