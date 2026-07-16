# House Of Sandhya WhatsApp Order Automation

Lean Cloudflare Worker automation for Shopify order updates over WhatsApp Cloud API.

## Flow

```text
Shopify order created
-> save order in Cloudflare D1
-> schedule day 2, day 4, day 6 reminder jobs
-> cron checks due jobs every 30 minutes
-> before sending, fetch latest Shopify fulfillment status
-> if still unfulfilled, send WhatsApp Utility template
-> fulfillment created webhook sends tracking template
```

## Stack

- Cloudflare Workers: backend webhook/API
- Cloudflare D1: orders, jobs, logs
- Cloudflare Cron Triggers: due-job processor
- Shopify Webhooks + Admin API: order events and fulfillment status
- Meta WhatsApp Cloud API: approved template messages

## Required Secrets

Set these with `wrangler secret put`:

```bash
wrangler secret put SHOPIFY_WEBHOOK_SECRET
wrangler secret put SHOPIFY_ADMIN_TOKEN
wrangler secret put SHOPIFY_STORE_DOMAIN
wrangler secret put WHATSAPP_TOKEN
wrangler secret put WHATSAPP_PHONE_NUMBER_ID
wrangler secret put ADMIN_API_KEY
```

`SHOPIFY_STORE_DOMAIN` should look like:

```text
houseofsandhya.myshopify.com
```

## Cloudflare Setup

Create D1 database:

```bash
wrangler d1 create hos-whatsapp-automation
```

Copy the returned `database_id` into `wrangler.toml`.

Apply schema locally or remotely:

```bash
wrangler d1 migrations apply hos-whatsapp-automation --remote
```

Deploy:

```bash
pnpm install
pnpm run check
pnpm run deploy
```

## Shopify Webhooks

Point Shopify webhooks to the deployed Worker URL:

```text
orders/create        -> https://YOUR-WORKER.workers.dev/webhooks/shopify/orders-create
orders/cancelled     -> https://YOUR-WORKER.workers.dev/webhooks/shopify/orders-cancelled
fulfillments/create  -> https://YOUR-WORKER.workers.dev/webhooks/shopify/fulfillments-create
```

Use the same webhook secret as `SHOPIFY_WEBHOOK_SECRET`.

## WhatsApp Templates

Create and approve Utility templates in Meta:

```text
order_processing_update
Body: Hi, your order {{1}} is currently being prepared and processed. We will notify you once it is shipped. - House Of Sandhya

order_quality_check
Body: Update: Your order {{1}} is in process and quality check. Thanks for your patience. - House Of Sandhya

order_ready_dispatch
Body: Your order {{1}} is almost ready for dispatch. We will share tracking details as soon as it ships. - House Of Sandhya

order_shipped_tracking
Body: Good news! Your order {{1}} has been shipped. Tracking ID: {{2}}. Track here: {{3}} - House Of Sandhya
```

If template names differ, update `wrangler.toml`.

## Useful Endpoints

Health:

```text
GET /health
```

Manually process due jobs:

```text
POST /admin/run-due-jobs
Header: x-admin-api-key: YOUR_ADMIN_API_KEY
```

Recent message logs:

```text
GET /admin/logs?key=YOUR_ADMIN_API_KEY
```

## Notes

- Phone numbers are normalized for India. A 10-digit number becomes `91XXXXXXXXXX`.
- If an order is already fulfilled or cancelled at job time, the reminder is skipped.
- This is intentionally lean: no dashboard, no campaign system, no live courier tracking yet.
