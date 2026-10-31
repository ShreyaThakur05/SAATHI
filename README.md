<div align="center">

<img src="web/public/brand/saathi-logo.png" alt="Paytm Saathi logo" width="140" />

# Paytm Saathi

### Every Problem Deserves a Saathi. Every Saathi Delivers a Solution.

An AI teammate that lives **inside** the Paytm products merchants and support teams already use.
It listens, checks the systems, fixes the problem within Paytm's rules, **proves the fix worked**, and calls a person only when a human decision is needed.

[**Live prototype**](https://saathi-sooty-ten.vercel.app/) &nbsp;·&nbsp;
[**Demo video**](https://drive.google.com/file/d/13XYK0cKbZW75EWrPaw9iIJx43kxukMhH/view?usp=sharing) &nbsp;·&nbsp;
[**Pitch deck**](https://docs.google.com/presentation/d/1NRZSFtqU2g1TjVGhWnc7mVBCs1Eq7Gwd/edit?usp=sharing&ouid=104911131484429472830&rtpof=true&sd=true)

Built solo by **Team SoloDance** for the **Paytm Build for India AI Hackathon, Track 3 (Autonomous AI Teammates)**.
Sample data is fictional. Not affiliated with or endorsed by Paytm.

</div>

---

## Contents

1. [Links](#links)
2. [The problem and the idea](#the-problem-and-the-idea)
3. [Try it in two minutes](#try-it-in-two-minutes)
4. [What you can do in the prototype](#what-you-can-do-in-the-prototype)
5. [How Saathi works](#how-saathi-works)
6. [What makes it different](#what-makes-it-different)
7. [Edge cases that are covered](#edge-cases-that-are-covered)
8. [What is real and what is simulated](#what-is-real-and-what-is-simulated)
9. [Integrating it into an existing Paytm product](#integrating-it-into-an-existing-paytm-product)
10. [Tech stack](#tech-stack)
11. [Run it locally](#run-it-locally)
12. [Configuration](#configuration)
13. [Deploy to Render and Vercel](#deploy-to-render-and-vercel)
14. [Tests](#tests)
15. [Documentation](#documentation)
16. [Known limitations](#known-limitations)
17. [Repository layout](#repository-layout)

---

## Links

| | |
|---|---|
| **Live prototype** | https://saathi-sooty-ten.vercel.app/ |
| **Demo video (Google Drive)** | https://drive.google.com/file/d/13XYK0cKbZW75EWrPaw9iIJx43kxukMhH/view?usp=sharing |
| **Pitch deck** | https://docs.google.com/presentation/d/1NRZSFtqU2g1TjVGhWnc7mVBCs1Eq7Gwd/edit?usp=sharing&ouid=104911131484429472830&rtpof=true&sd=true |
| **API (Render)** | https://saathi-api-hyn1.onrender.com (`/healthz`, `/readyz`) |
| **Source** | https://github.com/ShreyaThakur05/SAATHI |

> The live API runs on a free Render tier, which sleeps when idle. **The first request after a quiet period can take
> about 30 seconds.** Open the site once and wait before you start clicking.

---

## The problem and the idea

A merchant's Soundbox goes offline for two days and rent is still charged. A bill payment fails and the money is
debited. A settlement is put on hold with no clear reason. Today each of these becomes a ticket: the merchant waits,
the support team repeats the same lookups, and nobody is sure the fix actually worked.

**Saathi is not a new app.** It is an AI teammate that plugs into the products Paytm already runs: the merchant app,
the support console and the back-office systems. It works the case the way a careful support colleague would:

```
Listen  →  Understand  →  Look up  →  Decide  →  Act  →  Prove
```

* **Listen**: the merchant describes the problem in Hindi, Hinglish or English, typed or spoken.
* **Understand**: a language model *labels* the message (what is wrong, which product). It does nothing else.
* **Look up**: Saathi reads the real state from the connected systems (device, billing, logistics, settlement, KYC, biller, gateway).
* **Decide**: a deterministic rules engine reading a **Skill Pack** file decides what is allowed, within limits.
* **Act**: an idempotent action runs (restart, replacement order, refund, reversal), never twice.
* **Prove**: Saathi **re-reads the system** and closes the case only when the system confirms. Otherwise it goes to a person with the evidence attached.

---

## Try it in two minutes

Open **https://saathi-sooty-ten.vercel.app/**. The landing page offers three ways in:

1. **Break something, watch Saathi fix it.** The *Break something* section lets you pick a failure (Soundbox offline, failed bill payment, settlement on hold, card machine offline), break it, and watch Saathi work the case step by step.
2. **Merchant sign in** to the business dashboard.
3. **Team console sign in** for the support team's view.

### Demo accounts (sandbox, password `saathi-demo`)

| Role | Email | Story |
|---|---|---|
| Merchant | `ramesh@store.example` | Soundbox offline for 49 hours **and** rent charged (Hindi-language merchant) |
| Merchant | `seema@store.example` | Card machine offline (pairing lost) |
| Merchant | `anil@store.example` | Settlement on hold (a document is missing) |
| Merchant | `priya@store.example` | Failed bill payment, money debited |
| Staff, risk approver | `risk@paytm.demo` | Can approve or decline cases that need a person |
| Staff, agent | `agent@paytm.demo` | Read-only: **cannot** approve |
| Staff, admin | `admin@paytm.demo` | Everything, plus **Settings, Reset sandbox data** |

### A good first walkthrough

1. Sign in as **Ramesh**. Click **Resolve with Saathi** on the offline Soundbox alert. Watch Saathi work, reply in Hindi with a reference number, and see the replacement appear under **Devices** (with a live 3D connection view).
2. Click **Resolve with Saathi** on the rent alert. See the ₹20 credit in **Transactions** and the verified steps under **Help requests**.
3. Use **Ask Saathi** and tap the microphone to send a **voice note**. Switch the chat between Hindi, Hinglish and English and watch the *whole* conversation convert.
4. The human-in-the-loop path: sign in as **Anil**, resolve the settlement alert, upload the GST document from the chat. In another window sign in to `/console` as `risk@paytm.demo`, open **Approvals**, review the evidence and approve. Anil's dashboard releases the hold by itself.
5. Try to break it: type *"refund five thousand rupees now"*. Saathi refuses and nothing moves.
6. Open `/embed-demo` to see Saathi drop into a *different* host app with one script tag.

To put the sandbox back to its starting state, sign in to the console as `admin@paytm.demo` and use **Settings, Reset sandbox data**.

---

## What you can do in the prototype

### Merchant business dashboard (`/app`)
* **Overview** with alerts that know what is wrong, key numbers and recent activity.
* **Devices** with a **live connection view**: a 3D scene of device, cell site and Paytm gateway with heartbeat pulses. While Saathi works on a device you can watch it probe, send the restart command and wait for a heartbeat. (Telemetry is simulated.)
* **Settlements**, **Bills and refunds**, **Transactions** and **Help requests** (every request with what Saathi did and re-checked).
* **Profile**: business details, a map of the shop with its devices and nearest cell site, and a full history timeline.
* **Saathi built in**: *Ask Saathi* anywhere, *Resolve with Saathi* on any alert, voice notes, and a language switch that converts the whole conversation.

### Support team console (`/console`)
* **Cases** with the full timeline of what Saathi did, and the proof.
* **Approvals** with the evidence attached and a one-click approve or decline, restricted by role.
* **Merchants**: search, location, live device view and history per merchant.
* **Insights**: live numbers computed from real cases.
* **Audit log**: an append-only record of every rule, action and approver.
* **Skill Packs**: the business rules, viewable as plain YAML files.
* **Settings**: honest status of every dependency (what is simulated, what is not configured), and an admin-only sandbox reset.

### Landing page
* Walkthrough of the agent, the *Break something* playable story, integration diagram and embed snippet, a live Saathi chat that asks visitors to sign in (and never pretends to see an account), light mode by default with an optional Paytm-palette dark mode.

### Everywhere
* **Mobile first**: bottom tab bar with a *More* sheet, full-screen chat, 44px touch targets, no sideways scrolling.
* **Accessible**: axe checks run in the test suite.

---

## How Saathi works

```
 Merchant (voice / text)                                  Support team
        │                                                     ▲
        ▼                                                     │ approve / decline
┌──────────────┐   labels only    ┌───────────────────────────┴──┐
│  Understand  │ ───────────────► │  Rules engine + Skill Packs  │  decides what is allowed
│ (LLM or      │  schema-checked  │  (Python, deterministic)     │
│  keyword)    │                  └───────────────┬──────────────┘
└──────────────┘                                  ▼
                                   ┌─────────────────────────────┐
                                   │ Idempotent actions          │  one key per action,
                                   │ restart · replace · refund  │  cannot run twice
                                   └───────────────┬─────────────┘
                                                   ▼
                                   ┌─────────────────────────────┐
                                   │ Prove: re-read the system   │  close only if confirmed,
                                   └───────────────┬─────────────┘  otherwise hand to a person
                                                   ▼
                          Postgres: cases · actions · messages · append-only audit log
```

The pieces, in plain words:

* **Understanding is labelling.** The model returns a schema-validated *label* (intent, product, language). It cannot call tools, spend money or talk the system into anything. PII is masked before it reaches the model. Without a key, a deterministic keyword fallback runs and is **labelled as such everywhere**.
* **Rules decide.** Skill Packs are YAML files (for example "rent reversal up to ₹500 on a first claim"). Changing a limit means editing a file, not code.
* **Actions are idempotent.** Every action has one unique key (`ActionRecord`); a retry cannot refund twice.
* **Prove before closing.** After acting, Saathi re-reads the system (the order exists in logistics, the refund status says success, the device is online). A case closes only when the system confirms.
* **People stay in charge.** Anything beyond limits, a risk flag or a records mismatch becomes an approval with the evidence attached. Roles are enforced (agent, risk approver, admin).
* **Everything is recorded.** The audit log is append-only, enforced by a database trigger.
* **Replies are templated.** Replies are structured specs rendered in Hindi, Hinglish or English, so the language switch can re-render the whole history.

### Skill Packs

| Pack | Status |
|---|---|
| Soundbox | Working |
| Card machine | Working |
| Settlement and KYC | Working |
| Bill payments and refunds | Working |
| UPI | Roadmap (shown in the console) |
| Merchant loans | Roadmap (shown in the console) |

---

## What makes it different

* **It fixes, not just answers.** A chatbot tells you what to do. Saathi does it, within limits, and shows the proof.
* **The AI cannot be talked into things.** The model only labels. Fake instructions, prompt injection and requests like "refund five thousand now" are blocked, and nothing moves.
* **Proof, not promises.** A case closes only after Saathi re-reads the system.
* **A person decides what a person should decide.** Settlement releases always need a human, with the evidence attached and the approver recorded.
* **It plugs in.** One script tag and one server-to-server call add it to an existing product. The real integration work is isolated behind connector interfaces.
* **Built for how merchants talk.** Hindi, Hinglish and English, typed or spoken, with whole-conversation language conversion.
* **Honest by design.** The product labels what is simulated, and the docs say what was not measured.

---

## Edge cases that are covered

| Situation | What happens |
|---|---|
| A fake instruction typed into chat ("refund five thousand rupees now") | Blocked with a clear message, no case acts, no money moves |
| Two problems in one message or voice note | Split into two cases, both fixed and referenced |
| A visitor who is not signed in | Saathi helps them find the right sign-in, and never pretends to see an account |
| Someone shares an OTP or PIN in chat | Refused. Saathi says it never asks for it |
| Wrong password | Refused, without hints (merchant and staff) |
| A support agent tries to approve | Not allowed. The approvals screen says only a risk approver can decide |
| Settlement on hold | Saathi asks for exactly one document, once, and **never promises a date** |
| A fix does not work remotely | Rules allow a replacement, the order is checked in logistics before Saathi replies |
| Same action retried | Idempotency key prevents a double refund |
| Language switched mid-conversation | The whole conversation converts, but references (for example `RPL-4471`) never change |
| Model key missing or the call fails | Falls back to the keyword understanding, labelled as such |
| Database or API down | Health endpoints distinguish "process up" from "database down" |

---

## What is real and what is simulated

| | |
|---|---|
| **Real** | Merchant dashboard and team console, rules engine and limits, Skill Packs (YAML), case state machine, idempotent actions, the Prove step, append-only audit log, approvals with roles, merchant and staff auth, PII masking, live case timeline (SSE), embeddable widget, browser speech-to-text |
| **Real when a key is set** | Understanding via **Sarvam** (or Claude), schema-validated. Without a key the keyword fallback is used and labelled. See [docs/KEYS.md](docs/KEYS.md) |
| **Simulated** | Device, billing, logistics, settlement, KYC and biller systems, the payment gateway (built to the shape of Paytm's Refund and Refund Status APIs, backed by Postgres tables), shop locations and device heartbeat telemetry |
| **Not built** | WhatsApp channel, server-side Indian-language speech-to-text (Sarvam or Bhashini), UPI and Loans Skill Packs (roadmap), webhooks, SSO |

The pitch refers to Paytm's real test APIs. They are **not** used in this build because staging access was not
available. When presenting, say "simulated".

---

## Integrating it into an existing Paytm product

Three tiers, from least to most work for the host team (details in [docs/EMBEDDING.md](docs/EMBEDDING.md)).

**1. Drop-in widget (built and tested)**

```html
<script src="https://saathi.your-domain.com/saathi-widget.js" defer></script>
<saathi-widget token="{token}" lang="hi" primary="#00b9f5"></saathi-widget>
```

1. The **host backend** mints a short-lived token: `POST /v1/embed/token` with header `X-Saathi-Host-Key` and body `{"merchant_id": 4271, "language": "hi"}`. The host key never reaches the browser.
2. The widget is a **Shadow-DOM web component**, so host CSS cannot break it and it cannot break the host. It renders a launcher and an iframe; the token travels in the URL hash and never reaches a server.
3. **Theming** with `primary` and `lang`. **Events** on the element: `saathi-ready`, `saathi-message-sent`, `saathi-case-update`, `saathi-token-expired`.
4. **Security:** only `/chat` can be framed, only by origins in `FRAME_ANCESTORS`. Merchant tokens and staff tokens never cross scopes.

See it working at [`/embed-demo`](https://saathi-sooty-ten.vercel.app/embed-demo) (an illustrative host page, not a Paytm screen).

**2. Components or SDK** and **3. Connector replacement** are described in the embedding doc: swap each simulated connector
for the real internal system behind the same interface.

---

## Tech stack

| Layer | Choices |
|---|---|
| **API** | Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2, Alembic migrations, psycopg 3, PyJWT, scrypt password hashing, httpx |
| **Database** | PostgreSQL (append-only audit log enforced by a trigger) |
| **AI** | Sarvam (`sarvam-105b-conversations`) preferred, optional Anthropic Claude, deterministic keyword fallback, schema-validated outputs, PII masking |
| **Web** | Next.js 16 (App Router), React, Tailwind CSS v4, TanStack Query, Leaflet maps, three.js with react-three-fiber, lucide icons |
| **Quality** | pytest (real Postgres), ruff, mypy, Vitest, Playwright with axe accessibility checks, GitHub Actions CI |
| **Deploy** | Render (API and Postgres, via `render.yaml`), Vercel (web), Docker |

---

## Run it locally

You need **Docker**, **[uv](https://docs.astral.sh/uv/)** and **Node 20+**.

```bash
# 1. Postgres
cd infra && docker compose up -d db

# 2. API
cd ../api && uv sync && uv run alembic upgrade head
SAATHI_DEMO_TOOLS_ENABLED=true uv run uvicorn app.main:app --port 8000   # seeds demo data on start

# 3. Web
cd ../web && npm ci && cp .env.example .env.local && npm run dev          # http://localhost:3000
```

Or everything in containers: `cd infra && docker compose --profile full up --build`
(Postgres on `:5433`, API on `:8000`, web on `:3000`).

| Open | What it is |
|---|---|
| `http://localhost:3000` | Landing page |
| `/login`, `/app` | Merchant sign-in and business dashboard |
| `/console` | Support team console |
| `/embed-demo` | Saathi dropped into a different host app |
| `http://localhost:8000/docs` | The API's OpenAPI documentation |

---

## Configuration

Copy the examples and fill in what you need. **Secrets are never committed** (`.env` files are git-ignored).

| Variable | Where | Notes |
|---|---|---|
| `SAATHI_DATABASE_URL` | api | `postgresql+psycopg://user:pass@host:5432/db` (a plain `postgresql://` URL is converted) |
| `SAATHI_ENV` | api | `local`, `sandbox` (real secrets required, demo tools allowed) or `production` (demo tools forbidden). Anything other than `local` refuses to boot with development secrets |
| `SAATHI_JWT_SECRET` | api | 32 characters or more |
| `SAATHI_HOST_API_KEY` | api and host backend | Long random string; used to mint embed tokens |
| `SAATHI_DEMO_TOOLS_ENABLED` | api | Seeds the fictional merchants and demo accounts. **Must be `false` in production** |
| `SAATHI_CORS_ORIGINS`, `SAATHI_CORS_ORIGIN_REGEX` | api | Allowed web origins |
| `SAATHI_SARVAM_API_KEY` | api | Optional. Turns on language-model understanding |
| `SAATHI_ANTHROPIC_API_KEY`, `SAATHI_LLM_PROVIDER` | api | Optional alternative provider; `auto` prefers Sarvam |
| `SAATHI_SIM_LATENCY_MS` | api | Simulated connector delay, for demo realism |
| `NEXT_PUBLIC_API_URL` | web (build time) | Baked into the browser bundle |
| `SAATHI_API_URL`, `SAATHI_HOST_API_KEY`, `DEMO_MODE` | web (server) | Demo session route for `/embed-demo` |
| `FRAME_ANCESTORS` | web | Origins allowed to embed `/chat` |

Where to get each key: [docs/KEYS.md](docs/KEYS.md).

---

## Deploy to Render and Vercel

The API and Postgres go to **Render** (from [`render.yaml`](render.yaml)); the Next.js app goes to **Vercel**.
Order matters: **API first, then web.** The Blueprint already pre-fills CORS for Vercel projects whose name starts with `saathi`.

1. **Render:** *New, Blueprint*, choose this repo, paste the optional Sarvam key, and apply. Check `/healthz` and `/readyz` on the service URL, then copy `SAATHI_HOST_API_KEY` from the service's Environment tab.
2. **Vercel:** *Add New, Project*, import this repo, set **Root Directory** to `web`, name the project starting with `saathi`, and add `NEXT_PUBLIC_API_URL`, `SAATHI_API_URL` (both the Render URL), `SAATHI_HOST_API_KEY` and `DEMO_MODE=true`.
3. **Check it:** sign in as `ramesh@store.example`, resolve the Soundbox alert, open `/embed-demo`.

Full steps and a troubleshooting table: [docs/DEPLOY.md](docs/DEPLOY.md).

This is a **sandbox deployment** with fictional data and public demo accounts. Do not put real merchant data in it.

---

## Tests

```bash
cd api && uv run ruff check . && uv run mypy app && uv run pytest        # backend: unit, integration (real Postgres), API
cd web && npm run lint && npm run typecheck && npm test                    # frontend unit and component
cd web && npm run build && npx playwright test                             # browser e2e + axe accessibility (resets demo data!)
cd api && uv run python -m app.eval.run                                    # Understand evaluation sets
```

Last full runs: **171** backend tests, **56** frontend unit tests, **33** Playwright end-to-end and accessibility tests, all passing.
The Playwright tests cover the Soundbox journey, the settlement flow across two roles, voice notes, blocked instructions,
role gating, embedding, the playable story, dark mode, mobile navigation and axe checks on the main pages.

The language-understanding evaluation (details and what was **not** measured in [docs/AI.md](docs/AI.md)): the keyword
fallback scores 100% on its development set, which it was tuned on, and **85% intent accuracy and 90% injection
detection on a small held-out set**. The development figure is not a fair measure.

---

## Documentation

* [Architecture, safety properties, data model](docs/ARCHITECTURE.md)
* [AI pipeline, prompts, evaluation results (including what was *not* measured)](docs/AI.md)
* [Embedding in a Paytm dashboard](docs/EMBEDDING.md)
* [Keys and where to get them](docs/KEYS.md)
* [Deploy to Render and Vercel, step by step](docs/DEPLOY.md)
* [Original plan and decisions](docs/PLAN.md)

---

## Known limitations

* The Sarvam and Claude understanding paths have **not been run against their live APIs** here; only request shape, validation and fallbacks are tested with mocks. The live deployment currently uses the keyword fallback unless a key is set.
* The keyword fallback scored 85% intent and 90% injection accuracy on a small held-out set. Misses create no case.
* Rate limiting is in-process, and staff tokens live in `sessionStorage`. Both are fine for a prototype, not for production.
* The "₹100/day compensation" and refund deadline length are configured assumptions, not verified against current RBI or NPCI rules.
* The pitch's "~31 seconds" is replaced by a measured ~4 seconds with simulated system latency.
* All Paytm back-office systems, the payment gateway, shop locations and telemetry are simulated.
* The demo video uses a simulated microphone for the voice-chat clip; the real feature uses the browser's speech recognition (best in Chrome, with a microphone).
* The free Render tier sleeps when idle, so the first request can be slow.
* There is no user-provisioning UI yet, so a production launch would need SSO or admin tooling first.

---

## Repository layout

```
api/       FastAPI service, rules engine, Skill Packs (YAML), simulated connectors, migrations, tests
web/       Next.js app: landing page, merchant dashboard (/app), team console (/console), embeddable chat and widget
infra/     docker-compose (Postgres; full stack under the `full` profile)
docs/      plan, architecture, AI, embedding, keys, deployment
render.yaml  Render Blueprint (API and Postgres)
Dockerfile   builds the API from the repo root, for hosts that expect it there
```

---

<div align="center">

**Every Problem Deserves a Saathi. Every Saathi Delivers a Solution.**

[Live prototype](https://saathi-sooty-ten.vercel.app/) · [Demo video](https://drive.google.com/file/d/13XYK0cKbZW75EWrPaw9iIJx43kxukMhH/view?usp=sharing) · [Pitch deck](https://docs.google.com/presentation/d/1NRZSFtqU2g1TjVGhWnc7mVBCs1Eq7Gwd/edit?usp=sharing&ouid=104911131484429472830&rtpof=true&sd=true)

</div>
