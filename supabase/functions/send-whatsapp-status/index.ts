import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StatusRequest {
  instanceKey: string;
  type: 'text' | 'image' | 'video' | 'audio';
  text?: string;
  backgroundColor?: number; // 1-19 for UAZAPI
  font?: number; // 0-8 for UAZAPI
  file?: string; // Media URL
  mimetype?: string;
  caption?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const UAZAPI_URL = Deno.env.get('UAZAPI_URL');
    
    if (!UAZAPI_URL) {
      console.error('UAZAPI_URL not configured');
      return new Response(
        JSON.stringify({ error: 'UAZAPI_URL not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: StatusRequest = await req.json();
    const { instanceKey, type, text, backgroundColor, font, file, mimetype, caption } = body;

    console.log('Received status request:', { type, hasText: !!text, hasFile: !!file, instanceKey: instanceKey?.substring(0, 10) + '...' });

    if (!instanceKey) {
      return new Response(
        JSON.stringify({ error: 'instanceKey is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!type) {
      return new Response(
        JSON.stringify({ error: 'type is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build payload based on status type
    let payload: Record<string, unknown> = {};

    switch (type) {
      case 'text':
        if (!text) {
          return new Response(
            JSON.stringify({ error: 'text is required for text status' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        payload = {
          type: 'text',
          text: text,
          background_color: backgroundColor || 1,
          font: font || 0,
        };
        break;

      case 'image':
        if (!file) {
          return new Response(
            JSON.stringify({ error: 'file URL is required for image status' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        payload = {
          type: 'image',
          file: file,
          text: caption || '',
        };
        break;

      case 'video':
        if (!file) {
          return new Response(
            JSON.stringify({ error: 'file URL is required for video status' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        payload = {
          type: 'video',
          file: file,
          mimetype: mimetype || 'video/mp4',
          text: caption || '',
        };
        break;

      case 'audio':
        if (!file) {
          return new Response(
            JSON.stringify({ error: 'file URL is required for audio status' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        payload = {
          type: 'audio',
          file: file,
        };
        break;

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid status type' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    console.log('Sending status to UAZAPI:', { type, payload: { ...payload, file: payload.file ? '[URL]' : undefined } });

    // Send to UAZAPI
    const endpoint = `${UAZAPI_URL}/send/status`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': instanceKey,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log('UAZAPI response:', response.status, responseText);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    if (!response.ok) {
      console.error('UAZAPI error:', response.status, responseData);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to send status', 
          details: responseData,
          status: response.status 
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Status sent successfully');
    return new Response(
      JSON.stringify({ 
        success: true, 
        data: responseData 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error in send-whatsapp-status:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
