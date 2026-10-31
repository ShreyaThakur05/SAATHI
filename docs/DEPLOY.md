# Deployment

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
| `SAATHI_ANTHROPIC_API_KEY` | api | Optional. Without it Understand uses the keyword fallback |
| `SAATHI_SIM_LATENCY_MS` | api | Simulated connector delay (demo realism); set 0 for fastest |
| `NEXT_PUBLIC_API_URL` | web **build** | Baked into the browser bundle |
| `SAATHI_API_URL`, `SAATHI_HOST_API_KEY`, `DEMO_MODE` | web (server) | Demo session route only; `DEMO_MODE` unset in production |
| `FRAME_ANCESTORS` | web | Origins allowed to embed `/chat` |

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
