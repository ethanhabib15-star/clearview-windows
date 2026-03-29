import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(root, "..");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, "");
  const apiPort = env.API_PORT || "3001";
  const adminPort = Number(env.ADMIN_DEV_PORT) || 5174;

  return {
    root,
    base: "/admin/",
    publicDir: path.join(root, "public"),
    plugins: [react()],
    server: {
      host: true,
      port: adminPort,
      strictPort: true,
      proxy: {
        "/api": {
          target: `http://127.0.0.1:${apiPort}`,
          changeOrigin: true,
        },
      },
    },
    preview: {
      host: true,
      port: Number(env.ADMIN_PREVIEW_PORT) || 4174,
      proxy: {
        "/api": {
          target: `http://127.0.0.1:${apiPort}`,
          changeOrigin: true,
        },
      },
    },
  };
});
