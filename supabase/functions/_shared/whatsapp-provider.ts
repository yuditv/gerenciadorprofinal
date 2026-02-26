// Shared WhatsApp provider abstraction for Edge Functions
// This module resolves the correct API provider from the whatsapp_api_providers table.
// NO hardcoded URLs or env var fallbacks — only what the admin configures in the panel.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type ProviderType = "uazapi" | "evolution" | "waha" | "custom";

export interface ProviderConfig {
  id: string;
  provider_type: ProviderType;
  base_url: string;
  api_token: string;
  extra_config: Record<string, unknown>;
}

/**
 * Resolve the provider from the database.
 * Priority: 1) Instance-linked provider → 2) Default provider → 3) Any active provider → null
 * NO env var fallback — only what the admin configures in the panel.
 */
export async function resolveProvider(
  supabaseUrl: string,
  supabaseServiceKey: string,
  instanceId?: string
): Promise<ProviderConfig | null> {
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
        return toConfig(provider);
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
    return toConfig(defaultProvider);
  }

  // 3. Try any active provider
  const { data: anyProvider } = await supabase
    .from("whatsapp_api_providers")
    .select("id, provider_type, base_url, api_token, extra_config")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (anyProvider) {
    return toConfig(anyProvider);
  }

  // No provider configured
  return null;
}

function toConfig(provider: Record<string, unknown>): ProviderConfig {
  return {
    id: provider.id as string,
    provider_type: provider.provider_type as ProviderType,
    base_url: (provider.base_url as string).replace(/\/+$/, ""),
    api_token: provider.api_token as string,
    extra_config: (provider.extra_config as Record<string, unknown>) ?? {},
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
        token: token,
      };
  }
}

/** Build admin headers (for instance management operations) */
export function buildAdminHeaders(provider: ProviderConfig): Record<string, string> {
  switch (provider.provider_type) {
    case "evolution":
      return {
        "Content-Type": "application/json",
        apikey: provider.api_token,
      };
    case "waha":
      return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.api_token}`,
      };
    case "uazapi":
    case "custom":
    default:
      return {
        "Content-Type": "application/json",
        admintoken: provider.api_token,
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
        file: mediaUrl,
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

/** Build the URL for instance init */
export function instanceInitUrl(provider: ProviderConfig): string {
  switch (provider.provider_type) {
    case "evolution":
      return `${provider.base_url}/instance/create`;
    case "waha":
      return `${provider.base_url}/api/sessions/start`;
    case "uazapi":
    case "custom":
    default:
      return `${provider.base_url}/instance/init`;
  }
}

/** Build the URL for instance connect (QR code) */
export function instanceConnectUrl(provider: ProviderConfig): string {
  switch (provider.provider_type) {
    case "evolution":
      return `${provider.base_url}/instance/connect`;
    case "waha":
      return `${provider.base_url}/api/sessions/start`;
    case "uazapi":
    case "custom":
    default:
      return `${provider.base_url}/instance/connect`;
  }
}

/** Build the URL for instance status */
export function instanceStatusUrl(provider: ProviderConfig): string {
  switch (provider.provider_type) {
    case "evolution":
      return `${provider.base_url}/instance/connectionState`;
    case "waha":
      return `${provider.base_url}/api/sessions/status`;
    case "uazapi":
    case "custom":
    default:
      return `${provider.base_url}/instance/status`;
  }
}
