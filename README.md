# ClearView Windows — marketing site + admin

Two Vite + React apps (`client/` public site, `admin/` dashboard) and a small Express API for contact messages and invoices.

## Setup

```bash
npm install
cp .env.example .env
# Edit .env — set ADMIN_KEY to a strong secret
npm run dev
```

- **Site:** [http://localhost:5173/](http://localhost:5173/)
- **Admin (recommended in dev):** [http://localhost:5173/admin/](http://localhost:5173/admin/) — the client dev server proxies to the admin app, so one origin and `/api` works.
- **Admin (direct):** [http://localhost:5174/admin/](http://localhost:5174/admin/) if you need to open the admin Vite app alone (same `ADMIN_KEY`).

With **`npm run build`** then **`npm run start`**, both are served from the API: site at `/`, admin at `/admin/`. If pages are blank, ensure port **3001** is free for the API and run **`npm run build`** at least once.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | API `:3001` + client Vite `:5173` + admin Vite `:5174` |
| `npm run build` | `client/dist` + `admin/dist` |
| `npm run preview:client` / `preview:admin` | Preview a built app (with `/api` proxy) |
| `npm run start` | API + static files from `client/dist` and `admin/dist` |

## Environment

- `ADMIN_KEY` — required for `/api/admin/*` and admin UI login.
- `API_PORT` — optional; default `3001` (must match `.env` used by Vite proxies).
- `ADMIN_DEV_PORT` — optional; default `5174`. Change in `.env` if that port is busy; client and admin configs both read it.

Message and invoice JSON files are created at runtime under `server/` and are gitignored.

## Push to GitHub

GitHub needs a one-time browser login (no one can push for you without your account). From the project folder:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\publish-github.ps1
```

That signs you in with `gh` (if needed), creates `ethanhabib15-star/clearview-windows` if it does not exist, then runs `git push -u origin main`.

## Deploy notes

Run `npm run build`, then serve `client/dist` and `admin/dist` from the same origin as the API (this repo’s `server/index.js` does that). The API must be reachable where the browser can call it (same origin or CORS).
