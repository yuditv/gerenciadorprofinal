import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parsePhoneNumberFromString } from "https://esm.sh/libphonenumber-js@1.11.7";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  // supabase-js adds extra headers (e.g. x-supabase-client-platform) that must be allowed for CORS preflight.
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
};

async function invokeMemoryExtractor(payload: {
  userId: string;
  phone: string;
  contactName?: string | null;
  agentId?: string | null;
  message: string;
}) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    fetch(`${supabaseUrl}/functions/v1/memory-extractor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.log('[Inbox Webhook] memory-extractor invoke error (ignored):', e);
  }
}

// ===== Message Sending Utilities =====

interface MessageSendConfig {
  response_delay_min: number;
  response_delay_max: number;
  max_lines_per_message: number;
  split_mode: 'none' | 'paragraph' | 'lines' | 'sentences' | 'chars';
  split_delay_min: number;
  split_delay_max: number;
  max_chars_per_message: number;
  typing_simulation: boolean;
}

// WhatsApp/UAZAPI may truncate very long messages when sent in a single payload.
// To keep the experience human-like (short bursts), we auto-split long answers
// ONLY when the agent has not explicitly configured splitting.
const AUTO_SPLIT_THRESHOLD_CHARS = 420;
const AUTO_SPLIT_MAX_CHARS_PER_MESSAGE = 380;

const DEFAULT_SEND_CONFIG: MessageSendConfig = {
  response_delay_min: 2,
  response_delay_max: 5,
  max_lines_per_message: 0,
  split_mode: 'none',
  split_delay_min: 1,
  split_delay_max: 3,
  max_chars_per_message: 0,
  typing_simulation: true
};

/**
 * Sleep for a random duration between min and max milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get a random number between min and max (inclusive)
 */
function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Split message into chunks based on the configured mode
 */
function splitMessage(text: string, config: MessageSendConfig): string[] {
  if (!text || text.trim().length === 0) return [];
  
  if (config.split_mode === 'none' && config.max_lines_per_message === 0 && config.max_chars_per_message === 0) {
    return [text];
  }
  
  let parts: string[] = [];
  
  // First, split by mode
  switch (config.split_mode) {
    case 'paragraph':
      parts = text.split(/\n\n+/).filter(p => p.trim());
      break;
    case 'lines':
      parts = text.split(/\n/).filter(p => p.trim());
      break;
    case 'sentences':
      // Split by sentence-ending punctuation
      const sentenceMatches = text.match(/[^.!?]+[.!?]+[\s]*/g);
      if (sentenceMatches && sentenceMatches.length > 0) {
        parts = sentenceMatches.map(s => s.trim()).filter(s => s);
      } else {
        parts = [text];
      }
      break;
    case 'chars':
      if (config.max_chars_per_message > 0) {
        parts = chunkByChars(text, config.max_chars_per_message);
      } else {
        parts = [text];
      }
      break;
    default:
      parts = [text];
  }
  
  // Apply character limit if set and mode is not 'chars'
  if (config.split_mode !== 'chars' && config.max_chars_per_message > 0) {
    parts = parts.flatMap(p => chunkByChars(p, config.max_chars_per_message));
  }
  
  // Apply line limit if set
  if (config.max_lines_per_message > 0) {
    parts = parts.flatMap(p => chunkByLines(p, config.max_lines_per_message));
  }
  
  return parts.filter(p => p.trim());
}

/**
 * Chunk text by maximum character count, trying to break at word boundaries
 */
function chunkByChars(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  
  const chunks: string[] = [];
  let remaining = text;
  
  while (remaining.length > 0) {
    if (remaining.length <= maxChars) {
      chunks.push(remaining.trim());
      break;
    }
    
    // Find a good break point (space, newline)
    let breakPoint = maxChars;
    const lastSpace = remaining.lastIndexOf(' ', maxChars);
    const lastNewline = remaining.lastIndexOf('\n', maxChars);
    
    if (lastSpace > maxChars * 0.5 || lastNewline > maxChars * 0.5) {
      breakPoint = Math.max(lastSpace, lastNewline);
    }
    
    chunks.push(remaining.substring(0, breakPoint).trim());
    remaining = remaining.substring(breakPoint).trim();
  }
  
  return chunks;
}

/**
 * Chunk text by maximum line count
 */
function chunkByLines(text: string, maxLines: number): string[] {
  const lines = text.split('\n');
  if (lines.length <= maxLines) return [text];
  
  const chunks: string[] = [];
  for (let i = 0; i < lines.length; i += maxLines) {
    const chunk = lines.slice(i, i + maxLines).join('\n');
    if (chunk.trim()) {
      chunks.push(chunk);
    }
  }
  
  return chunks;
}

/**
 * Send presence/typing indicator via UAZAPI
 */
async function sendTypingIndicator(
  uazapiUrl: string, 
  instanceKey: string, 
  phone: string,
  duration: number = 2000
): Promise<void> {
  try {
    await fetch(`${uazapiUrl}/send/presence`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': instanceKey
      },
      body: JSON.stringify({
        number: phone,
        presence: 'composing',
        delay: duration
      })
    });
    // Wait a bit for the typing to show
    await sleep(Math.min(duration, 1500));
  } catch (e) {
    console.error('[Inbox Webhook] Error sending typing indicator:', e);
  }
}

/**
 * Calculate typing simulation time based on message length
 */
function calculateTypingTime(message: string): number {
  // Simulate typing at ~30-50 chars per second, with some randomness
  const baseTime = (message.length / 40) * 1000;
  return Math.min(Math.max(baseTime, 500), 3000); // Between 0.5s and 3s
}

/**
 * Send a single text message via UAZAPI
 */
async function sendTextViaUazapi(
  uazapiUrl: string,
  instanceKey: string,
  phone: string,
  text: string
): Promise<boolean> {
  try {
    const response = await fetch(`${uazapiUrl}/send/text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': instanceKey
      },
      body: JSON.stringify({
        number: phone,
        text: text
      })
    });
    return response.ok;
  } catch (e) {
    console.error('[Inbox Webhook] Error sending text:', e);
    return false;
  }
}

/**
 * Send AI response with configured delays and splitting
 */
async function sendAIResponseWithConfig(
  uazapiUrl: string,
  instanceKey: string,
  phone: string,
  fullResponse: string,
  config: MessageSendConfig
): Promise<void> {
  // Auto-split safeguard:
  // If the agent didn't configure splitting/limits, but the message is long,
  // enable a safe default split to avoid truncation and feel more natural.
  const hasExplicitSplitConfig =
    config.split_mode !== 'none' ||
    config.max_lines_per_message > 0 ||
    config.max_chars_per_message > 0;

  const effectiveConfig: MessageSendConfig = (!hasExplicitSplitConfig && fullResponse.length > AUTO_SPLIT_THRESHOLD_CHARS)
    ? {
        ...config,
        split_mode: 'sentences',
        max_chars_per_message: AUTO_SPLIT_MAX_CHARS_PER_MESSAGE,
        // Keep it snappy/human-like
        response_delay_min: Math.min(config.response_delay_min, 2),
        response_delay_max: Math.min(config.response_delay_max, 4),
        split_delay_min: Math.min(config.split_delay_min, 1),
        split_delay_max: Math.max(Math.min(config.split_delay_max, 3), 1),
        typing_simulation: true,
      }
    : config;

  console.log(`[Inbox Webhook] Sending AI response with config:`, {
    split_mode: effectiveConfig.split_mode,
    response_delay: `${effectiveConfig.response_delay_min}-${effectiveConfig.response_delay_max}s`,
    typing: effectiveConfig.typing_simulation,
    auto_split: !hasExplicitSplitConfig && fullResponse.length > AUTO_SPLIT_THRESHOLD_CHARS,
  });
  
  // 1. Apply initial response delay
  if (effectiveConfig.response_delay_max > 0) {
    const delaySeconds = randomBetween(effectiveConfig.response_delay_min, effectiveConfig.response_delay_max);
    console.log(`[Inbox Webhook] Waiting ${delaySeconds}s before responding...`);
    await sleep(delaySeconds * 1000);
  }
  
  // 2. Split message according to configuration
  const messageParts = splitMessage(fullResponse, effectiveConfig);
  console.log(`[Inbox Webhook] Message split into ${messageParts.length} parts`);
  
  // 3. Send each part with optional delays
  for (let i = 0; i < messageParts.length; i++) {
    const part = messageParts[i];
    
    // Simulate typing if enabled
    if (effectiveConfig.typing_simulation) {
      const typingTime = calculateTypingTime(part);
      await sendTypingIndicator(uazapiUrl, instanceKey, phone, typingTime);
    }
    
    // Send the message part
    const sent = await sendTextViaUazapi(uazapiUrl, instanceKey, phone, part);
    console.log(`[Inbox Webhook] Sent part ${i + 1}/${messageParts.length}: ${sent ? 'OK' : 'FAILED'}`);
    
    // Delay between parts (except for last)
    if (i < messageParts.length - 1 && effectiveConfig.split_delay_max > 0) {
      const splitDelay = randomBetween(effectiveConfig.split_delay_min, effectiveConfig.split_delay_max);
      console.log(`[Inbox Webhook] Waiting ${splitDelay}s before next part...`);
      await sleep(splitDelay * 1000);
    }
  }
  
  console.log('[Inbox Webhook] All message parts sent successfully');
}

// ===== Owner Notification Event Detection =====

type NotificationEventType = 
  | 'ai_uncertainty'
  | 'payment_proof'
  | 'new_contact'
  | 'complaint'
  | 'vip_message'
  | 'long_wait';

interface DetectedEvent {
  shouldNotify: boolean;
  eventType: NotificationEventType;
  summary: string;
  urgency: 'low' | 'medium' | 'high';
}

/**
 * Detect if a message/event should trigger an owner notification
 */
function detectNotifiableEvent(
  messageContent: string,
  mediaType: string | undefined,
  isNewContact: boolean,
  clientMemory: any
): DetectedEvent {
  const lowerMessage = (messageContent || '').toLowerCase();
  
  // Payment proof detection (image + payment keywords)
  const paymentKeywords = ['paguei', 'comprovante', 'pix', 'transferi', 'pagamento', 'pago', 'deposito', 'depositei', 'boleto'];
  const hasPaymentKeyword = paymentKeywords.some(kw => lowerMessage.includes(kw));
  
  if (mediaType === 'image' && (hasPaymentKeyword || lowerMessage.length < 50)) {
    // Image with payment keyword or short message = likely payment proof
    if (hasPaymentKeyword || lowerMessage === '' || lowerMessage.length < 20) {
      return {
        shouldNotify: true,
        eventType: 'payment_proof',
        summary: `Cliente enviou imagem${hasPaymentKeyword ? ' com menção a pagamento' : ' (possível comprovante)'}`,
        urgency: 'medium'
      };
    }
  }
  
  // Complaint detection
  const complaintKeywords = [
    'problema', 'não funciona', 'travando', 'ruim', 'péssimo', 'reclamar', 
    'insatisfeito', 'devolução', 'reembolso', 'cancelar', 'não abre', 
    'não carrega', 'parou', 'quebrou', 'horrível', 'lixo'
  ];
  const hasComplaint = complaintKeywords.some(kw => lowerMessage.includes(kw));
  
  if (hasComplaint) {
    return {
      shouldNotify: true,
      eventType: 'complaint',
      summary: `Possível reclamação: "${messageContent.substring(0, 80)}${messageContent.length > 80 ? '...' : ''}"`,
      urgency: 'high'
    };
  }
  
  // Urgency detection
  const urgentKeywords = ['urgente', 'emergência', 'socorro', 'ajuda', 'por favor'];
  const hasUrgency = urgentKeywords.some(kw => lowerMessage.includes(kw));
  
  if (hasUrgency && lowerMessage.length > 10) {
    return {
      shouldNotify: true,
      eventType: 'complaint',
      summary: `Mensagem urgente: "${messageContent.substring(0, 80)}${messageContent.length > 80 ? '...' : ''}"`,
      urgency: 'high'
    };
  }
  
  // VIP client detection
  if (clientMemory?.is_vip) {
    return {
      shouldNotify: true,
      eventType: 'vip_message',
      summary: `Cliente VIP ${clientMemory.client_name || ''} mandou mensagem: "${messageContent.substring(0, 60)}..."`,
      urgency: 'medium'
    };
  }
  
  // New contact detection
  if (isNewContact) {
    return {
      shouldNotify: true,
      eventType: 'new_contact',
      summary: `Primeira mensagem: "${messageContent.substring(0, 80)}${messageContent.length > 80 ? '...' : ''}"`,
      urgency: 'low'
    };
  }
  
  return {
    shouldNotify: false,
    eventType: 'new_contact',
    summary: '',
    urgency: 'low'
  };
}

/**
 * Send owner notification via edge function (fire and forget)
 */
async function sendOwnerNotification(
  supabaseUrl: string,
  supabaseServiceKey: string,
  userId: string,
  eventType: NotificationEventType,
  contactPhone: string,
  contactName: string | null,
  summary: string,
  conversationId: string,
  instanceId: string,
  urgency: 'low' | 'medium' | 'high'
): Promise<void> {
  try {
    console.log(`[Inbox Webhook] Triggering owner notification: ${eventType}`);
    
    await fetch(`${supabaseUrl}/functions/v1/send-owner-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({
        userId,
        eventType,
        contactPhone,
        contactName,
        summary,
        conversationId,
        instanceId,
        urgency
      })
    });
  } catch (e) {
    console.error('[Inbox Webhook] Error sending owner notification:', e);
  }
}

/**
 * Detect country code from phone number
 * Returns ISO 2-letter country code (e.g., 'US', 'BR', 'UK')
 */
function detectCountryCode(phone: string): string | null {
  const raw = (phone ?? '').toString().trim();
  if (!raw) return null;

  // Try to infer region from the number itself. We default to BR for legacy
  // numbers stored without a leading +countrycode.
  const parsed =
    parsePhoneNumberFromString(raw) ??
    parsePhoneNumberFromString(raw, 'BR');

  if (!parsed || !parsed.isValid()) return null;
  return parsed.country ?? null;
}

/**
 * Format phone number for WhatsApp API - supports international numbers
 */
function formatPhoneNumber(phone: string, defaultCountry: string = 'BR'): string {
  const raw = (phone ?? '').toString().trim();
  if (!raw) throw new Error('Phone is required');

  const parsed =
    parsePhoneNumberFromString(raw) ??
    parsePhoneNumberFromString(raw, defaultCountry as any);

  if (!parsed || !parsed.isValid()) {
    throw new Error('Invalid phone number');
  }

  // UAZAPI expects digits only (E.164 without the leading '+')
  return parsed.number.replace('+', '');
}

// ===== Numeric Menu (Manual) =====

function safeJsonParse(value: string | null): any {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getNumericMenuFromAgent(consultationContext: string | null): {
  enabled: boolean;
  prompt: string;
  options: Record<string, { reply?: string; title?: string }>;
} | null {
  const json = safeJsonParse(consultationContext);
  const cfg = json?.numeric_menu;
  if (!cfg?.enabled) return null;
  const prompt = (cfg.prompt ?? '').toString();
  const options = cfg.options && typeof cfg.options === 'object' ? cfg.options : {};
  return { enabled: true, prompt, options };
}

// Fetch contact avatar from UAZAPI using /chat/details endpoint
async function fetchContactAvatar(
  uazapiUrl: string,
  phone: string,
  instanceKey?: string
): Promise<string | null> {
  try {
    const uazapiToken = Deno.env.get('UAZAPI_TOKEN');
    // Use instance_key as token (same pattern as send-inbox-message and other functions)
    const tokenToUse = instanceKey || uazapiToken;
    
    if (!tokenToUse) {
      console.log('[Avatar] No token available (instance_key or UAZAPI_TOKEN), skipping');
      return null;
    }

    console.log(`[Avatar] Fetching avatar for phone: ${phone}, using ${instanceKey ? 'instance_key' : 'global'} token`);
    
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'token': tokenToUse
    };
    const body = JSON.stringify({
      number: phone,
      preview: true
    });

    // Try primary endpoint first
    let response = await fetch(`${uazapiUrl}/chat/details`, {
      method: 'POST',
      headers,
      body
    });

    // Fallback: try with instance key in URL (like fetch-chat-details does)
    if (!response.ok && instanceKey) {
      console.log(`[Avatar] Primary endpoint failed (${response.status}), trying with instance key in URL...`);
      response = await fetch(`${uazapiUrl}/instance/${instanceKey}/chat/details`, {
        method: 'POST',
        headers,
        body
      });
    }

    if (response.ok) {
      const data = await response.json();
      const avatarUrl = data.imagePreview || data.image || data.url || data.profilePicUrl || null;
      console.log(`[Avatar] Result for ${phone}:`, avatarUrl ? 'found' : 'not found');
      return avatarUrl;
    }
    
    console.log(`[Avatar] Failed to fetch for ${phone}, status:`, response.status);
    return null;
  } catch (error) {
    console.log('[Avatar] Error fetching:', error);
    return null;
  }
}

// Standard format from our internal calls
interface IncomingMessage {
  phone: string;
  message: string;
  instanceKey?: string;
  instanceId?: string;
  contactName?: string;
  mediaUrl?: string;
  mediaType?: string;
  messageId?: string;
}

// UAZAPI webhook format (v2 with EventType)
interface UAZAPIWebhookPayload {
  EventType?: string;  // "messages" with capital E
  event?: string;      // fallback lowercase
  instance?: string;
  instanceName?: string;
  token?: string;
  // UAZAPI v2 format - message object at root level
  message?: {
    chatid?: string;
    sender_pn?: string;  // "559187459963@s.whatsapp.net"
    senderName?: string;
    text?: string;
    fromMe?: boolean;
    isGroup?: boolean;
    content?: { text?: string };
    id?: string;
    messageid?: string;  // Alternative ID field
    // Media fields
    hasMedia?: boolean;
    mediaType?: string;
    mediaUrl?: string;
    caption?: string;
    mimetype?: string;
    fileName?: string;
    messageType?: string;  // "ImageMessage", "VideoMessage", "AudioMessage", etc.
  };
  // Legacy UAZAPI format with data wrapper
  data?: {
    key?: {
      remoteJid?: string;
      fromMe?: boolean;
      id?: string;
    };
    message?: {
      conversation?: string;
      extendedTextMessage?: { text?: string };
      imageMessage?: { caption?: string; url?: string; mimetype?: string };
      videoMessage?: { caption?: string; url?: string; mimetype?: string };
      audioMessage?: { url?: string; mimetype?: string };
      documentMessage?: { fileName?: string; url?: string; mimetype?: string };
      stickerMessage?: { url?: string; mimetype?: string };
    };
    pushName?: string;
    messageTimestamp?: number;
  };
  // Message status update fields (for delivery/read receipts)
  ack?: number;  // 0=pending, 1=sent, 2=delivered, 3=read
  id?: string;   // message ID for status updates
  // Alternative fields that UAZAPI might send
  phone?: string;
  from?: string;
  text?: string;
  name?: string;
  remoteJid?: string;
  pushName?: string;
}

// Download media from UAZAPI using /message/download endpoint
async function downloadMediaFromUAZAPI(
  uazapiUrl: string,
  instanceKey: string,
  messageId: string,
  mediaType: string
): Promise<{ fileUrl: string | null; mimetype: string | null; transcription?: string | null }> {
  try {
    console.log(`[Media Download] Downloading media for message: ${messageId}, type: ${mediaType}`);
    
    const response = await fetch(`${uazapiUrl}/message/download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': instanceKey
      },
      body: JSON.stringify({
        id: messageId,
        return_link: true,        // Returns public URL
        return_base64: false,     // Don't need base64
        generate_mp3: mediaType === 'audio' || mediaType === 'ptt',  // Convert audio to MP3
        download_quoted: false    // Don't download quoted media
      })
    });

    if (!response.ok) {
      console.error(`[Media Download] Failed with status: ${response.status}`);
      const errorText = await response.text();
      console.error(`[Media Download] Error response: ${errorText}`);
      return { fileUrl: null, mimetype: null };
    }

    const data = await response.json();
    console.log(`[Media Download] Response:`, JSON.stringify(data));
    
    // UAZAPI returns: { fileURL, mimetype, base64Data?, transcription? }
    const fileUrl = data.fileURL || data.url || data.link || data.fileUrl || null;
    const mimetype = data.mimetype || data.mimeType || null;
    const transcription = (typeof data.transcription === 'string' ? data.transcription : null);
    
    if (fileUrl) {
      console.log(`[Media Download] Success: ${fileUrl.substring(0, 80)}...`);
    } else {
      console.log(`[Media Download] No URL in response`);
    }
    
    return { fileUrl, mimetype, transcription };
  } catch (error) {
    console.error('[Media Download] Error:', error);
    return { fileUrl: null, mimetype: null, transcription: null };
  }
}

async function transcribeAudioViaEdge(
  supabaseUrl: string,
  supabaseServiceKey: string,
  mediaUrl: string,
  mimeType?: string
): Promise<{ text: string; provider: string; language: string } | null> {
  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/transcribe-audio`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({
        mediaUrl,
        mimeType,
        language: 'pt-BR',
        source: 'whatsapp'
      })
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error('[Transcription] transcribe-audio failed:', resp.status, t);
      return null;
    }

    const data = await resp.json();
    const text = (data?.text ?? '').toString();
    if (!text.trim()) return null;
    return {
      text,
      provider: (data?.provider ?? 'openai').toString(),
      language: (data?.language ?? 'pt').toString(),
    };
  } catch (e) {
    console.error('[Transcription] Error calling transcribe-audio:', e);
    return null;
  }
}

async function describeImageViaGateway(imageUrl: string): Promise<string | null> {
  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('[Image Describe] LOVABLE_API_KEY is not configured');
      return null;
    }
    if (!imageUrl) return null;

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image',
        messages: [
          {
            role: 'system',
            content:
              'Você descreve imagens de forma objetiva e curta em pt-BR. Se houver texto, faça OCR e transcreva. Se for comprovante/pagamento, extraia valor, data, nome e status se aparecer.',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Descreva a imagem e transcreva qualquer texto que houver.' },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error('[Image Describe] Gateway failed:', resp.status, t);
      return null;
    }
    const data = await resp.json();
    const text = (data?.choices?.[0]?.message?.content ?? '').toString().trim();
    return text || null;
  } catch (e) {
    console.error('[Image Describe] Error:', e);
    return null;
  }
}

// Map simple media type to proper MIME type
function mapMediaTypeToMime(mediaType: string | undefined, mimetype: string | undefined): string | undefined {
  if (mimetype) return mimetype;
  if (!mediaType) return undefined;
  
  const mimeMap: Record<string, string> = {
    'image': 'image/jpeg',
    'video': 'video/mp4',
    'audio': 'audio/mpeg',
    'ptt': 'audio/ogg',  // Push-to-talk (voice messages)
    'document': 'application/octet-stream',
    'sticker': 'image/webp'
  };
  
  return mimeMap[mediaType] || undefined;
}

// Get preview label for media messages
function getMediaPreviewLabel(mediaType: string | undefined, caption: string | undefined): string {
  if (caption) return caption.substring(0, 100);
  
  const labels: Record<string, string> = {
    'image': '📷 Imagem',
    'video': '🎥 Vídeo',
    'audio': '🎵 Áudio',
    'ptt': '🎤 Áudio',
    'document': '📄 Documento',
    'sticker': '🩹 Sticker'
  };
  
  return labels[mediaType || ''] || '📎 Anexo';
}

interface ExtractedMessageData {
  phone: string;
  message: string;
  contactName: string;
  mediaUrl?: string;
  mediaType?: string;
  messageId?: string;
  hasMedia?: boolean;
  mimetype?: string;
  caption?: string;
  fromMe?: boolean;  // Indicates if message was sent by us (from device or system)
}

function extractMessageData(body: UAZAPIWebhookPayload): ExtractedMessageData | null {
  // Try UAZAPI v2 format first (EventType + message object)
  if ((body.EventType === 'messages' || body.event === 'messages') && body.message && typeof body.message === 'object') {
    const msgObj = body.message;
    
    // Capture fromMe flag - we now process both incoming and outgoing messages
    const fromMe = msgObj.fromMe === true;
    
    // Skip group messages for now (Central de Atendimento focuses on 1:1 conversations)
    if (msgObj.isGroup) {
      console.log("[Inbox Webhook] Skipping group message");
      return null;
    }
    
    // Extract phone from sender_pn or chatid (for outgoing messages, use chatid)
    let phone = '';
    if (fromMe) {
      // For outgoing messages, extract destination from chatid
      phone = msgObj.chatid?.replace('@s.whatsapp.net', '').replace('@g.us', '') || '';
    } else {
      // For incoming messages, use sender_pn
      phone = msgObj.sender_pn?.replace('@s.whatsapp.net', '').replace('@g.us', '') || '';
    }
    
    // Extract message text (use caption for media messages)
    const message = msgObj.text || msgObj.content?.text || msgObj.caption || '';
    
    // Extract contact name
    const contactName = msgObj.senderName || phone;
    
    // Extract message ID for media download
    const messageId = msgObj.id || msgObj.messageid;
    
    // Extract media info - UAZAPI v2 uses messageType instead of hasMedia
    const messageType = msgObj.messageType || '';
    const mediaMessageTypes = ['ImageMessage', 'VideoMessage', 'AudioMessage', 'DocumentMessage', 'StickerMessage', 'PttMessage'];
    const hasMediaByType = mediaMessageTypes.some(type => 
      messageType.toLowerCase().includes(type.toLowerCase().replace('message', ''))
    );
    
    // Check for media: messageType OR hasMedia flag OR non-empty mediaType
    const hasMedia = hasMediaByType || msgObj.hasMedia === true || (!!msgObj.mediaType && msgObj.mediaType !== '');
    
    let mediaUrl: string | undefined = msgObj.mediaUrl;
    
    // Infer mediaType from messageType if not explicitly provided
    let mediaType: string | undefined = msgObj.mediaType;
    if (!mediaType && hasMediaByType) {
      if (messageType.toLowerCase().includes('image')) mediaType = 'image';
      else if (messageType.toLowerCase().includes('video')) mediaType = 'video';
      else if (messageType.toLowerCase().includes('audio') || messageType.toLowerCase().includes('ptt')) mediaType = 'audio';
      else if (messageType.toLowerCase().includes('document')) mediaType = 'document';
      else if (messageType.toLowerCase().includes('sticker')) mediaType = 'sticker';
    }
    
    const mimetype: string | undefined = msgObj.mimetype;
    const caption: string | undefined = msgObj.caption;
    
    console.log(`[Inbox Webhook] UAZAPI v2 format detected:`);
    console.log(`[Inbox Webhook]   - phone: ${phone}`);
    console.log(`[Inbox Webhook]   - fromMe: ${fromMe}`);
    console.log(`[Inbox Webhook]   - messageType: ${messageType}`);
    console.log(`[Inbox Webhook]   - hasMedia: ${hasMedia}`);
    console.log(`[Inbox Webhook]   - mediaType: ${mediaType}`);
    console.log(`[Inbox Webhook]   - messageId: ${messageId}`);
    
    return { phone, message, contactName, mediaUrl, mediaType, messageId, hasMedia, mimetype, caption, fromMe };
  }
  
  // Try legacy UAZAPI webhook format with data wrapper
  if (body.data?.key?.remoteJid) {
    const remoteJid = body.data.key.remoteJid;
    // Capture fromMe flag - we now process both incoming and outgoing messages
    const fromMe = body.data.key.fromMe === true;
    
    // Extract phone from remoteJid (format: 5591999999999@s.whatsapp.net)
    const phone = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
    
    // Extract message ID
    const messageId = body.data.key.id;
    
    // Extract message content from various message types
    const msgData = body.data.message;
    let message = '';
    let mediaUrl: string | undefined;
    let mediaType: string | undefined;
    let mimetype: string | undefined;
    let hasMedia = false;
    let caption: string | undefined;
    
    if (msgData?.conversation) {
      message = msgData.conversation;
    } else if (msgData?.extendedTextMessage?.text) {
      message = msgData.extendedTextMessage.text;
    } else if (msgData?.imageMessage) {
      caption = msgData.imageMessage.caption;
      message = caption || '';
      mediaUrl = msgData.imageMessage.url;
      mediaType = 'image';
      mimetype = msgData.imageMessage.mimetype;
      hasMedia = true;
    } else if (msgData?.videoMessage) {
      caption = msgData.videoMessage.caption;
      message = caption || '';
      mediaUrl = msgData.videoMessage.url;
      mediaType = 'video';
      mimetype = msgData.videoMessage.mimetype;
      hasMedia = true;
    } else if (msgData?.audioMessage) {
      message = '';
      mediaUrl = msgData.audioMessage.url;
      mediaType = 'audio';
      mimetype = msgData.audioMessage.mimetype;
      hasMedia = true;
    } else if (msgData?.documentMessage) {
      message = msgData.documentMessage.fileName || '';
      mediaUrl = msgData.documentMessage.url;
      mediaType = 'document';
      mimetype = msgData.documentMessage.mimetype;
      hasMedia = true;
    } else if (msgData?.stickerMessage) {
      message = '';
      mediaUrl = msgData.stickerMessage.url;
      mediaType = 'sticker';
      mimetype = msgData.stickerMessage.mimetype;
      hasMedia = true;
    }
    
    const contactName = body.data.pushName || phone;
    
    console.log(`[Inbox Webhook] Legacy UAZAPI format detected - phone: ${phone}, fromMe: ${fromMe}, hasMedia: ${hasMedia}`);
    return { phone, message, contactName, mediaUrl, mediaType, messageId, hasMedia, mimetype, caption, fromMe };
  }
  
  // Try alternative UAZAPI formats
  if (body.remoteJid) {
    const phone = body.remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
    const message = body.text || '';
    const contactName = body.pushName || body.name || phone;
    return { phone, message, contactName };
  }
  
  // Try direct fields (phone + message as strings)
  if (body.phone && typeof body.phone === 'string') {
    const textMessage = body.text || '';
    return {
      phone: body.phone.replace(/\D/g, ''),
      message: textMessage,
      contactName: body.name || body.phone
    };
  }
  
  if (body.from) {
    return {
      phone: body.from.replace(/\D/g, '').replace('@s.whatsapp.net', ''),
      message: body.text || '',
      contactName: body.name || body.from
    };
  }
  
  return null;
}

// Handle message status updates (delivery/read receipts)
// deno-lint-ignore no-explicit-any
async function handleMessageStatusUpdate(supabase: any, body: UAZAPIWebhookPayload & { message?: { ack?: number; messageid?: string; chatid?: string }; data?: { ack?: number; status?: string } }) {
  try {
    console.log(`[Status Handler] Starting status update processing...`);
    
    // Extract message ID and status from various UAZAPI formats
    let messageId: string | undefined;
    let ackStatus: number | undefined;
    let phone: string | undefined;
    
    // UAZAPI v2 format - try multiple possible locations for message ID
    if (body.message?.messageid) {
      messageId = body.message.messageid;
    } else if (body.message?.id) {
      messageId = body.message.id;
    } else if (body.id) {
      messageId = body.id;
    } else if (body.data?.key?.id) {
      messageId = body.data.key.id;
    }
    
    // UAZAPI v2 may send with instance:id format - extract just the ID part
    if (messageId?.includes(':')) {
      const parts = messageId.split(':');
      messageId = parts.pop();
      console.log(`[Status Handler] Extracted ID from composite: ${messageId}`);
    }
    
    // Get ack status (0=pending, 1=sent, 2=delivered, 3=read)
    // Try multiple locations for ACK value
    if (typeof body.ack === 'number') {
      ackStatus = body.ack;
      console.log(`[Status Handler] Found ack at body.ack: ${ackStatus}`);
    } else if (typeof body.message?.ack === 'number') {
      ackStatus = body.message.ack;
      console.log(`[Status Handler] Found ack at body.message.ack: ${ackStatus}`);
    } else if (typeof body.data?.ack === 'number') {
      ackStatus = body.data.ack;
      console.log(`[Status Handler] Found ack at body.data.ack: ${ackStatus}`);
    } else if (body.data?.status) {
      // Handle string status values
      const statusToAck: Record<string, number> = {
        'pending': 0, 'sending': 0,
        'sent': 1, 'server': 1,
        'delivered': 2, 'device': 2,
        'read': 3, 'played': 3
      };
      const statusStr = body.data.status.toLowerCase();
      if (statusStr in statusToAck) {
        ackStatus = statusToAck[statusStr];
        console.log(`[Status Handler] Converted status string '${statusStr}' to ack: ${ackStatus}`);
      }
    }
    
    // Get phone for matching - try multiple formats
    if (body.message?.chatid) {
      phone = body.message.chatid.replace('@s.whatsapp.net', '').replace('@g.us', '');
    } else if (body.message?.sender_pn) {
      phone = body.message.sender_pn.replace('@s.whatsapp.net', '').replace('@g.us', '');
    } else if (body.data?.key?.remoteJid) {
      phone = body.data.key.remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
    } else if (body.phone) {
      phone = body.phone.replace(/\D/g, '');
    } else if (body.remoteJid) {
      phone = body.remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
    }
    
    console.log(`[Status Handler] Extracted values:`);
    console.log(`[Status Handler]   - Message ID: ${messageId || 'NOT FOUND'}`);
    console.log(`[Status Handler]   - ACK status: ${ackStatus ?? 'NOT FOUND'}`);
    console.log(`[Status Handler]   - Phone: ${phone || 'NOT FOUND'}`);
    
    if (!phone && !messageId) {
      console.log('[Status Handler] ERROR: No identifier found for status update - cannot proceed');
      return;
    }
    
    // Map ack to status string
    const statusMap: Record<number, string> = {
      0: 'sending',
      1: 'sent',
      2: 'delivered',
      3: 'read'
    };
    
    const newStatus = ackStatus !== undefined ? statusMap[ackStatus] : undefined;
    
    if (!newStatus) {
      console.log(`[Status Handler] ERROR: Unknown or missing ack status: ${ackStatus}`);
      return;
    }
    
    console.log(`[Status Handler] Will update to status: ${newStatus} (ACK=${ackStatus})`);
    
    // Find and update the message
    // First try by message ID in metadata
    if (messageId) {
      console.log(`[Status Handler] Searching for message with whatsapp_id: ${messageId}`);
      
      const { data: messages, error } = await supabase
        .from('chat_inbox_messages')
        .select('id, metadata, conversation_id')
        .eq('sender_type', 'agent')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) {
        console.error(`[Status Handler] Database error fetching messages:`, error);
      } else if (messages) {
        console.log(`[Status Handler] Found ${messages.length} agent messages to search`);
        
        // Find message by ID in metadata
        // deno-lint-ignore no-explicit-any
        const matchingMessage = messages.find((m: any) => 
          m.metadata?.whatsapp_id === messageId
        );
        
        if (matchingMessage) {
          const currentStatus = matchingMessage.metadata?.status;
          const statusOrder: Record<string, number> = { sending: 0, sent: 1, delivered: 2, read: 3 };
          const currentOrder = statusOrder[currentStatus as string] ?? -1;
          const newOrder = statusOrder[newStatus] ?? -1;
          
          console.log(`[Status Handler] Found matching message ${matchingMessage.id}`);
          console.log(`[Status Handler] Current status: ${currentStatus} (order=${currentOrder}), New status: ${newStatus} (order=${newOrder})`);
          
          if (newOrder > currentOrder) {
            const { error: updateError } = await supabase
              .from('chat_inbox_messages')
              .update({
                metadata: {
                  ...matchingMessage.metadata,
                  status: newStatus,
                  status_updated_at: new Date().toISOString()
                },
                is_read: newStatus === 'read'
              })
              .eq('id', matchingMessage.id);
            
            if (updateError) {
              console.error(`[Status Handler] Update error:`, updateError);
            } else {
              console.log(`[Status Handler] ✅ SUCCESS: Updated message ${matchingMessage.id} from ${currentStatus} to ${newStatus}`);
            }
          } else {
            console.log(`[Status Handler] Skipping update - new status not higher than current`);
          }
          return;
        } else {
          console.log(`[Status Handler] No message found with whatsapp_id: ${messageId}`);
        }
      }
    }
    
    // Fallback: Update most recent outgoing message to this phone
    if (phone) {
      console.log(`[Status Handler] Fallback: Searching by phone ${phone}`);
      
      // Find conversation by phone
      const { data: conversations, error: convError } = await supabase
        .from('conversations')
        .select('id')
        .eq('phone', phone);
      
      if (convError) {
        console.error(`[Status Handler] Error finding conversations:`, convError);
      } else if (conversations && conversations.length > 0) {
        // deno-lint-ignore no-explicit-any
        const conversationIds = conversations.map((c: any) => c.id);
        console.log(`[Status Handler] Found ${conversations.length} conversations for phone ${phone}`);
        
        // Get most recent outgoing messages (get more to increase chances of match)
        const { data: recentMessages, error: msgError } = await supabase
          .from('chat_inbox_messages')
          .select('id, metadata, created_at')
          .in('conversation_id', conversationIds)
          .eq('sender_type', 'agent')
          .order('created_at', { ascending: false })
          .limit(10);
        
        if (msgError) {
          console.error(`[Status Handler] Error fetching recent messages:`, msgError);
        } else if (recentMessages && recentMessages.length > 0) {
          console.log(`[Status Handler] Found ${recentMessages.length} recent agent messages`);
          
          // Update the most recent one that hasn't reached this status yet
          for (const msg of recentMessages) {
            const currentStatus = msg.metadata?.status;
            const statusOrder: Record<string, number> = { sending: 0, sent: 1, delivered: 2, read: 3 };
            const currentOrder = statusOrder[currentStatus as string] ?? -1;
            const newOrder = statusOrder[newStatus] ?? -1;
            
            if (newOrder > currentOrder) {
              const { error: updateError } = await supabase
                .from('chat_inbox_messages')
                .update({
                  metadata: {
                    ...msg.metadata,
                    status: newStatus,
                    status_updated_at: new Date().toISOString()
                  },
                  is_read: newStatus === 'read'
                })
                .eq('id', msg.id);
              
              if (updateError) {
                console.error(`[Status Handler] Update error:`, updateError);
              } else {
                console.log(`[Status Handler] ✅ SUCCESS: Updated recent message ${msg.id} from ${currentStatus} to ${newStatus}`);
              }
              break; // Only update the first matching message
            }
          }
        } else {
          console.log(`[Status Handler] No recent agent messages found for these conversations`);
        }
      } else {
        console.log(`[Status Handler] No conversations found for phone ${phone}`);
      }
    }
  } catch (error) {
    console.error('[Status Handler] CRITICAL ERROR:', error);
  }
}

serve(async (req: Request) => {
  const requestTimestamp = new Date().toISOString();
  console.log(`[Inbox Webhook] ========== REQUEST RECEIVED at ${requestTimestamp} ==========`);
  
  if (req.method === 'OPTIONS') {
    console.log("[Inbox Webhook] Handling OPTIONS preflight request");
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Log request details for debugging
  const requestHeaders: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    requestHeaders[key] = value;
  });
  console.log("[Inbox Webhook] Method:", req.method);
  console.log("[Inbox Webhook] Headers:", JSON.stringify(requestHeaders));

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const uazapiUrl = Deno.env.get('UAZAPI_URL')!;
    const uazapiToken = Deno.env.get('UAZAPI_TOKEN')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const rawBody = await req.text();
    console.log("[Inbox Webhook] Raw body:", rawBody);
    
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch (parseError) {
      console.error("[Inbox Webhook] Failed to parse JSON body:", parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body', received: rawBody.substring(0, 500) }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log("[Inbox Webhook] Parsed payload:", JSON.stringify(body));
    console.log("[Inbox Webhook] Event type:", body.event || 'not specified');
    console.log("[Inbox Webhook] Instance/Token:", body.instance || body.token || 'not specified');

    // Check if this is a message status update event (delivery/read receipts)
    const eventType = body.EventType || body.event;
    
    // Expanded list of status events for UAZAPI v2
    const statusEvents = [
      'message_ack', 
      'ack', 
      'message.ack', 
      'messages.ack', 
      'status',
      'message.update',      // UAZAPI v2
      'messages.update',     // UAZAPI v2
      'message_update',      // Alternative format
      'acks',                // Alternative format
      'MessageAck',          // UAZAPI v2 PascalCase
      'message.status',      // Alternative v2 format
      'messages.status',     // Alternative v2 format
      'MessageUpdate',       // PascalCase v2
      'message-ack',         // kebab-case
      'message-update',      // kebab-case
      'receipt',             // Common name for read receipts
      'read',                // Direct read event
      'delivered'            // Direct delivered event
    ];
    const isStatusEvent = eventType && statusEvents.includes(eventType);
    
    // Also check for inline ACK in the message payload (various locations)
    const hasInlineAck = typeof body.ack === 'number' || 
                         body.message?.ack !== undefined || 
                         body.data?.ack !== undefined ||
                         body.data?.status !== undefined;
    
    // Check if this is an outgoing message with ACK info (fromMe=true with ack)
    const isOutgoingWithAck = body.message?.fromMe === true && body.message?.ack !== undefined;
    
    console.log(`[Inbox Webhook] Event detection:`);
    console.log(`[Inbox Webhook]   - EventType: ${eventType}`);
    console.log(`[Inbox Webhook]   - isStatusEvent: ${isStatusEvent}`);
    console.log(`[Inbox Webhook]   - hasInlineAck: ${hasInlineAck}`);
    console.log(`[Inbox Webhook]   - isOutgoingWithAck: ${isOutgoingWithAck}`);
    
    if (isStatusEvent || hasInlineAck || isOutgoingWithAck) {
      console.log(`[Inbox Webhook] === STATUS UPDATE DETECTED ===`);
      console.log(`[Inbox Webhook] EventType: ${eventType}`);
      console.log(`[Inbox Webhook] ACK sources: body.ack=${body.ack}, message.ack=${body.message?.ack}, data.ack=${body.data?.ack}`);
      console.log(`[Inbox Webhook] Message ID sources: id=${body.id}, message.id=${body.message?.id}, message.messageid=${body.message?.messageid}`);
      console.log(`[Inbox Webhook] Full payload: ${JSON.stringify(body)}`);
      
      await handleMessageStatusUpdate(supabase, body);
      return new Response(
        JSON.stringify({ success: true, event: eventType || 'inline_ack', type: 'status_update' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if this is a non-message event (qrcode, connection, etc.)
    // Accept multiple event names for messages - including EventType (UAZAPI v2)
    const messageEvents = ['messages', 'message', 'messages.upsert', 'MESSAGES_UPSERT'];
    const isMessageEvent = !eventType || messageEvents.includes(eventType);
    
    if (!isMessageEvent) {
      console.log(`[Inbox Webhook] Ignoring non-message event type: ${eventType}`);
      return new Response(
        JSON.stringify({ success: true, ignored: true, event: eventType, timestamp: requestTimestamp }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`[Inbox Webhook] Processing message event: ${eventType || 'default'}`);

    // Extract message data from various formats
    const extractedData = extractMessageData(body);
    
    // Also check for standard format
    const standardFormat = body as IncomingMessage;
    
    let phone: string;
    let message: string;
    let instanceKey: string | undefined;
    let instanceId: string | undefined;
    let contactName: string;
    let mediaUrl: string | undefined;
    let mediaType: string | undefined;

    let messageId: string | undefined;
    let hasMedia = false;
    let mimetype: string | undefined;
    let caption: string | undefined;

    let fromMe = false;  // Track if message is from us (device or system)

    if (extractedData) {
      // UAZAPI format
      phone = extractedData.phone;
      message = extractedData.message;
      contactName = extractedData.contactName;
      mediaUrl = extractedData.mediaUrl;
      mediaType = extractedData.mediaType;
      instanceKey = body.token || body.instance;
      messageId = extractedData.messageId;
      hasMedia = extractedData.hasMedia || false;
      mimetype = extractedData.mimetype;
      caption = extractedData.caption;
      fromMe = extractedData.fromMe || false;
    } else if (standardFormat.phone && standardFormat.message) {
      // Standard format from our internal calls
      phone = standardFormat.phone;
      message = standardFormat.message;
      instanceKey = standardFormat.instanceKey;
      instanceId = standardFormat.instanceId;
      contactName = standardFormat.contactName || phone;
      mediaUrl = standardFormat.mediaUrl;
      mediaType = standardFormat.mediaType;
    } else {
      console.log("[Inbox Webhook] Could not extract message data from payload");
      return new Response(
        JSON.stringify({ error: 'Could not parse message data', received: body }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Inbox Webhook] Received message from: ${phone}, instanceKey: ${instanceKey || 'none'}, hasMedia: ${hasMedia}, messageId: ${messageId}, fromMe: ${fromMe}`);

    // For messages with media, we need either a URL or phone/message content
    if (!phone) {
      return new Response(
        JSON.stringify({ error: 'phone is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If message is empty but has media, that's okay - we'll show media preview
    if (!message && !hasMedia) {
      return new Response(
        JSON.stringify({ error: 'message or media is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find the instance
    let instanceQuery = supabase.from('whatsapp_instances').select('*');
    
    if (instanceId) {
      instanceQuery = instanceQuery.eq('id', instanceId);
    } else if (instanceKey) {
      instanceQuery = instanceQuery.eq('instance_key', instanceKey);
    } else {
      return new Response(
        JSON.stringify({ error: 'instanceKey or instanceId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: instance, error: instanceError } = await instanceQuery.single();

    if (instanceError || !instance) {
      console.error('[Inbox Webhook] Instance not found:', instanceError);
      return new Response(
        JSON.stringify({ error: 'WhatsApp instance not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Inbox Webhook] Found instance: ${instance.instance_name}`);

    // Normalize phone number
    const normalizedPhone = phone.replace(/\D/g, '');

    // === DOWNLOAD MEDIA IF NEEDED ===
    // If message has media but no URL, download from UAZAPI
    let uazapiTranscription: string | undefined;

    // For audio, try to use /message/download even if we already have mediaUrl, because it may provide transcription.
    const shouldDownloadForAudioTranscript =
      hasMedia && (mediaType === 'audio' || mediaType === 'ptt') && !!messageId && !!instance.instance_key;

    if ((hasMedia && !mediaUrl && messageId && instance.instance_key) || shouldDownloadForAudioTranscript) {
      console.log(`[Inbox Webhook] Message has media but no URL, downloading via /message/download...`);

      // TS safety: ensure messageId exists here
      const safeMessageId = messageId;
      if (!safeMessageId) {
        console.log('[Inbox Webhook] Skipping media download: messageId is missing');
      } else {
      
      const { fileUrl, mimetype: downloadedMimetype, transcription } = await downloadMediaFromUAZAPI(
        uazapiUrl,
        instance.instance_key,
        safeMessageId,
        mediaType || 'unknown'
      );

      if (transcription && transcription.trim()) {
        uazapiTranscription = transcription.trim();
      }
      
      if (fileUrl) {
        // Only override mediaUrl when we didn't have one.
        if (!mediaUrl) mediaUrl = fileUrl;
        console.log(`[Inbox Webhook] Media downloaded successfully: ${mediaUrl.substring(0, 80)}...`);
        
        // Determine media type from mimetype if not set
        if (!mediaType && downloadedMimetype) {
          if (downloadedMimetype.startsWith('image/')) mediaType = 'image';
          else if (downloadedMimetype.startsWith('video/')) mediaType = 'video';
          else if (downloadedMimetype.startsWith('audio/')) mediaType = 'audio';
          else mediaType = 'document';
        }
        
        // Update mimetype if downloaded
        if (downloadedMimetype) {
          mimetype = downloadedMimetype;
        }
      } else {
        console.log(`[Inbox Webhook] Failed to download media, saving message without media URL`);
      }
      }
    }

    // Determine final media type for database (use proper MIME type)
    const finalMediaType = mapMediaTypeToMime(mediaType, mimetype);
    
    // Create preview message for media
    const previewMessage = message || (hasMedia ? getMediaPreviewLabel(mediaType, caption) : '');

    // Find or create conversation
    let { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('instance_id', instance.id)
      .eq('phone', normalizedPhone)
      .single();

    if (convError && convError.code !== 'PGRST116') {
      console.error('[Inbox Webhook] Error fetching conversation:', convError);
    }

    if (!conversation) {
      // Fetch avatar before creating conversation
      let contactAvatar: string | null = null;
      const avatarUazapiUrl = Deno.env.get("UAZAPI_URL") || "https://zynk2.uazapi.com";
      
      contactAvatar = await fetchContactAvatar(avatarUazapiUrl, normalizedPhone, instance.instance_key);

      // Detect country code from phone number
      const countryCode = detectCountryCode(normalizedPhone);
      console.log(`[Inbox Webhook] Detected country code for ${normalizedPhone}: ${countryCode}`);

      // Load AI preferences for the instance owner (Auto IA + Agente padrão)
      let autoStartAI = false;
      let defaultAgentId: string | null = null;
      try {
        const { data: prefs } = await supabase
          .from('ai_agent_preferences')
          .select('auto_start_ai, default_agent_id')
          .eq('user_id', instance.user_id)
          .maybeSingle();
        autoStartAI = prefs?.auto_start_ai === true;
        defaultAgentId = prefs?.default_agent_id ?? null;
      } catch (e) {
        console.log('[Inbox Webhook] Failed to load ai_agent_preferences (ignored):', e);
      }

      // Create new conversation
      const { data: newConv, error: createError } = await supabase
        .from('conversations')
        .insert({
          instance_id: instance.id,
          user_id: instance.user_id,
          phone: normalizedPhone,
          contact_name: contactName || normalizedPhone,
          contact_avatar: contactAvatar,
          country_code: countryCode,
          status: 'open',
          ai_enabled: autoStartAI,
          active_agent_id: autoStartAI ? defaultAgentId : null,
          metadata: {
            ai_prompt_pending: !autoStartAI,
          },
          unread_count: 1,
          last_message_at: new Date().toISOString(),
          last_message_preview: previewMessage.substring(0, 100)
        })
        .select()
        .single();

      if (createError) {
        console.error('[Inbox Webhook] Error creating conversation:', createError);
        return new Response(
          JSON.stringify({ error: 'Failed to create conversation' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      conversation = newConv;
      console.log(`[Inbox Webhook] Created new conversation: ${conversation.id}`);
    } else {
      // Update existing conversation
      // For outgoing messages (fromMe), don't increment unread_count
      const updateData: Record<string, unknown> = {
        last_message_at: new Date().toISOString(),
        last_message_preview: previewMessage.substring(0, 100),
      };
      
      // Only update these for incoming messages
      if (!fromMe) {
        updateData.status = conversation.status === 'resolved' ? 'open' : conversation.status;
        updateData.unread_count = (conversation.unread_count || 0) + 1;
        updateData.contact_name = contactName || conversation.contact_name;
      }
      
      const { error: updateError } = await supabase
        .from('conversations')
        .update(updateData)
        .eq('id', conversation.id);

      if (updateError) {
        console.error('[Inbox Webhook] Error updating conversation:', updateError);
      }
      console.log(`[Inbox Webhook] Updated conversation: ${conversation.id}, fromMe: ${fromMe}`);
    }

    // Check if this outgoing message already exists (avoid duplicates for messages sent via system)
    if (fromMe) {
      console.log(`[Inbox Webhook] Checking for duplicate outgoing message. messageId: ${messageId}, content: "${(message || previewMessage).substring(0, 50)}..."`);
      
      // Extract short ID (without instance prefix) for flexible matching
      const messageIdShort = messageId?.includes(':') ? messageId.split(':').pop() : messageId;
      
      // Fetch recent agent messages for this conversation (last 60 seconds)
      const { data: existingMsgs, error: dupError } = await supabase
        .from('chat_inbox_messages')
        .select('id, metadata, content, created_at')
        .eq('conversation_id', conversation.id)
        .eq('sender_type', 'agent')
        .gte('created_at', new Date(Date.now() - 60000).toISOString())
        .order('created_at', { ascending: false })
        .limit(15);
      
      if (dupError) {
        console.error(`[Inbox Webhook] Error checking duplicates:`, dupError);
      }
      
      if (existingMsgs && existingMsgs.length > 0) {
        console.log(`[Inbox Webhook] Found ${existingMsgs.length} recent agent messages to check`);
        
        // Check for duplicate by whatsapp_id (flexible matching)
        const duplicateById = messageId ? existingMsgs.find(msg => {
          const meta = msg.metadata as Record<string, unknown> | null;
          const savedId = meta?.whatsapp_id || meta?.whatsapp_message_id;
          if (!savedId) return false;
          
          const savedIdStr = String(savedId);
          const savedIdShort = savedIdStr.includes(':') ? savedIdStr.split(':').pop() : savedIdStr;
          
          // Match full ID, short ID, or partial match
          const isMatch = savedIdStr === messageId || 
                         savedIdShort === messageIdShort || 
                         (messageIdShort && savedIdStr.includes(messageIdShort)) ||
                         (messageIdShort && savedIdShort === messageIdShort);
          
          if (isMatch) {
            console.log(`[Inbox Webhook] ID match found: saved="${savedIdStr}" vs incoming="${messageId}"`);
          }
          return isMatch;
        }) : null;
        
        if (duplicateById) {
          console.log(`[Inbox Webhook] ✓ Duplicate by ID found (msg.id: ${duplicateById.id}), skipping`);
          return new Response(
            JSON.stringify({
              success: true,
              conversationId: conversation.id,
              messageId: duplicateById.id,
              skipped: true,
              reason: 'duplicate_by_whatsapp_id'
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Fallback: check for duplicate by content within last 5 seconds
        const contentToMatch = message || previewMessage;
        if (contentToMatch) {
          const fiveSecondsAgo = Date.now() - 5000;
          const duplicateByContent = existingMsgs.find(msg => {
            const msgTime = new Date(msg.created_at).getTime();
            const isRecent = msgTime >= fiveSecondsAgo;
            const isSameContent = msg.content === contentToMatch;
            
            if (isRecent && isSameContent) {
              console.log(`[Inbox Webhook] Content match found: "${msg.content?.substring(0, 30)}..." (${Math.round((Date.now() - msgTime) / 1000)}s ago)`);
            }
            return isRecent && isSameContent;
          });
          
          if (duplicateByContent) {
            console.log(`[Inbox Webhook] ✓ Duplicate by content found (msg.id: ${duplicateByContent.id}), skipping`);
            return new Response(
              JSON.stringify({
                success: true,
                conversationId: conversation.id,
                messageId: duplicateByContent.id,
                skipped: true,
                reason: 'duplicate_by_content'
              }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      }
      
      console.log(`[Inbox Webhook] No duplicate found, proceeding with save`);
    }

    // Save message - set sender_type based on fromMe flag
    const senderType = fromMe ? 'agent' : 'contact';
    const messageMetadata: Record<string, unknown> = { 
      phone, 
      original_message: body,
      whatsapp_message_id: messageId,
      whatsapp_id: messageId,  // Also save as whatsapp_id for status updates
      has_media: hasMedia,
      original_media_type: mediaType,
      file_name: caption || undefined
    };

    // ===== AUDIO TRANSCRIPTION (INCOMING) =====
    const isIncoming = !fromMe;
    const isAudio = (mediaType === 'audio' || mediaType === 'ptt') || (finalMediaType?.startsWith('audio/') ?? false);
    let transcriptText: string | undefined;

    if (isIncoming && isAudio) {
      // Priority 1: transcription from UAZAPI /message/download
      if (uazapiTranscription && uazapiTranscription.trim()) {
        transcriptText = uazapiTranscription.trim();
        messageMetadata.transcription = {
          text: transcriptText,
          provider: 'uazapi',
          language: 'pt',
          created_at: new Date().toISOString(),
        };
      } else if (mediaUrl) {
        // Priority 2: fallback to OpenAI Whisper
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
        const t = await transcribeAudioViaEdge(supabaseUrl, supabaseServiceKey, mediaUrl, finalMediaType);
        if (t?.text) {
          transcriptText = t.text;
          messageMetadata.transcription = {
            text: transcriptText,
            provider: t.provider,
            language: t.language,
            created_at: new Date().toISOString(),
          };
        }
      }
    }
    
    // For outgoing messages (from device), add source indicator and status
    if (fromMe) {
      messageMetadata.source = 'device';  // Indicates sent from phone, not system
      messageMetadata.status = 'sent';
      messageMetadata.sent_by = 'Celular';
    }
    
    const { data: savedMessage, error: msgError } = await supabase
      .from('chat_inbox_messages')
      .insert({
        conversation_id: conversation.id,
        sender_type: senderType,
        sender_id: null,  // null for both incoming and device-sent messages
        content: message || caption || '',
        media_url: mediaUrl,
        media_type: finalMediaType,
        is_read: fromMe,  // Outgoing messages are already read
        metadata: messageMetadata
      })
      .select()
      .single();

    if (msgError) {
      console.error('[Inbox Webhook] Error saving message:', msgError);
    } else {
      console.log(`[Inbox Webhook] Saved ${senderType} message: ${savedMessage.id}`);
    }

    // Fire-and-forget: update structured client memory from this message (incoming + device-sent)
    if (savedMessage) {
      const extractedText = transcriptText ? `${message || caption || ''}\n\n(ÁUDIO) ${transcriptText}` : (message || caption || '');
      invokeMemoryExtractor({
        userId: instance.user_id,
        agentId: null,
        phone: normalizedPhone,
        contactName: conversation.contact_name,
        message: extractedText,
      });
    }

    // ===== OWNER NOTIFICATION SYSTEM =====
    // Only trigger for INCOMING messages (not fromMe)
    if (!fromMe && savedMessage) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
      
      // Determine if this is a new contact (conversation was just created)
      const isNewContact = !conversation.created_at || 
        (new Date().getTime() - new Date(conversation.created_at).getTime()) < 5000;
      
      // Try to fetch client memory for VIP detection
      let clientMemory: any = null;
      try {
        const { data: memoryData } = await supabase
          .from('ai_client_memories')
          .select('is_vip, client_name')
          .eq('phone', normalizedPhone)
          .eq('user_id', instance.user_id)
          .maybeSingle();
        clientMemory = memoryData;
      } catch (e) {
        // Memory fetch is optional, continue without it
      }
      
      // Detect if this event should trigger a notification
      const detectedEvent = detectNotifiableEvent(
        message || caption || '',
        mediaType,
        isNewContact,
        clientMemory
      );
      
      if (detectedEvent.shouldNotify) {
        // Fire and forget - don't await
        sendOwnerNotification(
          supabaseUrl,
          supabaseServiceKey,
          instance.user_id,
          detectedEvent.eventType,
          normalizedPhone,
          conversation.contact_name,
          detectedEvent.summary,
          conversation.id,
          instance.id,
          detectedEvent.urgency
        );
      }
    }

    // ===== BOT PROXY SYSTEM =====
    // Check if this conversation has bot proxy enabled (via label)
    let botProxyHandled = false;
    
    try {
      // First, check if message is FROM the bot (to forward to client)
      // Try multiple phone formats for matching
      const phoneVariants = [
        normalizedPhone,
        normalizedPhone.replace(/^55/, ''),
        '55' + normalizedPhone.replace(/^55/, '')
      ];
      
      console.log(`[Bot Proxy] Checking if sender is a configured bot. Phone variants:`, phoneVariants);
      
      const { data: proxyConfigByBot } = await supabase
        .from('bot_proxy_config')
        .select('*, trigger_label:inbox_labels(*)')
        .eq('is_active', true)
        .in('bot_phone', phoneVariants)
        .maybeSingle();
      
      if (proxyConfigByBot && !fromMe) {
        // Message is FROM the bot - find the active session to forward to client
        console.log(`[Bot Proxy] Message from bot ${normalizedPhone}, config found:`, proxyConfigByBot.id);
        
        const { data: activeSession, error: sessionError } = await supabase
          .from('bot_proxy_sessions')
          .select('*, config:bot_proxy_config(*)')
          .eq('config_id', proxyConfigByBot.id)
          .eq('is_active', true)
          .order('last_activity_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (sessionError) {
          console.error(`[Bot Proxy] Error fetching session:`, sessionError);
        }
        
        if (activeSession && activeSession.client_conversation_id) {
          console.log(`[Bot Proxy] Found active session for client ${activeSession.client_phone}, session ID: ${activeSession.id}`);
          
          // Update bot_conversation_id if not set
          if (!activeSession.bot_conversation_id) {
            await supabase
              .from('bot_proxy_sessions')
              .update({ 
                bot_conversation_id: conversation.id,
                last_activity_at: new Date().toISOString()
              })
              .eq('id', activeSession.id);
          }
          
          // Get the client conversation first
          const { data: clientConv, error: convError } = await supabase
            .from('conversations')
            .select('*')
            .eq('id', activeSession.client_conversation_id)
            .single();
          
          if (convError) {
            console.error(`[Bot Proxy] Error fetching client conversation:`, convError);
          }
          
          console.log(`[Bot Proxy] Client conversation found:`, clientConv ? `ID: ${clientConv.id}, instance_id: ${clientConv.instance_id}` : 'NULL');
          
          // Then get the instance separately
          let clientInstance = null;
          if (clientConv && clientConv.instance_id) {
            const { data: instData, error: instError } = await supabase
              .from('whatsapp_instances')
              .select('*')
              .eq('id', clientConv.instance_id)
              .single();
            
            if (instError) {
              console.error(`[Bot Proxy] Error fetching instance:`, instError);
            }
            clientInstance = instData;
          }
          
          console.log(`[Bot Proxy] Instance found:`, clientInstance ? `Key: ${clientInstance.instance_key?.substring(0, 8)}...` : 'NULL');
          
          if (clientConv && clientInstance && clientInstance.instance_key) {
            // Forward message to client (simple bridge - no modifications)
            const clientPhone = formatPhoneNumber(activeSession.client_phone, detectCountryCode(activeSession.client_phone) ?? 'BR');
            const messageContent = message || caption || '';
            
            console.log(`[Bot Proxy] Forwarding bot message to client ${clientPhone}: "${messageContent.substring(0, 100)}..."`);
            
            // Send to client via UAZAPI
            const sendResult = await sendTextViaUazapi(
              uazapiUrl,
              clientInstance.instance_key,
              clientPhone,
              messageContent
            );
            
            console.log(`[Bot Proxy] Send result:`, sendResult);
          
            if (sendResult) {
              // Save forwarded message in client conversation
              const { error: insertError } = await supabase
                .from('chat_inbox_messages')
                .insert({
                  conversation_id: activeSession.client_conversation_id,
                  sender_type: 'agent',
                  content: messageContent,
                  metadata: { 
                    proxied_from_bot: true,
                    original_message_id: savedMessage?.id,
                    bot_phone: normalizedPhone
                  }
                });
              
              if (insertError) {
                console.error(`[Bot Proxy] Error saving forwarded message:`, insertError);
              }
              
              // Update session activity
              await supabase
                .from('bot_proxy_sessions')
                .update({ last_activity_at: new Date().toISOString() })
                .eq('id', activeSession.id);
              
              // Update client conversation last_message
              await supabase
                .from('conversations')
                .update({
                  last_message_at: new Date().toISOString(),
                  last_message_preview: messageContent.substring(0, 100)
                })
                .eq('id', activeSession.client_conversation_id);
              
              console.log(`[Bot Proxy] Successfully forwarded bot message to client`);
              botProxyHandled = true;
            } else {
              console.error(`[Bot Proxy] Failed to send message to client via UAZAPI`);
            }
          } else {
            console.error(`[Bot Proxy] Missing client conversation or instance data`);
          }
        } else {
          console.log(`[Bot Proxy] No active session found for this bot config`);
        }
      }
      
      // If not from bot, check if client conversation has proxy label
      if (!botProxyHandled && !fromMe) {
        // Check if this conversation has the trigger label
        const { data: convLabels } = await supabase
          .from('conversation_labels')
          .select('label_id')
          .eq('conversation_id', conversation.id);
        
        if (convLabels && convLabels.length > 0) {
          const labelIds = convLabels.map(cl => cl.label_id);
          
          // Check if any of these labels is a bot proxy trigger
          const { data: proxyConfig } = await supabase
            .from('bot_proxy_config')
            .select('*')
            .eq('user_id', instance.user_id)
            .eq('is_active', true)
            .in('trigger_label_id', labelIds)
            .maybeSingle();
          
          if (proxyConfig && proxyConfig.instance_id) {
            console.log(`[Bot Proxy] Conversation has proxy label, forwarding to bot ${proxyConfig.bot_phone}`);
            
            // Get or create session
            let { data: session } = await supabase
              .from('bot_proxy_sessions')
              .select('*')
              .eq('config_id', proxyConfig.id)
              .eq('client_conversation_id', conversation.id)
              .eq('is_active', true)
              .maybeSingle();
            
            if (!session) {
              // Create new session
              const { data: newSession } = await supabase
                .from('bot_proxy_sessions')
                .insert({
                  config_id: proxyConfig.id,
                  client_conversation_id: conversation.id,
                  client_phone: normalizedPhone
                })
                .select()
                .single();
              session = newSession;
              console.log(`[Bot Proxy] Created new session: ${session?.id}`);
            }
            
            if (session) {
              const messageContent = message || caption || '';
              
              // Forward client message to bot (simple bridge - no payment interception)
              // Get the instance to use for sending to bot
              const { data: proxyInstance } = await supabase
                .from('whatsapp_instances')
                .select('*')
                .eq('id', proxyConfig.instance_id)
                .single();
              
              if (proxyInstance && proxyInstance.instance_key) {
                const botPhone = formatPhoneNumber(proxyConfig.bot_phone, detectCountryCode(proxyConfig.bot_phone) ?? 'BR');
                
                console.log(`[Bot Proxy] Forwarding client message to bot ${botPhone}: "${messageContent.substring(0, 50)}..."`);
                
                // Send to bot via UAZAPI
                const sendResult = await sendTextViaUazapi(
                  uazapiUrl,
                  proxyInstance.instance_key,
                  botPhone,
                  messageContent
                );
                
                if (sendResult) {
                  // Update session activity
                  await supabase
                    .from('bot_proxy_sessions')
                    .update({ last_activity_at: new Date().toISOString() })
                    .eq('id', session.id);
                  
                  // Mark message as proxied in metadata
                  if (savedMessage) {
                    await supabase
                      .from('chat_inbox_messages')
                      .update({
                        metadata: {
                          ...((savedMessage.metadata as Record<string, unknown>) || {}),
                          proxied_to_bot: true,
                          bot_phone: proxyConfig.bot_phone
                        }
                      })
                      .eq('id', savedMessage.id);
                  }
                  
                  console.log(`[Bot Proxy] Successfully forwarded client message to bot`);
                  botProxyHandled = true;
                }
              }
            }
          }
        }
      }
    } catch (proxyError) {
      console.error('[Bot Proxy] Error processing proxy:', proxyError);
    }
    
    // Skip AI processing if bot proxy handled the message
    if (botProxyHandled) {
      console.log('[Bot Proxy] Message handled by bot proxy, skipping AI');
      return new Response(
        JSON.stringify({
          success: true,
          conversationId: conversation.id,
          messageId: savedMessage?.id,
          proxied: true
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // ===== Numeric menu interception (manual, stateful) =====
    // If conversation is waiting for a numeric choice, it takes priority over AI.
    const convMeta = (conversation as any)?.metadata as Record<string, unknown> | null;
    const botMenu = (convMeta as any)?.bot_menu as any;
    if (!fromMe && botMenu?.mode === 'numeric' && botMenu?.status === 'waiting_choice') {
      const rawText = (transcriptText?.trim() ? transcriptText.trim() : (message || caption || '')).trim();
      const match = rawText.match(/^\s*(\d+)\s*$/);
      const selected = match?.[1];

      const agentId = (botMenu?.agent_id as string | undefined) || conversation.active_agent_id || null;
      if (!agentId) {
        console.log('[Numeric Menu] No agent_id found in state, skipping.');
      } else {
        const { data: agent } = await supabase
          .from('ai_agents')
          .select('*')
          .eq('id', agentId)
          .maybeSingle();

        const menuCfg = agent ? getNumericMenuFromAgent(agent.consultation_context) : null;
        const optionsObj = menuCfg?.options || {};
        const optionKeys = Object.keys(optionsObj).filter(Boolean);

        if (menuCfg?.enabled) {
          let replyToSend = '';
          let willComplete = false;

          if (selected && optionsObj?.[selected]?.reply) {
            replyToSend = (optionsObj[selected].reply ?? '').toString();
            willComplete = true;
          } else {
            const keysText = optionKeys.length ? optionKeys.join(', ') : '1, 2, 3';
            replyToSend = `Opção inválida. Responda com ${keysText}.`;
          }

          // Save menu reply to DB
          await supabase
            .from('chat_inbox_messages')
            .insert({
              conversation_id: conversation.id,
              sender_type: 'ai',
              content: replyToSend,
              metadata: {
                agent_id: agent?.id,
                agent_name: agent?.name,
                bot_menu: {
                  mode: 'numeric',
                  status: willComplete ? 'done' : 'waiting_choice',
                  selected_option: willComplete ? selected : null,
                },
              },
            });

          // Update conversation metadata/state
          const nextMeta: Record<string, unknown> = {
            ...(convMeta || {}),
            bot_menu: {
              ...(botMenu || {}),
              status: willComplete ? 'done' : 'waiting_choice',
              selected_option: willComplete ? selected : undefined,
              completed_at: willComplete ? new Date().toISOString() : undefined,
              last_invalid_at: !willComplete ? new Date().toISOString() : undefined,
            },
          };

          const previewText = replyToSend.substring(0, 100);
          await supabase
            .from('conversations')
            .update({
              metadata: nextMeta,
              last_message_at: new Date().toISOString(),
              last_message_preview: previewText,
            } as any)
            .eq('id', conversation.id);

          // Send via UAZAPI using agent send config (if present)
          const formattedPhone = formatPhoneNumber(normalizedPhone, detectCountryCode(normalizedPhone) ?? 'BR');
          const sendConfig: MessageSendConfig = {
            response_delay_min: agent?.response_delay_min ?? DEFAULT_SEND_CONFIG.response_delay_min,
            response_delay_max: agent?.response_delay_max ?? DEFAULT_SEND_CONFIG.response_delay_max,
            max_lines_per_message: agent?.max_lines_per_message ?? DEFAULT_SEND_CONFIG.max_lines_per_message,
            split_mode: agent?.split_mode ?? DEFAULT_SEND_CONFIG.split_mode,
            split_delay_min: agent?.split_delay_min ?? DEFAULT_SEND_CONFIG.split_delay_min,
            split_delay_max: agent?.split_delay_max ?? DEFAULT_SEND_CONFIG.split_delay_max,
            max_chars_per_message: agent?.max_chars_per_message ?? DEFAULT_SEND_CONFIG.max_chars_per_message,
            typing_simulation: agent?.typing_simulation ?? DEFAULT_SEND_CONFIG.typing_simulation,
          };
          await sendAIResponseWithConfig(
            uazapiUrl,
            instance.instance_key || uazapiToken,
            formattedPhone,
            replyToSend,
            sendConfig,
          );

          console.log(`[Numeric Menu] Replied (${willComplete ? 'completed' : 'invalid'})`);
          return new Response(
            JSON.stringify({
              success: true,
              conversationId: conversation.id,
              messageId: savedMessage?.id,
              numeric_menu: {
                status: willComplete ? 'done' : 'waiting_choice',
                selected_option: willComplete ? selected : null,
              },
            }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            },
          );
        }
      }
    }

    // Check if AI should respond - only for INCOMING messages (not fromMe)
    // AI responds if ai_enabled is true, regardless of assigned_to
    // This allows explicit AI activation even when a human is assigned
    if (!fromMe && conversation.ai_enabled) {
      if (conversation.assigned_to) {
        console.log('[Inbox Webhook] AI enabled explicitly, processing despite human assignment');
      }
      console.log('[Inbox Webhook] AI is enabled for incoming message, checking for routing...');
      
      // ========== DYNAMIC AGENT ROUTING ==========
      // Priority 1: Check if conversation has an active agent assigned
      // Priority 2: Fall back to instance default routing
      
      let agent = null;
      let usedActiveAgent = false;
      
      // Check for active_agent_id in conversation (dynamic transfer)
      if (conversation.active_agent_id) {
        console.log(`[Inbox Webhook] Conversation has active_agent_id: ${conversation.active_agent_id}`);
        
        const { data: activeAgent, error: activeAgentError } = await supabase
          .from('ai_agents')
          .select('*')
          .eq('id', conversation.active_agent_id)
          .eq('is_active', true)
          .maybeSingle();
        
        if (!activeAgentError && activeAgent && activeAgent.is_whatsapp_enabled) {
          agent = activeAgent;
          usedActiveAgent = true;
          console.log(`[Inbox Webhook] Using conversation's active agent: ${agent.name}`);
        } else {
          console.log(`[Inbox Webhook] Active agent not found or disabled, falling back to routing`);
        }
      }
      
      // Fall back to instance routing if no active agent
      if (!agent) {
        const { data: routing, error: routingError } = await supabase
          .from('whatsapp_agent_routing')
          .select(`
            *,
            agent:ai_agents(*)
          `)
          .eq('instance_id', instance.id)
          .eq('is_active', true)
          .maybeSingle();

        if (!routingError && routing && routing.agent) {
          agent = routing.agent;
          console.log(`[Inbox Webhook] Using instance routing agent: ${agent.name}`);
        }
      }
      
      if (agent && agent.is_whatsapp_enabled && agent.is_active) {
        console.log(`[Inbox Webhook] Routing to AI agent: ${agent.name} (buffer: ${agent.message_buffer_enabled})`);
          
          // Check if message buffer is enabled
          if (agent.message_buffer_enabled) {
            // ============ MESSAGE BUFFER SYSTEM ============
            const bufferWaitSeconds = agent.buffer_wait_seconds || 5;
            const scheduledAt = new Date(Date.now() + bufferWaitSeconds * 1000).toISOString();

            // Build the effective text for AI (audio transcription + image description/OCR)
            const isIncomingImage = !fromMe && (mediaType === 'image' || (finalMediaType?.startsWith('image/') ?? false));
            let imageDesc: string | null = null;
            if (isIncomingImage && mediaUrl) {
              imageDesc = await describeImageViaGateway(mediaUrl);
            }

            const effectiveTextForAI = transcriptText?.trim()
              ? `(ÁUDIO) ${transcriptText.trim()}`
              : (imageDesc?.trim()
                  ? `${message || caption || ''}\n\n(IMAGEM) ${imageDesc.trim()}`.trim()
                  : (message || caption || ''));
            
            // Check for existing active buffer
            const { data: existingBuffer } = await supabase
              .from('ai_message_buffer')
              .select('*')
              .eq('conversation_id', conversation.id)
              .eq('status', 'buffering')
              .single();
            
            if (existingBuffer) {
              // Add message to existing buffer and reschedule
              const currentMessages = existingBuffer.messages as Array<{ content: string; timestamp: string }>;
              const updatedMessages = [...currentMessages, {
                  content: effectiveTextForAI,
                timestamp: new Date().toISOString()
              }];
              
              // Check if we hit max messages
              const maxMessages = agent.buffer_max_messages || 10;
              const shouldForceProcess = updatedMessages.length >= maxMessages;
              
              await supabase
                .from('ai_message_buffer')
                .update({
                  messages: updatedMessages,
                  last_message_at: new Date().toISOString(),
                  scheduled_response_at: shouldForceProcess ? new Date().toISOString() : scheduledAt
                })
                .eq('id', existingBuffer.id);
              
              console.log(`[Inbox Webhook] Added to buffer (${updatedMessages.length}/${maxMessages} msgs), ${shouldForceProcess ? 'forcing process' : `will respond in ${bufferWaitSeconds}s`}`);
            } else {
              // Create new buffer
              await supabase
                .from('ai_message_buffer')
                .insert({
                  conversation_id: conversation.id,
                  phone: normalizedPhone,
                  instance_id: instance.id,
                  user_id: instance.user_id,
                  agent_id: agent.id,
                    messages: [{ content: effectiveTextForAI, timestamp: new Date().toISOString() }],
                  scheduled_response_at: scheduledAt
                });
              
              console.log(`[Inbox Webhook] Created new buffer, AI will respond in ${bufferWaitSeconds}s`);
            }
            
            // Don't call AI here - the buffer processor will handle it
            // Trigger the processor after a delay using fire-and-forget fetch
            // We don't await this - it runs in the background
            const supabaseUrlForBuffer = Deno.env.get('SUPABASE_URL') || '';
            const supabaseServiceKeyForBuffer = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
            
            // Fire and forget - trigger processor after buffer wait time
            // The processor will check scheduled_response_at and only process ready buffers
            setTimeout(async () => {
              try {
                await fetch(`${supabaseUrlForBuffer}/functions/v1/ai-buffer-processor`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${supabaseServiceKeyForBuffer}`
                  }
                });
                console.log('[Inbox Webhook] Buffer processor triggered');
              } catch (e) {
                console.error('[Inbox Webhook] Error triggering buffer processor:', e);
              }
            }, (bufferWaitSeconds + 1) * 1000);
            
          } else {
            // ============ IMMEDIATE RESPONSE (OLD BEHAVIOR) ============
            const sessionId = conversation.id;
            let assistantResponse = '';

            const isIncomingImage = !fromMe && (mediaType === 'image' || (finalMediaType?.startsWith('image/') ?? false));
            let imageDesc: string | null = null;
            if (isIncomingImage && mediaUrl) {
              imageDesc = await describeImageViaGateway(mediaUrl);
            }

            const effectiveTextForAI = transcriptText?.trim()
              ? `(ÁUDIO) ${transcriptText.trim()}`
              : (imageDesc?.trim()
                  ? `${message || caption || ''}\n\n(IMAGEM) ${imageDesc.trim()}`.trim()
                  : (message || caption || ''));
            
            try {
              if (agent.use_native_ai) {
                console.log(`[Inbox Webhook] Calling native AI agent with model: ${agent.ai_model || 'google/gemini-2.5-flash'}`);
                
                const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
                const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
                
                const aiChatResponse = await fetch(
                  `${supabaseUrl}/functions/v1/ai-agent-chat`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${supabaseServiceKey}`
                    },
                    body: JSON.stringify({
                      agentId: agent.id,
                      message: effectiveTextForAI,
                      sessionId: sessionId,
                      source: 'whatsapp-inbox',
                      phone: normalizedPhone,
                      conversationId: conversation.id
                    })
                  }
                );

                if (aiChatResponse.ok) {
                  const aiData = await aiChatResponse.json();
                  assistantResponse = aiData.message?.content || aiData.response || '';
                  console.log(`[Inbox Webhook] Native AI response received: ${assistantResponse.substring(0, 100)}...`);
                  
                  // ============ HANDLE PIX GENERATION IF AI DECIDED ============
                  if (aiData.pixGenerated) {
                    console.log('[Inbox Webhook] AI generated PIX, sending QR code and message...');
                    
                    const pixData = aiData.pixGenerated;
                    const formattedPhonePix = formatPhoneNumber(normalizedPhone, detectCountryCode(normalizedPhone) ?? 'BR');
                    
                    try {
                      // Send QR Code image first
                      if (pixData.pix_qr_code) {
                        const qrCodeBase64 = pixData.pix_qr_code.startsWith('data:') 
                          ? pixData.pix_qr_code.split(',')[1] 
                          : pixData.pix_qr_code;
                        
                        await fetch(`${uazapiUrl}/send/media`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'token': instance.instance_key || uazapiToken
                          },
                          body: JSON.stringify({
                            number: formattedPhonePix,
                            media: qrCodeBase64,
                            type: 'image',
                            caption: `💳 ${pixData.plan_name} - R$ ${Number(pixData.amount).toFixed(2)}`
                          })
                        });
                        
                        console.log('[Inbox Webhook] PIX QR Code sent');
                      }
                      
                      // Wait a bit before sending text
                      await sleep(1500);
                      
                      // Send formatted PIX message
                      const pixMessage = `📱 *Pagamento PIX Gerado*

💳 *${pixData.plan_name}*
💰 Valor: *R$ ${Number(pixData.amount).toFixed(2)}*
📅 Duração: ${pixData.duration_days} dias
⏰ Expira em 10 minutos

📋 *Código PIX (copie abaixo):*

\`\`\`
${pixData.pix_code}
\`\`\`

✅ Após o pagamento, envie o comprovante para confirmarmos!`;

                      await sendTextViaUazapi(
                        uazapiUrl,
                        instance.instance_key || uazapiToken,
                        formattedPhonePix,
                        pixMessage
                      );
                      
                      console.log('[Inbox Webhook] PIX text message sent');
                      
                      // Save PIX message to conversation
                      await supabase
                        .from('chat_inbox_messages')
                        .insert({
                          conversation_id: conversation.id,
                          sender_type: 'ai',
                          content: pixMessage,
                          metadata: { 
                            agent_id: agent.id, 
                            pix_generated: true,
                            pix_amount: pixData.amount,
                            pix_plan: pixData.plan_name
                          }
                        });
                      
                    } catch (pixSendError) {
                      console.error('[Inbox Webhook] Error sending PIX:', pixSendError);
                    }
                  }
                } else {
                  const errorText = await aiChatResponse.text();
                  console.error('[Inbox Webhook] Native AI error:', errorText);
                }
              } else if (agent.webhook_url) {
                console.log(`[Inbox Webhook] Calling n8n webhook: ${agent.webhook_url}`);
                
                const n8nResponse = await fetch(agent.webhook_url, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    message,
                    sessionId,
                    phone: normalizedPhone,
                    source: 'whatsapp-inbox',
                    agentName: agent.name,
                    instanceName: instance.instance_name,
                    conversationId: conversation.id,
                    contactName: conversation.contact_name,
                    metadata: {
                      instance_id: instance.id,
                      instance_key: instance.instance_key
                    }
                  }),
                });

                if (n8nResponse.ok) {
                  const n8nData = await n8nResponse.json();
                  assistantResponse = 
                    n8nData.response || 
                    n8nData.message || 
                    n8nData.output || 
                    n8nData.text ||
                    n8nData.reply ||
                    (typeof n8nData === 'string' ? n8nData : '');
                }
              } else {
                console.log('[Inbox Webhook] Agent has no webhook URL and native AI is disabled');
              }

              if (assistantResponse) {
                // Save AI response
                await supabase
                  .from('chat_inbox_messages')
                  .insert({
                    conversation_id: conversation.id,
                    sender_type: 'ai',
                    content: assistantResponse,
                    metadata: { agent_id: agent.id, agent_name: agent.name }
                  });

                // Update conversation with last message info for realtime UI updates
                const previewText = assistantResponse.substring(0, 100);
                const { error: updateConvError } = await supabase
                  .from('conversations')
                  .update({
                    last_message_at: new Date().toISOString(),
                    last_message_preview: previewText
                  })
                  .eq('id', conversation.id);

                if (updateConvError) {
                  console.error('[Inbox Webhook] Error updating conversation preview after AI response:', updateConvError);
                } else {
                  console.log(`[Inbox Webhook] Conversation preview updated with AI response`);
                }

                // Format phone number with international support
                const formattedPhone = formatPhoneNumber(normalizedPhone, detectCountryCode(normalizedPhone) ?? 'BR');

                // Build send configuration from agent settings
                const sendConfig: MessageSendConfig = {
                  response_delay_min: agent.response_delay_min ?? DEFAULT_SEND_CONFIG.response_delay_min,
                  response_delay_max: agent.response_delay_max ?? DEFAULT_SEND_CONFIG.response_delay_max,
                  max_lines_per_message: agent.max_lines_per_message ?? DEFAULT_SEND_CONFIG.max_lines_per_message,
                  split_mode: agent.split_mode ?? DEFAULT_SEND_CONFIG.split_mode,
                  split_delay_min: agent.split_delay_min ?? DEFAULT_SEND_CONFIG.split_delay_min,
                  split_delay_max: agent.split_delay_max ?? DEFAULT_SEND_CONFIG.split_delay_max,
                  max_chars_per_message: agent.max_chars_per_message ?? DEFAULT_SEND_CONFIG.max_chars_per_message,
                  typing_simulation: agent.typing_simulation ?? DEFAULT_SEND_CONFIG.typing_simulation
                };

                // Send via UAZAPI with configured delays and splitting
                await sendAIResponseWithConfig(
                  uazapiUrl,
                  instance.instance_key || uazapiToken,
                  formattedPhone,
                  assistantResponse,
                  sendConfig
                );

                console.log('[Inbox Webhook] AI response sent successfully with config');
              }
            } catch (aiError) {
              console.error('[Inbox Webhook] Error calling AI agent:', aiError);
            }
          }
          
          // NOTE: Agent transfer is now handled by AI tool calling inside ai-agent-chat
          // The AI decides when to transfer based on customer intent, not keywords
        }
    } else {
      console.log('[Inbox Webhook] AI disabled or conversation assigned, waiting for human response');
    }

    return new Response(
      JSON.stringify({
        success: true,
        conversationId: conversation.id,
        messageId: savedMessage?.id
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: unknown) {
    console.error('[Inbox Webhook] Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
