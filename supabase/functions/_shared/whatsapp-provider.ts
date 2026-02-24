// Shared WhatsApp provider abstraction for Edge Functions
// This module resolves the correct API provider (UAZAPI, Evolution, WAHA)
// from the database and provides adapter functions for each provider.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type ProviderType = "uazapi" | "evolution" | "waha" | "custom";

export interface ProviderConfig {
  id: string;
  provider_type: ProviderType;
  base_url: string;
  api_token: string;
  extra_config: Record<string, unknown>;
}

/** Resolve the default provider from the database, falling back to env vars (UAZAPI_URL/UAZAPI_TOKEN). */
export async function resolveProvider(
  supabaseUrl: string,
  supabaseServiceKey: string,
  instanceId?: string
): Promise<ProviderConfig> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // 1. If instance has a linked provider, use that
  if (instanceId) {
    const { data: instance } = await supabase
      .from("whatsapp_instances")
      .select("provider_id")
      .eq("id", instanceId)
      .maybeSingle();

    if (instance?.provider_id) {
      const { data: provider } = await supabase
        .from("whatsapp_api_providers")
        .select("id, provider_type, base_url, api_token, extra_config")
        .eq("id", instance.provider_id)
        .eq("is_active", true)
        .maybeSingle();

      if (provider) {
        return {
          id: provider.id,
          provider_type: provider.provider_type as ProviderType,
          base_url: provider.base_url.replace(/\/+$/, ""),
          api_token: provider.api_token,
          extra_config: (provider.extra_config as Record<string, unknown>) ?? {},
        };
      }
    }
  }

  // 2. Try to find the default provider
  const { data: defaultProvider } = await supabase
    .from("whatsapp_api_providers")
    .select("id, provider_type, base_url, api_token, extra_config")
    .eq("is_default", true)
    .eq("is_active", true)
    .maybeSingle();

  if (defaultProvider) {
    return {
      id: defaultProvider.id,
      provider_type: defaultProvider.provider_type as ProviderType,
      base_url: defaultProvider.base_url.replace(/\/+$/, ""),
      api_token: defaultProvider.api_token,
      extra_config: (defaultProvider.extra_config as Record<string, unknown>) ?? {},
    };
  }

  // 3. Fallback: use env vars (backward compatibility with UAZAPI)
  const envUrl = Deno.env.get("UAZAPI_URL") || "https://zynk2.uazapi.com";
  const envToken = Deno.env.get("UAZAPI_TOKEN") || "";

  return {
    id: "env-fallback",
    provider_type: "uazapi",
    base_url: envUrl.replace(/\/+$/, ""),
    api_token: envToken,
    extra_config: {},
  };
}

// ── Adapter helpers per provider ──

/** Build headers for API calls to the provider */
export function buildHeaders(provider: ProviderConfig, instanceToken?: string): Record<string, string> {
  const token = instanceToken || provider.api_token;

  switch (provider.provider_type) {
    case "evolution":
      return {
        "Content-Type": "application/json",
        apikey: token,
      };
    case "waha":
      return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };
    case "uazapi":
    case "custom":
    default:
      return {
        "Content-Type": "application/json",
        "Admin-Token": token,
      };
  }
}

/** Build the URL to send a text message */
export function sendTextUrl(provider: ProviderConfig, instanceName?: string): string {
  switch (provider.provider_type) {
    case "evolution":
      return `${provider.base_url}/message/sendText/${instanceName || "default"}`;
    case "waha":
      return `${provider.base_url}/api/sendText`;
    case "uazapi":
    case "custom":
    default:
      return `${provider.base_url}/send/text`;
  }
}

/** Build the body for sending a text message */
export function sendTextBody(
  provider: ProviderConfig,
  phone: string,
  text: string,
  _instanceName?: string
): Record<string, unknown> {
  switch (provider.provider_type) {
    case "evolution":
      return { number: phone, text };
    case "waha":
      return { chatId: `${phone}@c.us`, text, session: "default" };
    case "uazapi":
    case "custom":
    default:
      return { number: phone, text };
  }
}

/** Build the URL to send media */
export function sendMediaUrl(provider: ProviderConfig, instanceName?: string): string {
  switch (provider.provider_type) {
    case "evolution":
      return `${provider.base_url}/message/sendMedia/${instanceName || "default"}`;
    case "waha":
      return `${provider.base_url}/api/sendFile`;
    case "uazapi":
    case "custom":
    default:
      return `${provider.base_url}/send/media`;
  }
}

/** Build the body for sending media */
export function sendMediaBody(
  provider: ProviderConfig,
  phone: string,
  mediaUrl: string,
  mediaType: string,
  caption?: string,
  fileName?: string
): Record<string, unknown> {
  switch (provider.provider_type) {
    case "evolution":
      return {
        number: phone,
        mediatype: mediaType,
        media: mediaUrl,
        caption: caption || "",
        fileName: fileName || "",
      };
    case "waha":
      return {
        chatId: `${phone}@c.us`,
        file: { url: mediaUrl, filename: fileName || "file" },
        caption: caption || "",
        session: "default",
      };
    case "uazapi":
    case "custom":
    default:
      return {
        number: phone,
        media: mediaUrl,
        type: mediaType,
        caption: caption || "",
        fileName: fileName || "",
      };
  }
}

/** Build the URL to check if a number exists on WhatsApp */
export function checkNumberUrl(provider: ProviderConfig, instanceName?: string): string {
  switch (provider.provider_type) {
    case "evolution":
      return `${provider.base_url}/chat/whatsappNumbers/${instanceName || "default"}`;
    case "waha":
      return `${provider.base_url}/api/contacts/check-exists`;
    case "uazapi":
    case "custom":
    default:
      return `${provider.base_url}/chat/checkNumber`;
  }
}

/** Build the URL to fetch chats */
export function fetchChatsUrl(provider: ProviderConfig, instanceName?: string): string {
  switch (provider.provider_type) {
    case "evolution":
      return `${provider.base_url}/chat/findChats/${instanceName || "default"}`;
    case "waha":
      return `${provider.base_url}/api/${instanceName || "default"}/chats`;
    case "uazapi":
    case "custom":
    default:
      return `${provider.base_url}/chat/find`;
  }
}

/** Build the URL to archive a chat */
export function archiveChatUrl(provider: ProviderConfig, instanceName?: string): string {
  switch (provider.provider_type) {
    case "evolution":
      return `${provider.base_url}/chat/archive/${instanceName || "default"}`;
    case "waha":
      return `${provider.base_url}/api/chats/archive`;
    case "uazapi":
    case "custom":
    default:
      return `${provider.base_url}/chat/archive`;
  }
}

/** Build the URL to send presence/typing indicator */
export function sendPresenceUrl(provider: ProviderConfig, instanceName?: string): string {
  switch (provider.provider_type) {
    case "evolution":
      return `${provider.base_url}/chat/presence/${instanceName || "default"}`;
    case "waha":
      return `${provider.base_url}/api/startTyping`;
    case "uazapi":
    case "custom":
    default:
      return `${provider.base_url}/chat/presence`;
  }
}

/** Build the URL to send read receipt */
export function sendReadReceiptUrl(provider: ProviderConfig, instanceName?: string): string {
  switch (provider.provider_type) {
    case "evolution":
      return `${provider.base_url}/chat/markMessageAsRead/${instanceName || "default"}`;
    case "waha":
      return `${provider.base_url}/api/sendSeen`;
    case "uazapi":
    case "custom":
    default:
      return `${provider.base_url}/chat/markread`;
  }
}
