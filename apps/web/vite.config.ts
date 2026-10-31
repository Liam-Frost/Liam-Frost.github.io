import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

// WEB_API_PROXY points the dev server at an API on another port.
const api = { target: process.env.WEB_API_PROXY || "http://localhost:8787", changeOrigin: true };

export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    proxy: {
      "/api": api,
      // Uploaded photo sizes are served by the API.
      "/uploads": api
    }
  }
});
