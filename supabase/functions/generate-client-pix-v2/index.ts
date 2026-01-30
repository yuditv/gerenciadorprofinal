// Generate PIX for client using USER'S Mercado Pago credentials
 import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
 };

  type MpErrorShape = {
    message?: string;
    blocked_by?: string;
    status?: number;
    code?: string;
  };

  async function fetchMercadoPago(url: string, init: RequestInit) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      const raw = await res.text();
      let parsed: any = null;
      try {
        parsed = raw ? JSON.parse(raw) : null;
      } catch {
        parsed = null;
      }
      return { res, raw, parsed };
    } finally {
      clearTimeout(timeout);
    }
  }

  function isPolicyAgentBlock(payload: any): payload is MpErrorShape {
    return Boolean(
      payload &&
        typeof payload === "object" &&
        (payload as any).blocked_by === "PolicyAgent" &&
        (payload as any).code === "PA_UNAUTHORIZED_RESULT_FROM_POLICIES",
    );
  }

  function asDataUriPng(base64OrDataUri: string | null | undefined) {
    if (!base64OrDataUri) return null;
    if (base64OrDataUri.startsWith("data:image")) return base64OrDataUri;
    return `data:image/png;base64,${base64OrDataUri}`;
  }
 
 serve(async (req: Request) => {
   if (req.method === "OPTIONS") {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
     const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
     
     // Authenticate user via JWT
     const authHeader = req.headers.get("Authorization");
     if (!authHeader) {
       return new Response(
         JSON.stringify({ success: false, error: "Missing authorization" }),
         { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     const supabase = createClient(supabaseUrl, supabaseServiceKey);
     const { data: { user }, error: authError } = await supabase.auth.getUser(
       authHeader.replace("Bearer ", "")
     );
 
     if (authError || !user) {
       return new Response(
         JSON.stringify({ success: false, error: "Unauthorized" }),
         { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
      const {
        client_id,
        client_phone,
        plan_name,
        expected_plan,
        expected_plan_label,
        amount,
        duration_days,
        description,
        conversation_id,
        instance_id,
      } = await req.json();
 
     if (!client_phone || !plan_name || !amount) {
       return new Response(
         JSON.stringify({ success: false, error: "Missing required fields" }),
         { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     console.log(`[generate-client-pix-v2] User ${user.id} generating PIX for ${client_phone}, R$${amount}`);
 
     // Fetch user's Mercado Pago credentials
     const { data: credentials, error: credError } = await supabase
       .from("user_payment_credentials")
       .select("mercado_pago_access_token_enc")
       .eq("user_id", user.id)
       .maybeSingle();
 
     if (credError) {
       console.error("Error fetching credentials:", credError);
       return new Response(
         JSON.stringify({ success: false, error: "Erro ao buscar credenciais" }),
         { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     if (!credentials?.mercado_pago_access_token_enc) {
       return new Response(
         JSON.stringify({ 
           success: false, 
           error: "Você precisa configurar suas credenciais do Mercado Pago em Configurações > Credenciais" 
         }),
         { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     const accessToken = credentials.mercado_pago_access_token_enc; // Decrypt if needed
 
     // Create PIX payment via Mercado Pago
     const paymentData = {
       transaction_amount: Number(amount),
       description: description || `Pagamento - ${plan_name}`,
       payment_method_id: "pix",
       payer: {
         email: "cliente@email.com", // Could extract from client data if available
       },
       notification_url: `${supabaseUrl}/functions/v1/mercado-pago-webhook`,
     };
 
     console.log("[generate-client-pix-v2] Creating Mercado Pago payment...");
 
      const { res: mpResponse, parsed: mpData, raw } = await fetchMercadoPago(
        "https://api.mercadopago.com/v1/payments",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": "gerenciadorpro/1.0 (supabase-edge)",
            "X-Idempotency-Key": `${user.id}-clientpix-${Date.now()}`,
          },
          body: JSON.stringify(paymentData),
        },
      );

      if (!mpResponse.ok) {
        if (isPolicyAgentBlock(mpData)) {
          console.error("[generate-client-pix-v2] MP blocked by PolicyAgent", mpData);
          return new Response(
            JSON.stringify({
              success: false,
              error:
                "Bloqueio de rede (PolicyAgent): o Supabase não conseguiu acessar a API do Mercado Pago.",
            }),
            { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        console.error("[generate-client-pix-v2] Mercado Pago error:", mpData ?? raw?.slice?.(0, 500));
       return new Response(
         JSON.stringify({ 
           success: false, 
           error: mpData.message || "Erro ao gerar PIX no Mercado Pago" 
         }),
         { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     const pixCode = mpData.point_of_interaction?.transaction_data?.qr_code;
      const pixQRCode = asDataUriPng(mpData.point_of_interaction?.transaction_data?.qr_code_base64);
     const externalId = String(mpData.id);
 
     console.log(`[generate-client-pix-v2] Payment created: ${externalId}`);
 
     // Store in client_pix_payments
     const { data: payment, error: paymentError } = await supabase
       .from("client_pix_payments")
       .insert({
         user_id: user.id,
          client_id: client_id || null,
         client_phone,
         plan_name,
         amount: Number(amount),
         duration_days: duration_days || null,
         description: description || null,
         conversation_id: conversation_id || null,
         instance_id: instance_id || null,
          expected_plan: expected_plan || null,
          expected_plan_label: expected_plan_label || null,
         external_id: externalId,
         pix_code: pixCode,
         pix_qr_code: pixQRCode,
         status: "pending",
         expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min
       })
       .select()
       .single();
 
     if (paymentError) {
       console.error("[generate-client-pix-v2] Error storing payment:", paymentError);
       return new Response(
         JSON.stringify({ success: false, error: "Erro ao salvar pagamento" }),
         { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     return new Response(
       JSON.stringify({
         success: true,
         payment: {
           id: payment.id,
           pix_code: pixCode,
           pix_qr_code: pixQRCode,
           amount: Number(amount),
           expires_at: payment.expires_at,
         },
       }),
       { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
 
   } catch (error) {
     console.error("[generate-client-pix-v2] Function error:", error);
     return new Response(
       JSON.stringify({ success: false, error: String(error) }),
       { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   }
 });