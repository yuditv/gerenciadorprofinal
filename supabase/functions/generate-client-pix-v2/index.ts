 // Generate PIX for client using USER'S Mercado Pago credentials
 import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
 };
 
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
 
     const { client_phone, plan_name, amount, duration_days, description, conversation_id, instance_id } = await req.json();
 
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
 
     const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
       method: "POST",
       headers: {
         "Authorization": `Bearer ${accessToken}`,
         "Content-Type": "application/json",
       },
       body: JSON.stringify(paymentData),
     });
 
     const mpData = await mpResponse.json();
 
     if (!mpResponse.ok) {
       console.error("[generate-client-pix-v2] Mercado Pago error:", mpData);
       return new Response(
         JSON.stringify({ 
           success: false, 
           error: mpData.message || "Erro ao gerar PIX no Mercado Pago" 
         }),
         { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     const pixCode = mpData.point_of_interaction?.transaction_data?.qr_code;
     const pixQRCode = mpData.point_of_interaction?.transaction_data?.qr_code_base64;
     const externalId = String(mpData.id);
 
     console.log(`[generate-client-pix-v2] Payment created: ${externalId}`);
 
     // Store in client_pix_payments
     const { data: payment, error: paymentError } = await supabase
       .from("client_pix_payments")
       .insert({
         user_id: user.id,
         client_phone,
         plan_name,
         amount: Number(amount),
         duration_days: duration_days || null,
         description: description || null,
         conversation_id: conversation_id || null,
         instance_id: instance_id || null,
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