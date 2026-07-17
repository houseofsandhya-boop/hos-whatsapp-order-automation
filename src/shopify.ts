import type { Env, ShopifyOrderPayload } from "./types";
import { firstPresent, normalizePhone } from "./utils";

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
