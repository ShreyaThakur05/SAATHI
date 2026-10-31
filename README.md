# Paytm Saathi (prototype)

> **Problems solved, not just answered.**  An AI teammate for support teams: it checks the systems, takes the fix
> within Paytm's rules, **re-checks that the fix worked**, and calls a person only when a human decision is needed.

Built for the Paytm Build for India AI Hackathon (Track 3, Autonomous AI Teammates) by Team SoloDance.
Sample data is fictional. Not affiliated with or endorsed by Paytm.

## See it in two minutes

```bash
# 1. Postgres (needs Docker)
cd infra && docker compose up -d db

# 2. API  (needs uv: https://docs.astral.sh/uv/)
cd ../api && uv sync && uv run alembic upgrade head
SAATHI_DEMO_TOOLS_ENABLED=true uv run uvicorn app.main:app --port 8000   # seeds demo data on start

# 3. Web
cd ../web && npm ci && cp .env.example .env.local && npm run dev          # http://localhost:3000
```

| Open | What it is |
|---|---|
| `/login` | Merchant sign-in to the **business dashboard** (`/app`): overview, devices, settlements, bills and refunds, transactions, help requests. Saathi is built in ("Ask Saathi", or "Resolve with Saathi" on any alert). Sandbox merchants, password `saathi-demo`: `ramesh@store.example` (Soundbox offline + rent), `seema@store.example` (card machine offline), `anil@store.example` (settlement on hold), `priya@store.example` (failed bill payment). |
| `/console` | Support team console. `risk@paytm.demo` can approve, `agent@paytm.demo` is read-only, `admin@paytm.demo` can also reset sandbox data in Settings. Same password. |
| `/embed-demo` | How Saathi drops into a *different* host dashboard through `<saathi-widget>`. |
| `localhost:8000/docs` | The API's OpenAPI documentation. |

A good first walkthrough: sign in as Ramesh, click **Resolve with Saathi** on the offline alert, watch the replacement
appear on **Devices**, click it on the rent alert, then see the credit in **Transactions** and the verified steps under
**Help requests**. For the human-in-the-loop path, sign in as Anil, resolve the settlement alert, upload the GST document
in the chat, then approve it in the console as `risk@paytm.demo` and watch Anil's dashboard release the hold by itself.

Or everything in containers: `cd infra && docker compose --profile full up --build`.

## What is real and what is simulated

| | |
|---|---|
| **Real** | Merchant dashboard and team console, rules engine and limits, Skill Packs (YAML), case state machine, idempotent actions, the Prove step, append-only audit log, approvals with roles, merchant and staff auth, PII masking, SSE live timeline, embeddable widget, browser speech-to-text |
| **Real when a key is set** | Understanding via Claude (schema-validated). Without a key a deterministic keyword fallback is used and labelled as such everywhere |
| **Simulated** | Device, billing, logistics, settlement, KYC and biller systems, and the payment gateway (built to the shape of Paytm's Refund / Refund Status APIs, backed by Postgres tables) |
| **Not built** | WhatsApp channel, server-side Indian-language STT (Sarvam/Bhashini), UPI and Loans Skill Packs (shown as roadmap), webhooks, SSO |

The pitch says the refunds run on Paytm's real test APIs. They do **not** in this build, because staging access was
not available. Say "simulated" when presenting.

## How it works

`Listen → Understand → Look up → Decide → Act → Prove`. The language model only *labels* the message. A Python rules
engine reading a Skill Pack file decides what is allowed (e.g. rent reversal up to ₹500 on a first claim). Each
action has one idempotency key and cannot run twice. After acting, Saathi re-reads the system; a case closes only when
the system confirms, otherwise it goes to a person with the evidence attached. Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Tests (all executed; see the numbers in the final report)

```bash
cd api && uv run ruff check . && uv run mypy app && uv run pytest        # backend: unit, integration (real Postgres), API
cd web && npm run lint && npm run typecheck && npm test                    # frontend unit/component
cd web && npm run build && npx playwright test                             # browser e2e + axe accessibility (resets demo data!)
cd api && uv run python -m app.eval.run                                    # Understand evaluation sets
```

## Documentation

* [Architecture, safety properties, data model](docs/ARCHITECTURE.md)
* [AI pipeline, prompts, evaluation results (including what was *not* measured)](docs/AI.md)
* [Embedding in a Paytm dashboard](docs/EMBEDDING.md)
* [Deployment and configuration](docs/DEPLOY.md)
* [Original plan and decisions](docs/PLAN.md)

## Known limitations

* The Claude understanding path has not been run against the live API here; only its validation and fallbacks are tested.
* The keyword fallback scored 85% intent / 90% injection accuracy on a small held-out set (docs/AI.md). Misses create no case.
* Rate limiting is in-process. Staff tokens live in `sessionStorage`. Both are fine for a prototype, not for production.
* The "₹100/day compensation" and refund deadline length are configured assumptions, not verified against current RBI/NPCI rules.
* The pitch's "~31 seconds" is replaced by a measured ~4 s with simulated system latency.
* CI workflow is written but has not run on GitHub.

## Repository layout

```
api/     FastAPI service, rules engine, Skill Packs, simulated connectors, tests
web/     Next.js app: merchant dashboard (/app), team console (/console), embeddable chat + widget
infra/   docker-compose (Postgres; full stack under the `full` profile)
docs/    plan, architecture, AI, embedding, deployment
```
