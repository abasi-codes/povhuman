import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5999,
    proxy: {
      "/sessions": "http://localhost:3000",
      "/webhooks": "http://localhost:3000",
      "/health": "http://localhost:3000",
    },
  },
});
