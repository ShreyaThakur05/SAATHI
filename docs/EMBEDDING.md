# Embedding Saathi in a Paytm dashboard

The app's own merchant dashboard (`/app`) is the reference host: Saathi is a docked drawer that any page can open with
context (`useSaathi().ask("...")`), and the dashboard reads the same systems Saathi changes. The widget below is how a
*different* host app gets the same thing.

Three tiers, from least to most work for the host team.

## 1. Drop-in widget (built, tested)

```html
<script src="https://saathi.example/saathi-widget.js" defer></script>
<saathi-widget token="{token}" lang="hi" primary="#00b9f5"></saathi-widget>
```

1. The **host backend** mints a token: `POST /v1/embed/token` with header `X-Saathi-Host-Key` and body
   `{"merchant_id": 123, "language": "hi"}`. It returns a 30-minute `scope=merchant` token. The host key never
   reaches the browser. In the demo, `web/app/api/demo/session/route.ts` plays this role.
2. The widget is a Shadow-DOM web component, so host CSS cannot break it and it cannot break the host. It renders a
   launcher and an iframe to `/chat`; the token travels in the URL **hash** so it is never sent to a server.
3. **Theming:** `primary` (validated as `#rrggbb`) and `lang` (`hi`, `hinglish`, `en`).
4. **Events** (CustomEvent on the element): `saathi-ready`, `saathi-message-sent`, `saathi-case-update`
   (`{state, case_ids}`), `saathi-token-expired`. Methods: `open()`, `close()`, `toggle()`. Messages are accepted only
   from the widget's own iframe and origin.
5. **Security:** `/chat` is the only route that can be framed, and only by origins listed in `FRAME_ANCESTORS`.
   Everything else sends `frame-ancestors 'none'`.

See it working at `/embed-demo` (an illustrative host page, not a Paytm screen).

## 2. Components or SDK (not built)

`CaseTimeline`, `ApprovalCard`, `KpiStrip` already exist as React components in `web/components`. Publishing them as
a package so Paytm's own console can mount them with its own auth is mechanical but has not been done; today they
read the staff token from this app's auth store.

## 3. Headless API (built)

Everything the UI does is a documented REST call (`/docs` on the API serves the OpenAPI spec): create messages, read
cases, steps, approvals, audit and metrics. Webhooks (`case.resolved`, `case.escalated`) are **not** built.

## Going live: swapping the simulated systems

The core only depends on the Protocols in `api/app/connectors/base.py` (`DeviceClient`, `BillingClient`,
`LogisticsClient`, `SettlementClient`, `BillerClient`, `PaymentGateway`). To go live, implement them against Paytm's
internal services and register them in `services/connectors.py`. The `PaymentGateway` protocol deliberately mirrors
the shape of the Refund and Refund Status APIs (idempotent refund id, PENDING → SUCCESS/FAILURE).
