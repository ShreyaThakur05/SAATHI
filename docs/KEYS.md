# Keys and where to get them

Nothing is required to run locally. Every key below is optional until the stage noted.

| Key / value | Where it goes | Where to get it | When |
|---|---|---|---|
| **Sarvam API key** | `SAATHI_SARVAM_API_KEY` (api) | Create an account and key at https://indus.sarvam.ai/key-management. New accounts get free credits (₹100 at the time of writing; check the dashboard). Sent as the `api-subscription-key` header. | Turns on language-model understanding. Without it the keyword fallback runs |
| Anthropic API key (alternative) | `SAATHI_ANTHROPIC_API_KEY` (api) | https://console.anthropic.com, API keys | Only if you prefer Claude. If both keys are set, Sarvam is used unless `SAATHI_LLM_PROVIDER=anthropic` |
| Token prices | `SAATHI_LLM_INPUT_USD_PER_MTOK`, `SAATHI_LLM_OUTPUT_USD_PER_MTOK` | Your Sarvam plan's pricing page (https://sarvam.ai/api-pricing) | So Insights can report a real ₹ AI cost per ticket |
| JWT secret | `SAATHI_JWT_SECRET` (api) | You generate it: `openssl rand -hex 32` | **Required in production** (the API refuses to start without it) |
| Host API key | `SAATHI_HOST_API_KEY` (api, and the host backend) | You generate it: `openssl rand -hex 32` | **Required in production**. Lets the host mint merchant tokens |
| Database URL | `SAATHI_DATABASE_URL` (api) | Your Postgres host (Neon, Supabase, RDS) | Deployment |
| API URL | `NEXT_PUBLIC_API_URL` (web, **build time**) | Where you deploy the API | Deployment |

## Not used by this build

* **Paytm Payment Gateway staging** (MID + merchant key): issued from the API Keys section of a Paytm merchant dashboard.
  Staging host is `securegw-stage.paytm.in`. The payment gateway is **simulated** here, so this is only needed if you
  build a real `PaymentGateway` connector.
* **WhatsApp Cloud API**: Meta for Developers, WhatsApp product. WhatsApp is not built.
* **Sarvam speech-to-text**: the same Sarvam key covers it, but server-side STT is not built (the browser's speech
  recognition is used).

## Generated secrets

`SAATHI_JWT_SECRET` and `SAATHI_HOST_API_KEY` are random values you create once (`openssl rand -hex 32`) and store in your
host's secret manager. Use different values for production than for local development. Never commit them.
To test a database URL, see "Testing a database URL" in DEPLOY.md.

## Verify a key works

```bash
cd api && SAATHI_SARVAM_API_KEY=... uv run python -m app.eval.run
```

The first line printed shows `modes: {'sarvam': N}` when the model answered; `{'keyword': N}` means every call failed
and fell back (check the key, quota, or model name; failures are logged as `understand_llm_failed_fallback_to_keyword`).
