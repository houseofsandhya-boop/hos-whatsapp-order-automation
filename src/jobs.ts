import { getOrder, getDueJobs, logMessage, markJobStatus, updateOrderStatus } from "./db";
import { fetchShopifyOrder, extractOrderPhone } from "./shopify";
import type { Env, JobRecord, JobType, OrderRecord, ShopifyOrderPayload } from "./types";
import { isCancelled, isFulfilled } from "./utils";
import { sendWhatsAppTemplate } from "./whatsapp";

export async function processDueJobs(env: Env): Promise<{ processed: number; sent: number; skipped: number; failed: number }> {
  const jobs = await getDueJobs(env);
  const stats = { processed: 0, sent: 0, skipped: 0, failed: 0 };

  for (const job of jobs) {
    stats.processed += 1;
    try {
      const outcome = await processJob(env, job);
      stats[outcome] += 1;
    } catch (error) {
      stats.failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      await markJobStatus(env, job.id, "failed", message);
      await logMessage(env, job.order_id, job.job_type, null, "failed", null, message);
    }
  }

  return stats;
}

async function processJob(env: Env, job: JobRecord): Promise<"sent" | "skipped" | "failed"> {
  const existing = await getOrder(env, job.order_id);
  if (!existing) {
    await markJobStatus(env, job.id, "skipped", "Order not found");
    return "skipped";
  }

  const latest = await fetchShopifyOrder(env, job.order_id);
  if (!latest) {
    await markJobStatus(env, job.id, "skipped", "Shopify order not found");
    await logMessage(env, job.order_id, job.job_type, existing.phone, "skipped", null, "Shopify order not found");
    return "skipped";
  }

  const latestPhone = extractOrderPhone(latest);
  await updateOrderStatus(env, job.order_id, latest.fulfillment_status ?? null, latest.cancelled_at ?? null, latestPhone);
  const order: OrderRecord = {
    ...existing,
    phone: latestPhone ?? existing.phone,
    fulfillment_status: latest.fulfillment_status ?? null,
    cancelled_at: latest.cancelled_at ?? null
  };

  if (isCancelled(order.cancelled_at)) {
    await markJobStatus(env, job.id, "skipped", "Order cancelled");
    await logMessage(env, job.order_id, job.job_type, order.phone, "skipped", null, "Order cancelled");
    return "skipped";
  }

  if (job.job_type !== "shipped" && isFulfilled(order.fulfillment_status)) {
    await markJobStatus(env, job.id, "skipped", "Order already fulfilled");
    await logMessage(env, job.order_id, job.job_type, order.phone, "skipped", null, "Order already fulfilled");
    return "skipped";
  }

  if (!order.phone) {
    await markJobStatus(env, job.id, "failed", "No customer phone");
    await logMessage(env, job.order_id, job.job_type, null, "failed", null, "No customer phone");
    return "failed";
  }

  const template = templateForJob(env, job.job_type);
  const params = paramsForJob(job.job_type, order, latest);
  const providerId = await sendWhatsAppTemplate(env, order.phone, template, params);
  await markJobStatus(env, job.id, "sent");
  await logMessage(env, job.order_id, job.job_type, order.phone, "sent", providerId);
  return "sent";
}

function templateForJob(env: Env, jobType: JobType): string {
  if (env.FORCE_WHATSAPP_TEMPLATE?.trim()) return env.FORCE_WHATSAPP_TEMPLATE.trim();

  switch (jobType) {
    case "reminder_2d":
      return env.REMINDER_2D_TEMPLATE || "order_processing_update";
    case "reminder_4d":
      return env.REMINDER_4D_TEMPLATE || "order_quality_check";
    case "reminder_6d":
      return env.REMINDER_6D_TEMPLATE || "order_ready_dispatch";
    case "shipped":
      return env.SHIPPED_TEMPLATE || "order_shipped_tracking";
  }
}

function paramsForJob(jobType: JobType, order: OrderRecord, latest: ShopifyOrderPayload): string[] {
  if (jobType === "shipped") {
    return [
      order.order_name,
      order.tracking_number || "Will be updated soon",
      order.tracking_url || "Tracking link will be shared soon"
    ];
  }
  return [order.order_name];
}
