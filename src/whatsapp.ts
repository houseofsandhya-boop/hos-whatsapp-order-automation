import type { Env } from "./types";

interface TemplateParameter {
  type: "text";
  text: string;
}

export async function sendWhatsAppTemplate(
  env: Env,
  to: string,
  templateName: string,
  params: string[]
): Promise<string | null> {
  const graphVersion = env.WHATSAPP_GRAPH_VERSION || "v23.0";
  const language = env.WHATSAPP_TEMPLATE_LANGUAGE || "en_US";
  const url = `https://graph.facebook.com/${graphVersion}/${env.WHATSAPP_PHONE_NUMBER_ID.trim()}/messages`;

  const safeParams = templateName === "hello_world" ? [] : params;
  const parameters: TemplateParameter[] = safeParams.map((text) => ({ type: "text", text }));
  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: language },
      components: parameters.length
        ? [
            {
              type: "body",
              parameters
            }
          ]
        : undefined
    }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.WHATSAPP_TOKEN.trim()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`WhatsApp send failed: ${response.status} ${bodyText}`);
  }

  const body = JSON.parse(bodyText) as { messages?: Array<{ id?: string }> };
  return body.messages?.[0]?.id ?? null;
}
