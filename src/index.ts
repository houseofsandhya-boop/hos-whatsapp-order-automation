import { createImmediateJob, getOrder, logWebhook, markOrderShipped, scheduleReminderJobs, upsertOrder } from "./db";
import { processDueJobs } from "./jobs";
import { fetchShopifyOrder, verifyShopifyWebhook } from "./shopify";
import type { Env, ShopifyFulfillmentPayload, ShopifyOrderPayload } from "./types";
import { asOrderId, firstPresent, json } from "./utils";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, service: "hos-whatsapp-order-automation" });
    }

    if (request.method === "GET" && url.pathname === "/admin/logs") {
      return handleLogs(request, env);
    }

    if (request.method === "POST" && url.pathname.startsWith("/webhooks/shopify/")) {
      return handleShopifyWebhook(request, env, ctx, url.pathname);
    }

    if (request.method === "POST" && url.pathname === "/admin/run-due-jobs") {
      if (!isAuthorized(request, env)) return json({ error: "Unauthorized" }, 401);
      const stats = await processDueJobs(env);
      return json({ ok: true, stats });
    }

    return json({ error: "Not found" }, 404);
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(processDueJobs(env));
  }
};

async function handleShopifyWebhook(request: Request, env: Env, ctx: ExecutionContext, path: string): Promise<Response> {
  const rawBody = await request.text();
  const topic = path.split("/").pop() || "unknown";
  const shopDomain = request.headers.get("x-shopify-shop-domain");

  const verified = await verifyShopifyWebhook(request, rawBody, env);
  if (!verified) {
    await logWebhook(env, topic, shopDomain, null, "rejected", "Invalid HMAC");
    return json({ error: "Invalid webhook signature" }, 401);
  }

  try {
    const payload = JSON.parse(rawBody) as ShopifyOrderPayload | ShopifyFulfillmentPayload;

    if (topic === "orders-create") {
      const order = payload as ShopifyOrderPayload;
      const record = await upsertOrder(env, order);
      await scheduleReminderJobs(env, record.order_id, new Date());
      await logWebhook(env, topic, shopDomain, record.order_id, "accepted");
      return json({ ok: true, order_id: record.order_id });
    }

    if (topic === "orders-cancelled") {
      const order = payload as ShopifyOrderPayload;
      const record = await upsertOrder(env, order);
      await logWebhook(env, topic, shopDomain, record.order_id, "accepted");
      return json({ ok: true, order_id: record.order_id });
    }

    if (topic === "fulfillments-create") {
      const fulfillment = payload as ShopifyFulfillmentPayload;
      const orderId = asOrderId(fulfillment.order_id);
      const knownOrder = await getOrder(env, orderId);
      if (!knownOrder) {
        const shopifyOrder = await fetchShopifyOrder(env, orderId);
        if (shopifyOrder) await upsertOrder(env, shopifyOrder);
      }
      const trackingNumber = firstPresent(fulfillment.tracking_number, fulfillment.tracking_numbers?.[0]);
      const trackingUrl = firstPresent(fulfillment.tracking_url, fulfillment.tracking_urls?.[0]);
      await markOrderShipped(env, orderId, trackingNumber, trackingUrl);
      await createImmediateJob(env, orderId, "shipped");
      await logWebhook(env, topic, shopDomain, orderId, "accepted");
      ctx.waitUntil(processDueJobs(env));
      return json({ ok: true, order_id: orderId });
    }

    await logWebhook(env, topic, shopDomain, null, "ignored", "Unknown topic");
    return json({ ok: true, ignored: topic });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logWebhook(env, topic, shopDomain, null, "failed", message);
    return json({ error: message }, 500);
  }
}

async function handleLogs(request: Request, env: Env): Promise<Response> {
  if (!isAuthorized(request, env)) return json({ error: "Unauthorized" }, 401);

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") || "50"), 100);
  const logs = await env.DB.prepare(
    `SELECT id, order_id, job_type, phone, status, provider_message_id, error, created_at
     FROM message_logs
     ORDER BY id DESC
     LIMIT ?`
  )
    .bind(limit)
    .all();
  return json({ logs: logs.results ?? [] });
}

function isAuthorized(request: Request, env: Env): boolean {
  if (!env.ADMIN_API_KEY) return false;
  const provided = request.headers.get("x-admin-api-key") || new URL(request.url).searchParams.get("key");
  return provided === env.ADMIN_API_KEY;
}
