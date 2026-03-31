# ClearView Windows — marketing site + admin

Two Vite + React apps (`client/` public site, `admin/` dashboard) and a small Express API for contact messages and invoices.

## Setup

```bash
npm install
cp .env.example .env
# Edit .env — configure Supabase admin auth (see Environment below)
npm run dev
```

- **Site:** [http://localhost:5173/](http://localhost:5173/)
- **Admin (recommended in dev):** [http://localhost:5173/admin/](http://localhost:5173/admin/) — the client dev server proxies to the admin app, so one origin and `/api` works.
- **Admin (direct):** `http://localhost:<ADMIN_DEV_PORT>/admin/` — port is in `.env` (`ADMIN_DEV_PORT`, default **5174**). Example: [http://localhost:5174/admin/](http://localhost:5174/admin/). Opening the bare origin (e.g. `http://localhost:5174/`) redirects to `/admin/`.

With **`npm run build`** then **`npm run start`**, both are served from the API: site at `/`, admin at `/admin/`. If pages are blank, ensure port **3001** is free for the API and run **`npm run build`** at least once.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | API (see `PORT`/`API_PORT` in `.env`) + client Vite `:5173` + admin Vite (see `ADMIN_DEV_PORT`) |
| `npm run dev:pay` | Same as `npm run dev` (API + client + admin — needed for `/admin` behind the client proxy) |
| `npm run build` | `client/dist` + `admin/dist` |
| `npm run preview:client` / `preview:admin` | Preview a built app (with `/api` proxy) |
| `npm run start` | API + static files from `client/dist` and `admin/dist` |

## Environment

- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (+ `SUPABASE_ANON_KEY` for admin UI sign-in) — enables Supabase-backed storage and token validation for `/api/admin/*`.
- `SUPABASE_ADMIN_EMAILS` (recommended) — comma-separated allowlist for admin accounts.
- `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` — required by the admin React app login page (Supabase email/password).
- `API_PORT` — optional; default `3001` (must match `.env` used by Vite proxies).
- `ADMIN_DEV_PORT` — optional; default `5174`. Change in `.env` if that port is busy; client and admin configs both read it.
- `ADMIN_KEY` — optional fallback only when Supabase is not configured.

By default, message/invoice/payment JSON files are created at runtime under `server/` and are gitignored.
If `SUPABASE_URL` is set with either `SUPABASE_SERVICE_ROLE_KEY` (recommended) or `SUPABASE_ANON_KEY` (requires suitable RLS policies), the API stores invoices, payments, contact messages, and quote requests in Supabase instead (see `server/supabase-schema.sql`). Admin API routes then validate Supabase bearer tokens and allow accounts listed in `SUPABASE_ADMIN_EMAILS` and/or users with admin role metadata (`admin|owner|super_admin`, `roles[]`, `is_admin` flag).

## Push to GitHub

GitHub needs a one-time browser login (no one can push for you without your account). From the project folder:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\publish-github.ps1
```

That signs you in with `gh` (if needed), creates `ethanhabib15-star/clearview-windows` if it does not exist, then runs `git push -u origin main`.

## Deploy notes

Run `npm run build`, then serve `client/dist` and `admin/dist` from the same origin as the API (this repo’s `server/index.js` does that). The API must be reachable where the browser can call it (same origin or CORS).
