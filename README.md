# ClearView Windows — marketing site + admin

React (Vite) frontend with a small Express API for contact messages and invoices.

## Setup

```bash
npm install
cp .env.example .env
# Edit .env — set ADMIN_KEY to a strong secret
npm run dev
```

- **Site:** [http://localhost:5173](http://localhost:5173)
- **Admin:** [http://localhost:5173/admin](http://localhost:5173/admin) (use `ADMIN_KEY` from `.env`)

## Scripts

| Command        | Description                          |
|----------------|--------------------------------------|
| `npm run dev`  | API on `:3001` + Vite on `:5173`     |
| `npm run build`| Production build → `dist/`           |
| `npm run preview` | Serve `dist/` (with API proxy)   |
| `npm run start` | API only (`node server/index.js`) |

## Environment

- `ADMIN_KEY` — required for `/api/admin/*` and admin UI login.

Message and invoice JSON files are created at runtime under `server/` and are gitignored.

## Push to GitHub

GitHub needs a one-time browser login (no one can push for you without your account). From the project folder:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\publish-github.ps1
```

That signs you in with `gh` (if needed), creates `ethanhabib15-star/clearview-windows` if it does not exist, then runs `git push -u origin main`.

## Deploy notes

Build the client, then serve `dist/` behind any static host. The API must be reachable where the browser can call it (same origin or CORS). For same-origin, serve the API and static files from one server or reverse proxy `/api` to the Node app.
