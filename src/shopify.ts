import type { Env, ShopifyOrderPayload } from "./types";
import { firstPresent, normalizePhone } from "./utils";

interface ShopifyWebhook {
  id: number;
  topic: string;
  address: string;
}

interface ShopifyWebhookListResponse {
  webhooks?: ShopifyWebhook[];
}

interface ShopifyWebhookCreateResponse {
  webhook?: ShopifyWebhook;
}

export interface ShopifyWebhookSetupResult {
  topic: string;
  address: string;
  status: "exists" | "created" | "failed";
  id?: number;
  error?: string;
}

interface ShopifyOrderListResponse {
  orders?: ShopifyOrderPayload[];
}

interface ShopifyGraphqlOrderNode {
  legacyResourceId: string;
  name?: string;
  phone?: string | null;
  displayFulfillmentStatus?: string | null;
  cancelledAt?: string | null;
  shippingAddress?: {
    phone?: string | null;
  } | null;
  billingAddress?: {
    phone?: string | null;
  } | null;
}

interface ShopifyGraphqlResponse {
  data?: {
    orders?: {
      nodes?: ShopifyGraphqlOrderNode[];
    };
  };
  errors?: unknown;
}

const WEBHOOK_SUBSCRIPTIONS = [
  { topic: "orders/create", path: "/webhooks/shopify/orders-create" },
  { topic: "orders/cancelled", path: "/webhooks/shopify/orders-cancelled" },
  { topic: "fulfillments/create", path: "/webhooks/shopify/fulfillments-create" }
];

export async function verifyShopifyWebhook(request: Request, rawBody: string, env: Env): Promise<boolean> {
  const hmacHeader = request.headers.get("x-shopify-hmac-sha256");
  if (!hmacHeader || !env.SHOPIFY_WEBHOOK_SECRET) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.SHOPIFY_WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const computed = arrayBufferToBase64(signature);
  return timingSafeEqual(computed, hmacHeader);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

export function extractOrderPhone(order: ShopifyOrderPayload): string | null {
  return normalizePhone(
    firstPresent(
      order.phone,
      order.shipping_address?.phone,
      order.billing_address?.phone,
      order.customer?.phone,
      order.customer?.default_address?.phone
    )
  );
}

export async function fetchShopifyOrder(env: Env, orderId: string): Promise<ShopifyOrderPayload | null> {
  const version = env.SHOPIFY_API_VERSION || "2026-07";
  const shop = env.SHOPIFY_STORE_DOMAIN.replace(/^https?:\/\//, "");
  const accessToken = await getShopifyAccessToken(env, shop);
  const url = `https://${shop}/admin/api/${version}/orders/${orderId}.json?fields=id,name,phone,fulfillment_status,cancelled_at,customer,shipping_address,billing_address`;
  const response = await fetch(url, {
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Accept": "application/json"
    }
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Shopify order fetch failed: ${response.status} ${await response.text()}`);
  }
  const body = (await response.json()) as { order?: ShopifyOrderPayload };
  return body.order ?? null;
}

export async function listRecentShopifyOrders(env: Env, limit = 50): Promise<ShopifyOrderPayload[]> {
  const version = env.SHOPIFY_API_VERSION || "2026-07";
  const shop = env.SHOPIFY_STORE_DOMAIN.replace(/^https?:\/\//, "");
  const accessToken = await getShopifyAccessToken(env, shop);
  const fields = "id,name,phone,fulfillment_status,cancelled_at,customer,shipping_address,billing_address,created_at";
  const url = `https://${shop}/admin/api/${version}/orders.json?status=any&limit=${limit}&fields=${fields}`;
  const response = await fetch(url, {
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Accept": "application/json"
    }
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Shopify order list failed: ${response.status} ${text}`);
  }

  return (JSON.parse(text) as ShopifyOrderListResponse).orders ?? [];
}

export async function findShopifyOrderByName(env: Env, orderName: string): Promise<ShopifyOrderPayload | null> {
  const normalized = orderName.startsWith("#") ? orderName : `#${orderName}`;
  const graphOrder = await findShopifyOrderByGraphql(env, `name:${normalized}`);
  if (graphOrder) return graphOrder;

  const orders = await listRecentShopifyOrders(env);
  return orders.find((order) => order.name === normalized) ?? null;
}

async function findShopifyOrderByGraphql(env: Env, searchQuery: string): Promise<ShopifyOrderPayload | null> {
  const version = env.SHOPIFY_API_VERSION || "2026-07";
  const shop = env.SHOPIFY_STORE_DOMAIN.replace(/^https?:\/\//, "");
  const accessToken = await getShopifyAccessToken(env, shop);
  const query = `
    query FindOrder($query: String!) {
      orders(first: 1, query: $query) {
        nodes {
          legacyResourceId
          name
          phone
          displayFulfillmentStatus
          cancelledAt
          shippingAddress {
            phone
          }
          billingAddress {
            phone
          }
        }
      }
    }
  `;

  const response = await fetch(`https://${shop}/admin/api/${version}/graphql.json`, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify({ query, variables: { query: searchQuery } })
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Shopify order search failed: ${response.status} ${text}`);
  }

  const body = JSON.parse(text) as ShopifyGraphqlResponse;
  if (body.errors) {
    throw new Error(`Shopify order search returned errors: ${JSON.stringify(body.errors)}`);
  }

  const order = body.data?.orders?.nodes?.[0];
  if (!order) return null;

  return {
    id: order.legacyResourceId,
    name: order.name,
    phone: order.phone,
    fulfillment_status: order.displayFulfillmentStatus?.toLowerCase() ?? null,
    cancelled_at: order.cancelledAt ?? null,
    shipping_address: order.shippingAddress,
    billing_address: order.billingAddress
  };
}

export async function listShopifyWebhooks(env: Env): Promise<ShopifyWebhook[]> {
  const version = env.SHOPIFY_API_VERSION || "2026-07";
  const shop = env.SHOPIFY_STORE_DOMAIN.replace(/^https?:\/\//, "");
  const accessToken = await getShopifyAccessToken(env, shop);
  const response = await fetch(`https://${shop}/admin/api/${version}/webhooks.json?limit=250`, {
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Accept": "application/json"
    }
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Shopify webhook list failed: ${response.status} ${text}`);
  }

  return (JSON.parse(text) as ShopifyWebhookListResponse).webhooks ?? [];
}

export async function ensureShopifyWebhooks(env: Env, baseUrl: string): Promise<ShopifyWebhookSetupResult[]> {
  const version = env.SHOPIFY_API_VERSION || "2026-07";
  const shop = env.SHOPIFY_STORE_DOMAIN.replace(/^https?:\/\//, "");
  const accessToken = await getShopifyAccessToken(env, shop);
  const apiBase = `https://${shop}/admin/api/${version}`;
  const headers = {
    "X-Shopify-Access-Token": accessToken,
    "Accept": "application/json",
    "Content-Type": "application/json"
  };

  const existing = await listShopifyWebhooks(env);
  const results: ShopifyWebhookSetupResult[] = [];

  for (const subscription of WEBHOOK_SUBSCRIPTIONS) {
    const address = new URL(subscription.path, baseUrl).toString();
    const alreadyPresent = existing.find(
      (webhook) => webhook.topic === subscription.topic && webhook.address === address
    );

    if (alreadyPresent) {
      results.push({ topic: subscription.topic, address, status: "exists", id: alreadyPresent.id });
      continue;
    }

    const createResponse = await fetch(`${apiBase}/webhooks.json`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        webhook: {
          topic: subscription.topic,
          address,
          format: "json"
        }
      })
    });
    const createText = await createResponse.text();

    if (!createResponse.ok) {
      results.push({
        topic: subscription.topic,
        address,
        status: "failed",
        error: `Shopify webhook create failed: ${createResponse.status} ${createText}`
      });
      continue;
    }

    const created = (JSON.parse(createText) as ShopifyWebhookCreateResponse).webhook;
    results.push({ topic: subscription.topic, address, status: "created", id: created?.id });
  }

  return results;
}

export async function getShopifyAccessToken(env: Env, shopDomain?: string): Promise<string> {
  if (!env.SHOPIFY_CLIENT_ID?.trim() || !env.SHOPIFY_CLIENT_SECRET?.trim()) {
    if (env.SHOPIFY_ADMIN_TOKEN?.trim()) return env.SHOPIFY_ADMIN_TOKEN.trim();
    throw new Error("Missing Shopify credentials. Set SHOPIFY_ADMIN_TOKEN or SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET.");
  }

  const shop = (shopDomain || env.SHOPIFY_STORE_DOMAIN).replace(/^https?:\/\//, "");
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: env.SHOPIFY_CLIENT_ID.trim(),
    client_secret: env.SHOPIFY_CLIENT_SECRET.trim()
  });

  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Shopify token request failed: ${response.status} ${text}`);
  }

  const data = JSON.parse(text) as { access_token?: string };
  if (!data.access_token) throw new Error("Shopify token response did not include access_token");
  return data.access_token;
}
