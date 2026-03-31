import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(root, "..");

function redirectAdminToAdminDevServer(adminPort) {
  const targetOrigin = `http://localhost:${adminPort}`;
  return {
    name: "redirect-admin-to-admin-dev-server",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = String(req.url || "");
        if (url === "/admin" || url.startsWith("/admin/")) {
          const targetUrl = `${targetOrigin}${url}`;
          res.statusCode = 200;
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Opening Admin...</title>
    <style>
      body{margin:0;font-family:Inter,system-ui,sans-serif;background:#090b10;color:#f5f5f5;display:grid;place-items:center;min-height:100vh}
      .card{max-width:560px;padding:1rem 1.2rem;border:1px solid rgba(255,255,255,.14);background:#111;border-radius:12px}
      a{color:#ef4444}
      p{margin:.45rem 0}
    </style>
  </head>
  <body>
    <div class="card">
      <h1 style="margin:0 0 .6rem;font-size:1.05rem;">Opening Admin Dashboard...</h1>
      <p>Redirecting to <a href="${targetUrl}">${targetUrl}</a></p>
      <p style="color:#a1a1a1;">If it does not open automatically, click the link above.</p>
    </div>
    <script>window.location.replace(${JSON.stringify(targetUrl)});</script>
  </body>
</html>`);
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, "");
  // Must match the Node API (server uses PORT || API_PORT). Default 3001 only if unset.
  const apiPort = String(env.API_PORT || env.PORT || "3001").trim() || "3001";
  const adminPort = String(env.ADMIN_DEV_PORT || "5174").trim() || "5174";
  const apiTarget = `http://127.0.0.1:${apiPort}`;
  const adminTarget = `http://127.0.0.1:${adminPort}`;

  return {
    root,
    publicDir: path.join(root, "public"),
    plugins: [react(), redirectAdminToAdminDevServer(adminPort)],
    resolve: {
      alias: {
        "@shared": path.join(projectRoot, "shared"),
      },
    },
    server: {
      host: true,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
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
          secure: false,
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
