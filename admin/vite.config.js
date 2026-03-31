import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(root, "..");

/** With base `/admin/`, the app lives at /admin/ — / alone 404s; send users to the SPA entry. */
function redirectRootToAdmin() {
  return {
    name: "redirect-root-to-admin",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathOnly = (req.url || "").split("?")[0] || "";
        if (pathOnly === "/" || pathOnly === "") {
          res.writeHead(302, { Location: "/admin/" });
          res.end();
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, projectRoot, "");
  const apiPort = String(env.API_PORT || env.PORT || "3001").trim() || "3001";
  const localhostPort =
    Number.parseInt(String(env.ADMIN_DEV_PORT || "5174").trim(), 10) || 5174;
  const viteSupabaseUrl = String(env.VITE_SUPABASE_URL || env.SUPABASE_URL || "").trim();
  const viteSupabaseAnonKey = String(
    env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || ""
  ).trim();
  const isDevServer = command === "serve";

  return {
    root,
    envDir: projectRoot,
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(viteSupabaseUrl),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(viteSupabaseAnonKey),
    },
    // In dev, Vite runtime modules are served from root (/@vite, /@react-refresh, /@fs).
    // Keep /admin/ only for production build output paths.
    base: isDevServer ? "/" : "/admin/",
    publicDir: path.join(root, "public"),
    plugins: [react(), redirectRootToAdmin()],
    resolve: {
      alias: {
        "@shared": path.join(projectRoot, "shared"),
      },
    },
    server: {
      host: "localhost",
      port: localhostPort,
      strictPort: true,
      proxy: {
        "/api": {
          target: `http://localhost:${apiPort}`,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    preview: {
      host: "localhost",
      port: localhostPort,
      proxy: {
        "/api": {
          target: `http://localhost:${apiPort}`,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
