export interface Env {
  DB: D1Database;
  SHOPIFY_WEBHOOK_SECRET: string;
  SHOPIFY_ADMIN_TOKEN: string;
  SHOPIFY_STORE_DOMAIN: string;
  SHOPIFY_API_VERSION?: string;
  WHATSAPP_TOKEN: string;
  WHATSAPP_PHONE_NUMBER_ID: string;
  WHATSAPP_GRAPH_VERSION?: string;
  WHATSAPP_TEMPLATE_LANGUAGE?: string;
  REMINDER_2D_TEMPLATE?: string;
  REMINDER_4D_TEMPLATE?: string;
  REMINDER_6D_TEMPLATE?: string;
  SHIPPED_TEMPLATE?: string;
  ADMIN_API_KEY?: string;
}

export interface ShopifyOrderPayload {
  id: number | string;
  name?: string;
  phone?: string | null;
  created_at?: string;
  fulfillment_status?: string | null;
  cancelled_at?: string | null;
  customer?: {
    phone?: string | null;
    default_address?: {
      phone?: string | null;
    } | null;
  } | null;
  shipping_address?: {
    phone?: string | null;
  } | null;
  billing_address?: {
    phone?: string | null;
  } | null;
}

export interface ShopifyFulfillmentPayload {
  id: number | string;
  order_id: number | string;
  tracking_number?: string | null;
  tracking_numbers?: string[] | null;
  tracking_url?: string | null;
  tracking_urls?: string[] | null;
  status?: string | null;
}

export type JobType = "reminder_2d" | "reminder_4d" | "reminder_6d" | "shipped";

export interface OrderRecord {
  order_id: string;
  order_name: string;
  phone: string | null;
  fulfillment_status: string | null;
  cancelled_at: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
}

export interface JobRecord {
  id: number;
  order_id: string;
  job_type: JobType;
  due_at: string;
  attempts: number;
}
