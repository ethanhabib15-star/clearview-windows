import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(root, "..");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, "");
  const apiPort = env.API_PORT || "3001";
  const adminPort = env.ADMIN_DEV_PORT || "5174";
  const apiTarget = `http://127.0.0.1:${apiPort}`;
  const adminTarget = `http://127.0.0.1:${adminPort}`;

  return {
    root,
    publicDir: path.join(root, "public"),
    plugins: [react()],
    server: {
      host: true,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
        // Single dev URL: open http://localhost:5173/ and http://localhost:5173/admin/
        "/admin": {
          target: adminTarget,
          changeOrigin: true,
          ws: true,
        },
      },
    },
    preview: {
      host: true,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
        "/admin": {
          target: adminTarget,
          changeOrigin: true,
          ws: true,
        },
      },
    },
  };
});
