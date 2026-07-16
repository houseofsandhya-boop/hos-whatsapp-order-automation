import type { Env, JobRecord, JobType, OrderRecord, ShopifyOrderPayload } from "./types";
import { addDays, asOrderId, nowIso } from "./utils";
import { extractOrderPhone } from "./shopify";

const REMINDER_DAYS: Array<[JobType, number]> = [
  ["reminder_2d", 2],
  ["reminder_4d", 4],
  ["reminder_6d", 6]
];

export async function upsertOrder(env: Env, order: ShopifyOrderPayload): Promise<OrderRecord> {
  const timestamp = nowIso();
  const orderId = asOrderId(order.id);
  const orderName = order.name || `#${orderId}`;
  const phone = extractOrderPhone(order);

  await env.DB.prepare(
    `INSERT INTO orders (
      order_id, order_name, phone, fulfillment_status, cancelled_at, raw_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(order_id) DO UPDATE SET
      order_name = excluded.order_name,
      phone = COALESCE(excluded.phone, orders.phone),
      fulfillment_status = excluded.fulfillment_status,
      cancelled_at = excluded.cancelled_at,
      raw_json = excluded.raw_json,
      updated_at = excluded.updated_at`
  )
    .bind(
      orderId,
      orderName,
      phone,
      order.fulfillment_status ?? null,
      order.cancelled_at ?? null,
      JSON.stringify(order),
      timestamp,
      timestamp
    )
    .run();

  const record = await getOrder(env, orderId);
  if (!record) throw new Error(`Failed to load order ${orderId} after upsert`);
  return record;
}

export async function scheduleReminderJobs(env: Env, orderId: string, baseDate = new Date()): Promise<void> {
  const timestamp = nowIso();
  const statements = REMINDER_DAYS.map(([jobType, days]) =>
    env.DB.prepare(
      `INSERT OR IGNORE INTO message_jobs (order_id, job_type, due_at, status, created_at, updated_at)
       VALUES (?, ?, ?, 'pending', ?, ?)`
    ).bind(orderId, jobType, addDays(baseDate, days), timestamp, timestamp)
  );
  await env.DB.batch(statements);
}

export async function getOrder(env: Env, orderId: string): Promise<OrderRecord | null> {
  return await env.DB.prepare(
    `SELECT order_id, order_name, phone, fulfillment_status, cancelled_at, tracking_number, tracking_url
     FROM orders WHERE order_id = ?`
  )
    .bind(orderId)
    .first<OrderRecord>();
}

export async function updateOrderStatus(
  env: Env,
  orderId: string,
  fulfillmentStatus: string | null,
  cancelledAt: string | null,
  phone?: string | null
): Promise<void> {
  await env.DB.prepare(
    `UPDATE orders SET
      fulfillment_status = ?,
      cancelled_at = ?,
      phone = COALESCE(?, phone),
      updated_at = ?
     WHERE order_id = ?`
  )
    .bind(fulfillmentStatus, cancelledAt, phone ?? null, nowIso(), orderId)
    .run();
}

export async function markOrderShipped(
  env: Env,
  orderId: string,
  trackingNumber: string | null,
  trackingUrl: string | null
): Promise<void> {
  await env.DB.prepare(
    `UPDATE orders SET
      fulfillment_status = 'fulfilled',
      tracking_number = COALESCE(?, tracking_number),
      tracking_url = COALESCE(?, tracking_url),
      updated_at = ?
     WHERE order_id = ?`
  )
    .bind(trackingNumber, trackingUrl, nowIso(), orderId)
    .run();
}

export async function createImmediateJob(env: Env, orderId: string, jobType: JobType): Promise<void> {
  const timestamp = nowIso();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO message_jobs (order_id, job_type, due_at, status, created_at, updated_at)
     VALUES (?, ?, ?, 'pending', ?, ?)`
  )
    .bind(orderId, jobType, timestamp, timestamp, timestamp)
    .run();
}

export async function getDueJobs(env: Env, limit = 50): Promise<JobRecord[]> {
  const result = await env.DB.prepare(
    `SELECT id, order_id, job_type, due_at, attempts
     FROM message_jobs
     WHERE status = 'pending' AND due_at <= ?
     ORDER BY due_at ASC
     LIMIT ?`
  )
    .bind(nowIso(), limit)
    .all<JobRecord>();
  return result.results ?? [];
}

export async function markJobStatus(env: Env, jobId: number, status: string, error?: string | null): Promise<void> {
  await env.DB.prepare(
    `UPDATE message_jobs SET status = ?, attempts = attempts + 1, last_error = ?, updated_at = ? WHERE id = ?`
  )
    .bind(status, error ?? null, nowIso(), jobId)
    .run();
}

export async function logMessage(
  env: Env,
  orderId: string,
  jobType: JobType,
  phone: string | null,
  status: string,
  providerMessageId?: string | null,
  error?: string | null
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO message_logs (order_id, job_type, phone, status, provider_message_id, error, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(orderId, jobType, phone, status, providerMessageId ?? null, error ?? null, nowIso())
    .run();
}

export async function logWebhook(
  env: Env,
  topic: string,
  shopDomain: string | null,
  payloadId: string | null,
  status: string,
  error?: string | null
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO webhook_events (topic, shop_domain, payload_id, status, error, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(topic, shopDomain, payloadId, status, error ?? null, nowIso())
    .run();
}
