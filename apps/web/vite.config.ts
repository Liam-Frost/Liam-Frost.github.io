import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig(({ mode }) => {
  // Like the admin's ADMIN_API_PROXY: WEB_API_PROXY (apps/api/.env or the environment) points the
  // dev server at an API on another port.
  const apiEnv = loadEnv(mode, "../api", "");
  const api = { target: apiEnv.WEB_API_PROXY || "http://localhost:8787", changeOrigin: true };

  return {
    plugins: [react()],
    base: "./",
    server: {
      proxy: {
        "/api": api,
        // Uploaded photo sizes are served by the API.
        "/uploads": api
      }
    }
  };
});
