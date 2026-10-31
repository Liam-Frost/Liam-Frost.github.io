import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

const api = { target: "http://localhost:8787", changeOrigin: true };

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
