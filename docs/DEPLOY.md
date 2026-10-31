# Deployment

## Deploy to Render (API + database) and Vercel (web), step by step

You need accounts on GitHub, Render and Vercel. The code is already on GitHub
(`ShreyaThakur05/SAATHI`). The API and Postgres go on Render; the Next.js app goes on Vercel.

The deploy order matters, because each side needs the other's URL: **API first, then web, then tell the API about the web URL.**

### A. Render: the API and the database

1. In Render: **New, Blueprint**, connect GitHub, choose the SAATHI repo. Render reads
   [`render.yaml`](../render.yaml) and shows two resources: `saathi-api` (Docker web service) and `saathi-db` (Postgres).
2. `render.yaml` now pre-fills the CORS settings (it allows Vercel projects whose name starts with `saathi`). Render only asks for
   the Sarvam key, which is a secret and is never committed. Fill the table below if you want to change anything, then **Apply**:

   | Variable | Value |
   |---|---|
   | `SAATHI_CORS_ORIGINS` | `["http://localhost:3000"]` for now (you set the real one in step C) |
   | `SAATHI_CORS_ORIGIN_REGEX` | leave blank for now |
   | `SAATHI_SARVAM_API_KEY` | your Sarvam key (optional; without it the keyword fallback runs) |

   Everything else is set for you: `SAATHI_DATABASE_URL` comes from the database, and `SAATHI_JWT_SECRET` and
   `SAATHI_HOST_API_KEY` are generated.
3. Wait for the first build (several minutes; Docker image, then migrations run automatically on start). The service
   is ready when its log shows `Application startup complete`.
4. Copy the service URL, for example `https://saathi-api-abcd.onrender.com`, and check it:
   ```bash
   curl https://saathi-api-abcd.onrender.com/healthz     # {"status":"ok"}
   curl https://saathi-api-abcd.onrender.com/readyz      # {"status":"ready","database":"up"}
   ```
5. In the `saathi-api` service open **Environment**, reveal `SAATHI_HOST_API_KEY` and copy it. You need it for Vercel.

The sandbox settings (`SAATHI_ENV=sandbox`, `SAATHI_DEMO_TOOLS_ENABLED=true`) seed the fictional merchants and demo
accounts on start, so the app is usable immediately. `sandbox` still refuses to start with the development secrets.

### B. Vercel: the web app

1. In Vercel: **Add New, Project**, import the SAATHI repo.
2. **Root Directory: `web`**. Framework preset: Next.js (detected). Leave build settings as they are.
3. Add these environment variables (no trailing slashes):

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | the Render URL, `https://saathi-api-abcd.onrender.com` |
   | `SAATHI_API_URL` | the same Render URL |
   | `SAATHI_HOST_API_KEY` | the value you copied from Render in step A5 |
   | `DEMO_MODE` | `true` (needed for the `/embed-demo` page) |

   `NEXT_PUBLIC_API_URL` is baked into the browser bundle at build time, so if you change it you must redeploy.
4. **Deploy**, then copy the URL, for example `https://saathi-xyz.vercel.app`.

### C. Tell the API about the web URL (CORS)

The browser calls the API directly, so the API must allow the Vercel origin. In Render, `saathi-api`, **Environment**:

- `SAATHI_CORS_ORIGINS` = `["https://saathi-xyz.vercel.app"]` (a JSON list with double quotes)
- optional, to allow Vercel preview deployments too: `SAATHI_CORS_ORIGIN_REGEX` = `https://saathi-.*\.vercel\.app`

Save; Render redeploys. Without this step the sign-in page shows "Can't reach Saathi right now".

If you embed the widget in a *different* site, also set `FRAME_ANCESTORS` on Vercel to that site's origin, for example
`'self' https://dashboard.example.com`, then redeploy.

### D. Check it end to end

1. Open the Vercel URL, **Merchant sign in**, use `ramesh@store.example` / `saathi-demo`.
2. Click **Resolve with Saathi** on the offline alert. A replacement order appears on **Devices**.
3. Open `/console`, sign in as `risk@paytm.demo` / `saathi-demo`, and check **Settings**: it should say
   "Understanding: Sarvam" if you set the key, otherwise "Keyword fallback".
4. Open `/embed-demo` and use **Get help with this device**.

### Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Sign-in says "Can't reach Saathi right now" | CORS not set (step C), or `NEXT_PUBLIC_API_URL` wrong or not redeployed |
| First request is very slow, then fine | Free Render services sleep after inactivity and need a cold start. Use a paid instance for real use |
| Render deploy fails with "Unsafe production configuration" | A secret is a development default or shorter than 32 characters. Use the generated values |
| `/readyz` returns 503 | The API cannot reach Postgres. Check `SAATHI_DATABASE_URL` in the Render environment |
| `/embed-demo` says "Could not reach the Saathi API" | `SAATHI_HOST_API_KEY` on Vercel differs from the one on Render, or `DEMO_MODE` is not `true` |
| Settings says "Keyword fallback" although you set a key | Key missing or wrong, or the call failed; check the Render logs for `understand_llm_failed_fallback_to_keyword` |
| Browser console shows a CORS error on `/v1/...` | The exact origin must match, including `https://` and no trailing slash |

### Notes and limits

* Free tiers have limits (sleeping services, free Postgres retention). Check Render's and Vercel's current plan terms
  before relying on them for a demo day, and open the app a few minutes beforehand to wake it.
* This is a **sandbox deployment**: simulated Paytm systems, fictional data, public demo accounts. Do not put real
  merchant data in it.
* A real launch uses `SAATHI_ENV=production` and `SAATHI_DEMO_TOOLS_ENABLED=false`. That removes the seeded demo
  accounts, and this prototype has no user-provisioning UI yet, so you would add merchants and staff (or SSO) first.

## Environment

| Variable | Where | Notes |
|---|---|---|
| `SAATHI_DATABASE_URL` | api | `postgresql+psycopg://user:pass@host:5432/db` |
| `SAATHI_ENV` | api | Set `production` to refuse unsafe defaults at boot |
| `SAATHI_JWT_SECRET` | api | ≥ 32 chars. Required in production |
| `SAATHI_HOST_API_KEY` | api + host backend | Long random string. Required in production |
| `SAATHI_DEMO_TOOLS_ENABLED` | api | **Must be `false` in production** (disables demo seed/reset and demo accounts) |
| `SAATHI_CORS_ORIGINS` | api | JSON list of web origins |
| `SAATHI_RUN_MIGRATIONS_ON_START` | api | `true` for simple deploys (the Docker CMD also runs `alembic upgrade head`) |
| `SAATHI_SARVAM_API_KEY` | api | Optional. Without any model key Understand uses the keyword fallback (see KEYS.md) |
| `SAATHI_ANTHROPIC_API_KEY`, `SAATHI_LLM_PROVIDER` | api | Optional alternative provider; `auto` prefers Sarvam |
| `SAATHI_SIM_LATENCY_MS` | api | Simulated connector delay (demo realism); set 0 for fastest |
| `NEXT_PUBLIC_API_URL` | web **build** | Baked into the browser bundle |
| `SAATHI_API_URL`, `SAATHI_HOST_API_KEY`, `DEMO_MODE` | web (server) | Demo session route only; `DEMO_MODE` unset in production |
| `FRAME_ANCESTORS` | web | Origins allowed to embed `/chat` |

## Testing a database URL

Hosts such as Neon and Supabase give a URL starting `postgresql://`. Saathi uses the psycopg v3 driver, so change the
scheme to `postgresql+psycopg://` and keep `?sslmode=require` if the host needs TLS:

```
SAATHI_DATABASE_URL='postgresql+psycopg://USER:PASSWORD@HOST/DBNAME?sslmode=require'
```

1. **Connectivity, credentials and permissions:** `cd api && uv run alembic upgrade head`. It connects and creates the
   tables, so success proves all three. (Plain connectivity only: `psql 'postgresql://...' -c 'select 1'`.)
2. **The API's own view:** start the API and run `curl localhost:8000/readyz`.
   * `{"status":"ready","database":"up"}` (HTTP 200): connected.
   * `{"status":"unavailable","database":"down"}` (HTTP 503): the API is running but cannot reach the database.
     `/healthz` stays 200 so you can tell "process up" from "database down". Check host, password, TLS and IP allow-lists.
3. **Data path:** with `SAATHI_DEMO_TOOLS_ENABLED=true` on a *throwaway* database, the API seeds demo data on start;
   sign in at `/login` as `ramesh@store.example` (password `saathi-demo`) to see it round-trip. Never enable demo
   tools on a production database.

## Run everything in containers

```bash
cd infra && docker compose --profile full up --build   # db :5433, api :8000, web :3000
```

## Suggested hosting

* **Database:** managed Postgres (Neon, Supabase, RDS). Enable automated backups. The audit log is the data you most need to keep.
* **API:** any container host (Fly.io, Render, Cloud Run). One instance is fine for the prototype; with more than one,
  move the in-process rate limiter to Redis. Health: `/healthz` (liveness), `/readyz` (checks the database).
* **Web:** Vercel, or the standalone Docker image.

## Before a real launch (not done in this prototype)

* Rotate demo accounts out; provision staff through SSO.
* Retention policy for `messages` and `audit_log` (messages are PII-masked, but still personal data).
* Error monitoring (e.g. Sentry) and metrics export; logs are structured JSON on stdout.
* Move the staff token from `sessionStorage` to an httpOnly cookie.

### If Render says `open Dockerfile: no such file or directory`

The service was created by hand instead of from the Blueprint, so it looks for `Dockerfile` in the repo root. The repo now
has a root `Dockerfile` that builds the API, so a redeploy of the latest commit works. The Blueprint route
(**New, Blueprint**) is still the recommended one because it also creates the database and the generated secrets.
