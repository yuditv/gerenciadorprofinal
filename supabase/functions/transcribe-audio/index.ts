import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  };
}

type TranscribeRequest = {
  mediaUrl: string;
  mimeType?: string;
  language?: "pt" | "pt-BR";
  source?: "whatsapp" | "inbox";
};

function isHttpUrl(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function guessExt(mime: string | null) {
  const m = (mime ?? "").toLowerCase();
  if (m.includes("mpeg") || m === "audio/mp3") return "mp3";
  if (m.includes("mp4")) return "mp4";
  if (m.includes("wav")) return "wav";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("webm")) return "webm";
  if (m.includes("opus")) return "opus";
  if (m.includes("m4a")) return "m4a";
  return "bin";
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY")!;

    if (!openaiKey) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY is not configured" }), {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    let body: TranscribeRequest | null = null;
    try {
      body = await req.json();
    } catch {
      body = null;
    }

    if (!body?.mediaUrl) {
      return new Response(JSON.stringify({ error: "mediaUrl is required" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    if (!isHttpUrl(body.mediaUrl)) {
      return new Response(JSON.stringify({ error: "mediaUrl must be http(s)" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Auth: allow service-role internal calls OR authenticated user.
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
    const isServiceRole = !!token && token === supabaseServiceKey;

    if (!isServiceRole) {
      const supabaseAuthed = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data, error } = await supabaseAuthed.auth.getUser();
      if (error || !data?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }
    }

    const startedAt = Date.now();

    // Download audio
    const audioResp = await fetch(body.mediaUrl);
    if (!audioResp.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to download media", status: audioResp.status }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    const contentType = body.mimeType || audioResp.headers.get("content-type") || "application/octet-stream";

    const contentLength = audioResp.headers.get("content-length");
    const bytesHint = contentLength ? Number(contentLength) : null;
    const MAX_BYTES = 25 * 1024 * 1024; // 25MB (Whisper limit)
    if (bytesHint && bytesHint > MAX_BYTES) {
      return new Response(JSON.stringify({ error: "Audio too large", maxBytes: MAX_BYTES, bytes: bytesHint }), {
        status: 413,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const buf = await audioResp.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      return new Response(JSON.stringify({ error: "Audio too large", maxBytes: MAX_BYTES, bytes: buf.byteLength }), {
        status: 413,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const language = body.language === "pt-BR" ? "pt" : (body.language ?? "pt");
    const ext = guessExt(contentType);
    const file = new File([buf], `audio.${ext}`, { type: contentType });

    const form = new FormData();
    form.append("file", file);
    form.append("model", "whisper-1");
    form.append("language", language);

    const whisperResp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
      },
      body: form,
    });

    const durationMs = Date.now() - startedAt;

    if (!whisperResp.ok) {
      const t = await whisperResp.text();
      const status = whisperResp.status;
      // Pass through common limits so the caller can handle gracefully.
      if (status === 429 || status === 402) {
        return new Response(JSON.stringify({ error: t || "Provider limit", provider: "openai" }), {
          status,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "OpenAI transcription failed", status, details: t }), {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const data = await whisperResp.json();
    const text = (data?.text ?? "").toString();

    return new Response(
      JSON.stringify({
        text,
        provider: "openai",
        language,
        durationMs,
        bytes: buf.byteLength,
      }),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[transcribe-audio] error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  }
});
