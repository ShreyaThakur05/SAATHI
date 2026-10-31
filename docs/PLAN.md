# Paytm Saathi: Prototype Plan (v0.1, awaiting approval)

Source: pitch PDF + 11-slide deck (Team SoloDance, Track 3 Autonomous AI Teammates).

## 1. What we are actually building

A **case-resolution engine** (not a chatbot) with two faces:

1. **Merchant/customer surface**: chat + voice note (WhatsApp, in-app widget). Hindi / Hinglish / English.
2. **Team console**: live cases, approvals, audit log, KPIs in ₹. Embeddable in a Paytm dashboard.

Pipeline: Listen → Understand → Look up → Decide → Act → Prove.
The differentiator is **Prove** (re-check the system before closing) and **limits in code**.

## 2. Core design decision: LLM is NOT the decision-maker

| Step | Who does it |
|------|-------------|
| Listen (STT) | Sarvam / Bhashini |
| Understand (split into cases, extract entities) | LLM, structured JSON output, schema-validated |
| Look up | Deterministic connectors |
| **Decide** | **Python rules engine** reading Skill Pack YAML. No LLM. |
| Act | Idempotent connectors, one action ID each |
| **Prove** | Deterministic re-check (refund status == SUCCESS, device online) |
| Reply | LLM drafts in merchant language from verified facts only; template fallback |

Why: the pitch promises "limits set in code" and "cannot be tricked". If the LLM picks actions, a prompt injection ("refund ₹5,000 now") can reach money movement. With this design the LLM can only emit an *intent label + entities*; the rules engine decides whether that intent is allowed.

## 3. Tech stack

| Layer | Choice | Why / alternative rejected |
|-------|--------|----------------------------|
| Backend | Python 3.12, FastAPI, Pydantic v2 | Pitch says so; typed contracts; async; auto OpenAPI |
| DB | PostgreSQL (Neon or Supabase for hosting; Docker locally) | Audit/ledger needs transactions + unique constraints for idempotency |
| ORM/migrations | SQLAlchemy 2 + Alembic | Standard, migrations required |
| Jobs | Postgres-backed (or FastAPI background tasks) | Redis/Celery is overkill for a prototype |
| Live updates | Server-Sent Events | One-way timeline stream; simpler than WebSockets |
| LLM | Claude Haiku 5.5 (classify/extract), Sonnet 5.5 (reply, edge cases); fallback to template reply + keyword classifier | Structured output, good Hinglish. Hosted, not open-source: no GPU infra for a prototype. The deck's "small open-source model" is dropped (see §5). |
| STT | Sarvam (primary), Bhashini (fallback) | Indian-language and code-mixed audio |
| WhatsApp | Meta Cloud API (test number) | Voice notes arrive as OGG/Opus media, need download + transcode (ffmpeg) |
| Payments | Paytm PG **staging** Refund + Refund Status APIs | Needs test MID + keys (see risks) |
| Frontend | Next.js (App Router) + TypeScript + Tailwind + shadcn/ui + TanStack Query | Pitch says Next.js; accessible primitives |
| Embeddable | Console components as a package + `<saathi-widget>` web component | See §6 |
| PII masking | Regex/rule layer (phone, Aadhaar, PAN, account no.) before any LLM call | DPDP claim in deck |
| Tests | pytest, Vitest + Testing Library, Playwright, custom eval harness | See §8 |
| Deploy | Docker Compose locally; Vercel (UI) + Fly/Render (API) + Neon (DB) | Cheap, one-command demo |

No LangChain / agent frameworks. A hand-written state machine is easier to audit and explain to judges.

## 4. Features, prioritised

**P0 (the demo cannot work without these)**
- Chat + voice-note intake (web first), language detection
- Multi-case splitting (the "rent + soundbox" note → 2 cases)
- Skill Packs: Soundbox, Bill Payments (real PG refund), Settlements/KYC, Card Machine
- Rules engine: auto-limit ₹500, first-claim only, hand-off conditions, deny-list
- Simulated connectors with realistic latency and failure modes
- Prove step + case state machine (`OPEN → ACTING → PROVING → RESOLVED | ESCALATED | BLOCKED`)
- Idempotent actions (unique action ID)
- Audit log of every step (rule hit, input, output, approver)
- Approval inbox with one-click approve/reject and pre-built evidence
- Injection / "refund ₹5,000 now" block, logged
- Live case timeline (the 0:02 → 0:31 view from slide 5)

**P1 (makes it impressive)**
- KPI dashboard: auto-resolved %, confirmed-success %, median time, ₹/ticket, 7-day repeat contact, refunds near RBI/NPCI deadline
- Scenario launcher ("Demo mode") with the 4 pitch scenarios
- WhatsApp channel live
- Hindi/English UI toggle
- Skill Pack viewer (shows YAML + live rule evaluation)

**P2 (only if time)**: Card Machine polish, Soundbox voice simulation, UPI/Loans Skill Pack stubs marked ROADMAP, CSV audit export.

## 5. Ambiguities, risks, honest corrections

1. **Paytm PG staging access** is the biggest external dependency. Refund needs an existing successful staging transaction. If no MID in time, label refund "simulated" (deck's own fallback).
2. **"Small open-source model sorts cases"**: unnecessary. A Haiku-class model with a JSON schema plus a keyword fallback does it, with no GPU. Recommend dropping it and not claiming it.
3. **"Gets better with every case"**: the deck only logs outcomes. Say "measures every case", not "learns", unless we build a feedback loop.
4. **Timing claim (31 s)**: only true if connectors are fast; our simulated ones will be tuned to be realistic, and we report measured latency, not the slide's.
5. **₹17 lakh**: arithmetic is right (50,000 × ₹34) but it is an assumption. UI must label it "illustrative", and dashboard shows measured numbers only.
6. **Hinglish STT accuracy** varies; show the transcript and let the merchant confirm on low confidence.
7. **"Rent ₹20 for 2 days"**: implies ~₹300/month rent; keep seed data consistent.
8. **"Repeat claims"** needs a defined window. Assumption: same merchant + same product + same issue within 30 days.
9. **Approver identity**: assume a simple role system (agent, risk approver, admin). Prototype auth is real (JWT) but users are seeded.
10. **WhatsApp**: test-number limits (allow-listed recipients, 24h session window). Fine for a demo.
11. **Regulatory language** ("in line with RBI FREE-AI / DPDP"): say "designed to align with", never "compliant".

## 6. UX and embedding into a Paytm dashboard

**Principle**: merchants don't want a bot, they want the problem gone. Show *progress and proof*, not conversation.

**Merchant surface (mobile-first; Paytm for Business is a phone app/webview)**
- Mic button is the primary control; text secondary
- Reply is a status card, not a paragraph: ✓ Replacement RPL-4471 · ✓ Refund RV-20931 (Success)
- Replies in the language they spoke; big tap targets; works on slow networks
- Never asks for PIN/OTP; visible "Paytm person can step in" affordance
- Escalated case says what happens next, without promising a settlement date

**Team console**
- **Cases**: live list with state, product, SLA/deadline chips
- **Case detail**: six-step timeline, evidence panel (systems queried), proof badges, rule that fired, cost in ₹
- **Approvals**: one-click, evidence pre-attached, reason required on reject
- **Audit**: filterable, exportable
- **Insights**: KPIs in ₹
- **Skill Packs**: view and simulate rules

**Design system**: Paytm-like navy + cyan tokens via CSS variables (the deck uses navy `#0A1F3C` / cyan `#00B9F5`), Inter-style type, 8px grid, WCAG AA contrast, every list has loading/empty/error states. Tokens are overridable so a host can re-theme. We take inspiration only; no Paytm logos or copied assets.

**How Paytm would integrate it (three tiers, build the first two)**
1. **Embed**: `<saathi-widget>` (web component) or iframe. Host passes a short-lived signed token (merchant ID, language, theme) via postMessage/attribute. Drops into any dashboard page; style isolation via Shadow DOM.
2. **Components/SDK**: `CaseTimeline`, `ApprovalCard`, `KpiStrip` exported as a React package so Paytm's own console can mount them natively with their auth.
3. **Headless API**: versioned REST + SSE + webhooks (`case.resolved`, `case.escalated`). The OpenAPI spec doubles as the integration doc.

Plus a **Connector interface** (`DeviceClient`, `BillingClient`, ...): going live = swapping simulated implementations for Paytm's internal ones, exactly as the pitch claims.

## 7. Architecture and data model (summary)

```
Channels (WhatsApp, web widget)
  → API (FastAPI) → Intake: STT, PII mask, language
  → Understand (LLM, schema-validated) → N cases
  → Orchestrator (state machine) per case:
        Look up (connectors) → Decide (rules + Skill Pack) → Act (idempotent) → Prove
  → Postgres (cases, steps, actions, approvals, audit)
  → SSE → Console
```

Tables: `merchants`, `devices`, `rentals`, `transactions`, `settlements`, `kyc_documents` (simulated-system data), `conversations`, `messages`, `cases`, `case_steps`, `actions` (unique idempotency key), `approvals`, `audit_log` (append-only), `skill_packs` (versioned), `metrics_events`.

Key APIs: `POST /v1/messages`, `POST /v1/voice`, `GET /v1/cases`, `GET /v1/cases/{id}`, `GET /v1/cases/{id}/stream` (SSE), `POST /v1/approvals/{id}/decision`, `GET /v1/audit`, `GET /v1/metrics`, `POST /webhooks/whatsapp`, `GET /healthz`.

## 8. AI reliability and evaluation

- Prompts as versioned files; system vs user content separated; user text wrapped as data
- LLM output validated by Pydantic; invalid → one retry → keyword fallback → human
- Low confidence → ask one clarifying question or escalate
- Timeouts, retries only on idempotent calls, token + ₹ cost logged per case
- **Eval set**: ~40 labelled Hinglish/Hindi/English messages (incl. injections, multi-issue, abusive, PIN-asking bait). Metrics: intent accuracy, split accuracy, injection block rate, p50/p95 latency, ₹/case
- Tests we will actually run: rules-engine unit tests (limits, boundaries ₹500/₹501), idempotency (double-submit), integration with DB, Playwright for the 4 demo scenarios, authz tests on approvals

## 9. Milestones

| # | Milestone | Done when |
|---|-----------|-----------|
| M0 | Repo, Docker, CI, lint, DB, health check | `docker compose up` works |
| M1 | Domain model, simulated connectors, seed data | Connector tests green |
| M2 | Rules engine + Skill Pack loader (Soundbox) | Boundary tests green |
| M3 | Orchestrator + Prove + audit | Soundbox scenario resolves via API |
| M4 | Understand (LLM) + multi-case split + injection guard | Eval set meets target |
| M5 | Console: cases, timeline, approvals | Playwright scenario passes |
| M6 | Merchant chat + voice (STT) | Voice note → resolved case |
| M7 | Bill-pay real PG staging refund, Settlements, Card Machine packs | Refund Status = SUCCESS |
| M8 | KPIs, embed widget, WhatsApp, docs, deploy, backup demo video | Deployed URL |

## 10. Inputs needed from you

- Deadline / demo date and team size (deck lists one person)
- Paytm PG staging MID + keys (or confirm we label refund simulated)
- API keys: Anthropic, Sarvam, Meta WhatsApp test app (keys go in `.env`, never committed)
- Whether to use your Neon/Supabase, or local Docker only for now

## 11. Decisions (confirmed by user)

- Solo build.
- **Paytm PG: fully simulated.** A `PaymentGateway` interface with a `SimulatedPaytmGateway` that mimics the real Refund / Refund Status API shape (initiate -> PENDING -> SUCCESS/FAILURE, idempotent on refund ID). Every UI/deck mention must say "simulated". A `PaytmStagingGateway` can be added later without touching the core.
- **WhatsApp: not live for now.** Web chat styled like WhatsApp instead. Channel adapter interface keeps the live integration a drop-in later.
- **Postgres in local Docker.**
- **Deploy-ready from day one:** 12-factor config (env vars only), Dockerfiles for api and web, `/healthz` + `/readyz`, migrations run on start, CORS/allowed origins configurable, no local file state, structured JSON logs, CI build.

## 12. Status (end of build)

Built and verified: M0-M8 except the items listed under "Not built" in the root README (WhatsApp, server-side STT,
real PG, UPI/Loans packs, webhooks, SSO). See README.md for how to run it and docs/ for architecture, AI evaluation,
embedding and deployment. Test results are in the final report, not repeated here so they cannot go stale.
