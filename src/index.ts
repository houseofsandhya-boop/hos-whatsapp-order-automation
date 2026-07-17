import { createImmediateJob, getOrder, logWebhook, markOrderShipped, scheduleReminderJobs, upsertOrder } from "./db";
import { processDueJobs } from "./jobs";
import {
  ensureShopifyWebhooks,
  extractOrderPhone,
  fetchShopifyOrder,
  findShopifyOrderByName,
  listShopifyWebhooks,
  verifyShopifyWebhook
} from "./shopify";
import type { Env, ShopifyFulfillmentPayload, ShopifyOrderPayload } from "./types";
import { asOrderId, firstPresent, json } from "./utils";
import { sendWhatsAppTemplate } from "./whatsapp";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
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

    if (request.method === "POST" && url.pathname === "/admin/setup-shopify-webhooks") {
      if (!isAuthorized(request, env)) return json({ error: "Unauthorized" }, 401);
      try {
        const results = await ensureShopifyWebhooks(env, url.origin);
        const failed = results.filter((result) => result.status === "failed");
        return json({ ok: failed.length === 0, results }, failed.length ? 502 : 200);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return json({ ok: false, error: message }, 502);
      }
    }

    if (request.method === "GET" && url.pathname === "/admin/shopify-webhooks") {
      if (!isAuthorized(request, env)) return json({ error: "Unauthorized" }, 401);
      try {
        const webhooks = await listShopifyWebhooks(env);
        return json({ ok: true, webhooks });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return json({ ok: false, error: message }, 502);
      }
    }

    if (request.method === "POST" && url.pathname === "/admin/test-whatsapp") {
      if (!isAuthorized(request, env)) return json({ error: "Unauthorized" }, 401);
      const to = url.searchParams.get("to");
      const template = url.searchParams.get("template") || "hello_world";
      if (!to) return json({ error: "Missing ?to=91XXXXXXXXXX" }, 400);
      try {
        const providerMessageId = await sendWhatsAppTemplate(env, to, template, []);
        return json({ ok: true, providerMessageId });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return json({ ok: false, error: message }, 502);
      }
    }

    if ((request.method === "GET" || request.method === "POST") && url.pathname === "/admin/test-shopify") {
      if (!isAuthorized(request, env)) return json({ error: "Unauthorized" }, 401);
      const orderId = url.searchParams.get("orderId");
      if (!orderId) return json({ error: "Missing ?orderId=SHOPIFY_ORDER_ID" }, 400);
      try {
        const order = await fetchShopifyOrder(env, orderId);
        if (!order) return json({ ok: false, error: "Order not found" }, 404);
        return json({
          ok: true,
          order: {
            id: order.id,
            name: order.name,
            fulfillment_status: order.fulfillment_status ?? null,
            cancelled_at: order.cancelled_at ?? null,
            phone: extractOrderPhone(order)
          }
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return json({ ok: false, error: message }, 502);
      }
    }

    if (request.method === "GET" && url.pathname === "/admin/find-shopify-order") {
      if (!isAuthorized(request, env)) return json({ error: "Unauthorized" }, 401);
      const name = url.searchParams.get("name");
      if (!name) return json({ error: "Missing ?name=5492" }, 400);
      try {
        const order = await findShopifyOrderByName(env, name);
        if (!order) return json({ ok: false, error: "Order not found in recent Shopify orders" }, 404);
        return json({ ok: true, order: summarizeOrder(order) });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return json({ ok: false, error: message }, 502);
      }
    }

    if (request.method === "POST" && url.pathname === "/admin/sync-shopify-order") {
      if (!isAuthorized(request, env)) return json({ error: "Unauthorized" }, 401);
      const orderId = url.searchParams.get("orderId");
      const name = url.searchParams.get("name");
      if (!orderId && !name) return json({ error: "Missing ?orderId=SHOPIFY_ORDER_ID or ?name=5492" }, 400);
      try {
        const order = orderId ? await fetchShopifyOrder(env, orderId) : await findShopifyOrderByName(env, name || "");
        if (!order) return json({ ok: false, error: "Order not found" }, 404);
        const record = await upsertOrder(env, order);
        await scheduleReminderJobs(env, record.order_id, new Date());
        return json({ ok: true, order: summarizeOrder(order), scheduled: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return json({ ok: false, error: message }, 502);
      }
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

function summarizeOrder(order: ShopifyOrderPayload) {
  return {
    id: order.id,
    name: order.name,
    fulfillment_status: order.fulfillment_status ?? null,
    cancelled_at: order.cancelled_at ?? null,
    phone: extractOrderPhone(order)
  };
}

function isAuthorized(request: Request, env: Env): boolean {
  if (!env.ADMIN_API_KEY) return false;
  const provided = request.headers.get("x-admin-api-key") || new URL(request.url).searchParams.get("key");
  return Boolean(provided && provided.trim() === env.ADMIN_API_KEY.trim());
}
