// WhatsApp Instances Edge Function v9 - Init on Create
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
};

/**
 * Format phone number for WhatsApp API - supports international numbers
 */
function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/[^\d]/g, '');
  
  if (cleaned.length >= 12) return cleaned;
  
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    const areaCode = cleaned.substring(1, 4);
    if (!areaCode.startsWith('0') && !areaCode.startsWith('1')) {
      return cleaned;
    }
  }
  
  const internationalPrefixes = ['44', '351', '54', '56', '57', '58', '34', '33', '49', '39'];
  for (const prefix of internationalPrefixes) {
    if (cleaned.startsWith(prefix) && cleaned.length >= 10 + prefix.length - 1) {
      return cleaned;
    }
  }
  
  if (!cleaned.startsWith('55')) {
    cleaned = '55' + cleaned;
  }
  
  return cleaned;
}

serve(async (req: Request): Promise<Response> => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] === WhatsApp Instances Function v9 ===`);
  console.log(`[${timestamp}] Method:`, req.method);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const uazapiUrl = Deno.env.get("UAZAPI_URL") || "https://zynk2.uazapi.com";
    const uazapiAdminToken = Deno.env.get("UAZAPI_TOKEN") || "";

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Missing Supabase configuration");
    }

    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("User ID:", user.id);

    // Parse request
    let action = "";
    let entityId = "";
    let body: Record<string, unknown> = {};

    if (req.method !== "GET") {
      try {
        body = await req.json();
        action = (body.action as string) || "";
        entityId = (body.instanceId as string) || "";
      } catch {
        console.log("No body or invalid JSON");
      }
    }

    console.log("Action:", action, "Entity:", entityId);

    // CREATE - Initialize in UAZAPI immediately
    if (action === "create") {
      const instanceName = (body.name as string) || `instance_${Date.now()}`;
      const dailyLimit = (body.dailyLimit as number) || 200;

      let instanceKey: string | null = null;

      // Initialize in UAZAPI first (uses admintoken header)
      if (uazapiAdminToken) {
        try {
          console.log("Initializing instance in UAZAPI:", instanceName);
          console.log("UAZAPI URL:", uazapiUrl);
          
          const initResponse = await fetch(`${uazapiUrl}/instance/init`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "admintoken": uazapiAdminToken,
            },
            body: JSON.stringify({ 
              name: instanceName,
              token: crypto.randomUUID() // Generate a unique token for this instance
            }),
          });

          console.log("UAZAPI init response status:", initResponse.status);
          const initData = await initResponse.json();
          console.log("UAZAPI init response:", JSON.stringify(initData));

          if (initResponse.ok && initData) {
            instanceKey = initData.token || initData.key || initData.instance_key || null;
            console.log("Instance key obtained:", instanceKey ? "yes" : "no");
          } else {
            console.error("UAZAPI init failed:", initData);
          }
        } catch (e) {
          console.error("UAZAPI init error:", e);
        }
      } else {
        console.log("UAZAPI_TOKEN not configured");
      }

      // Insert in database with instance_key if obtained
      const { data: instance, error: dbError } = await supabase
        .from("whatsapp_instances")
        .insert({
          user_id: user.id,
          instance_name: instanceName,
          status: "disconnected",
          daily_limit: dailyLimit,
          instance_key: instanceKey,
        })
        .select()
        .single();

      if (dbError) {
        console.error("Database error:", dbError);
        throw new Error(`Database error: ${dbError.message}`);
      }

      console.log("Instance created in DB:", instance.id, "with UAZAPI key:", !!instanceKey);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          instance,
          uazapiInitialized: !!instanceKey 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // QRCODE - POST /instance/connect + GET /instance/status
    if (action === "qrcode" && entityId) {
      const { data: instance, error } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("id", entityId)
        .single();

      if (error || !instance) {
        return new Response(
          JSON.stringify({ error: "Instance not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // If no instance_key, we need to init the instance first via UAZAPI
      if (!instance.instance_key && uazapiAdminToken) {
        try {
          console.log("Initializing instance via UAZAPI (late init)...");
          const initResponse = await fetch(`${uazapiUrl}/instance/init`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "admintoken": uazapiAdminToken,
            },
            body: JSON.stringify({ 
              name: instance.instance_name,
              token: crypto.randomUUID()
            }),
          });

          if (initResponse.ok) {
            const initData = await initResponse.json();
            console.log("UAZAPI init response:", initData);

            const newInstanceKey = initData.token || initData.key || initData.instance_key;
            if (newInstanceKey) {
              await supabase
                .from("whatsapp_instances")
                .update({ instance_key: newInstanceKey })
                .eq("id", entityId);
              
              instance.instance_key = newInstanceKey;
            }
          }
        } catch (e) {
          console.error("UAZAPI init error:", e);
        }
      }

      // Fetch fresh instance data
      const { data: updatedInstance } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("id", entityId)
        .single();

      const activeInstanceKey = instance.instance_key || updatedInstance?.instance_key;
      if (activeInstanceKey) {
        try {
          // Step 1: POST /instance/connect to initiate connection and get QR code
          console.log("Calling POST /instance/connect to get QR code...");
          const connectResponse = await fetch(`${uazapiUrl}/instance/connect`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "token": activeInstanceKey,
            },
          });

          console.log("Connect response status:", connectResponse.status);
          
          if (connectResponse.ok) {
            const connectData = await connectResponse.json();
            console.log("Connect response:", JSON.stringify(connectData));

            // QR code is in instance.qrcode field
            const qrCode = connectData.instance?.qrcode;
            if (qrCode) {
              await supabase
                .from("whatsapp_instances")
                .update({ qr_code: qrCode, status: "connecting" })
                .eq("id", entityId);

              return new Response(
                JSON.stringify({ success: true, qrcode: qrCode }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          }

          // Step 2: Fallback - GET /instance/status to get updated QR code
          console.log("Fetching GET /instance/status for QR code...");
          const statusResponse = await fetch(`${uazapiUrl}/instance/status`, {
            headers: { "token": activeInstanceKey },
          });

          console.log("Status response status:", statusResponse.status);

          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            console.log("Status response:", JSON.stringify(statusData));

            const qrCode = statusData.instance?.qrcode;
            if (qrCode) {
              await supabase
                .from("whatsapp_instances")
                .update({ qr_code: qrCode, status: "connecting" })
                .eq("id", entityId);

              return new Response(
                JSON.stringify({ success: true, qrcode: qrCode }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          }
        } catch (e) {
          console.error("UAZAPI QR error:", e);
        }
      }

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Could not retrieve QR code. Check UAZAPI configuration.",
          instance: updatedInstance 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PAIRCODE - Connect via pairing code
    if (action === "paircode" && entityId) {
      const phoneNumber = body.phoneNumber as string;
      
      if (!phoneNumber) {
        return new Response(
          JSON.stringify({ error: "Número de telefone obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: instance, error } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("id", entityId)
        .single();

      if (error || !instance) {
        return new Response(
          JSON.stringify({ error: "Instance not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!instance.instance_key) {
        return new Response(
          JSON.stringify({ error: "Instância não inicializada. Tente gerar o QR Code primeiro." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        // Clean phone number - remove non-digits and ensure proper format
        const cleanPhone = phoneNumber.replace(/\D/g, '');
        console.log("Requesting pairing code for phone:", cleanPhone);
        
        // Method 1: POST /session/pairphone (ZuckZapGo/WuzAPI compatible)
        console.log("Trying POST /session/pairphone...");
        const pairPhoneResponse = await fetch(`${uazapiUrl}/session/pairphone`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "token": instance.instance_key,
          },
          body: JSON.stringify({ Phone: cleanPhone }),
        });
        
        console.log("pairphone response status:", pairPhoneResponse.status);
        
        if (pairPhoneResponse.ok) {
          const pairData = await pairPhoneResponse.json();
          console.log("pairphone response:", JSON.stringify(pairData));
          
          const code = pairData.paircode || pairData.data?.paircode || pairData.code || pairData.data?.code;
          if (code) {
            await supabase
              .from("whatsapp_instances")
              .update({ status: "connecting" })
              .eq("id", entityId);

            return new Response(
              JSON.stringify({ success: true, paircode: code }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }

        // Method 2: POST /instance/paircode with phone in body (UAZAPI format)
        console.log("Trying POST /instance/paircode...");
        const instancePaircodeResponse = await fetch(`${uazapiUrl}/instance/paircode`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "token": instance.instance_key,
          },
          body: JSON.stringify({ phone: cleanPhone, number: cleanPhone }),
        });
        
        console.log("instance/paircode POST response status:", instancePaircodeResponse.status);
        
        if (instancePaircodeResponse.ok) {
          const pairData = await instancePaircodeResponse.json();
          console.log("instance/paircode POST response:", JSON.stringify(pairData));
          
          const code = pairData.paircode || pairData.code || pairData.instance?.paircode || pairData.data?.code;
          if (code) {
            await supabase
              .from("whatsapp_instances")
              .update({ status: "connecting" })
              .eq("id", entityId);

            return new Response(
              JSON.stringify({ success: true, paircode: code }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }

        // Method 3: POST /instance/connect with paircode mode
        console.log("Trying POST /instance/connect with paircode mode...");
        const connectResponse = await fetch(`${uazapiUrl}/instance/connect`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "token": instance.instance_key,
          },
          body: JSON.stringify({ 
            paircode: true,
            phone: cleanPhone,
            number: cleanPhone,
            mode: "paircode"
          }),
        });
        
        console.log("Connect with paircode response status:", connectResponse.status);
        
        if (connectResponse.ok) {
          const connectData = await connectResponse.json();
          console.log("Connect with paircode response:", JSON.stringify(connectData));
          
          const code = connectData.paircode || connectData.instance?.paircode || connectData.code || connectData.data?.paircode;
          if (code) {
            await supabase
              .from("whatsapp_instances")
              .update({ status: "connecting" })
              .eq("id", entityId);

            return new Response(
              JSON.stringify({ success: true, paircode: code }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }

        // Method 4: GET /instance/paircode/{phone} path format
        console.log("Trying GET /instance/paircode/{phone}...");
        const pairResponsePath = await fetch(`${uazapiUrl}/instance/paircode/${cleanPhone}`, {
          method: "GET",
          headers: {
            "token": instance.instance_key,
          },
        });

        console.log("Paircode path GET response status:", pairResponsePath.status);
        
        if (pairResponsePath.ok) {
          const pairData = await pairResponsePath.json();
          console.log("Paircode path GET response:", JSON.stringify(pairData));
          
          const code = pairData.paircode || pairData.code || pairData.instance?.paircode || pairData.data?.code;
          if (code) {
            await supabase
              .from("whatsapp_instances")
              .update({ status: "connecting" })
              .eq("id", entityId);

            return new Response(
              JSON.stringify({ success: true, paircode: code }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }

        // Method 5: Check current instance status for any available paircode
        console.log("Checking instance status for paircode...");
        const statusResponse = await fetch(`${uazapiUrl}/instance/status`, {
          headers: { "token": instance.instance_key },
        });
        
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          console.log("Status check for paircode:", JSON.stringify(statusData));
          
          const code = statusData.paircode || statusData.instance?.paircode || statusData.data?.paircode;
          if (code) {
            await supabase
              .from("whatsapp_instances")
              .update({ status: "connecting" })
              .eq("id", entityId);

            return new Response(
              JSON.stringify({ success: true, paircode: code }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }

        // If all fail, return helpful error
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Código de pareamento não disponível. A API pode não suportar este método de conexão.",
            hint: "Use o QR Code para conectar. O código de pareamento requer suporte específico da API."
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (e) {
        console.error("UAZAPI paircode error:", e);
        return new Response(
          JSON.stringify({ error: "Erro ao comunicar com UAZAPI", details: String(e) }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // STATUS - check instance status
    if (action === "status" && entityId) {
      const { data: instance, error } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("id", entityId)
        .single();

      if (error || !instance) {
        return new Response(
          JSON.stringify({ error: "Instance not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check UAZAPI status if we have instance_key
      if (instance.instance_key) {
        try {
          const statusResponse = await fetch(`${uazapiUrl}/instance/status`, {
            headers: { "token": instance.instance_key },
          });

          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            console.log("Status data from UAZAPI:", JSON.stringify(statusData));
            
            // Determine connection status from multiple indicators
            // UAZAPI returns: { instance: { status, owner, profileName }, status: { connected, loggedIn } }
            const isConnected = 
              statusData.status?.connected === true ||   // Direct flag
              statusData.status?.loggedIn === true ||    // Logged in flag
              (statusData.instance?.owner && statusData.instance?.profileName); // Has profile = connected
            
            // Map UAZAPI status to our status
            let newStatus = "disconnected";
            if (isConnected) {
              newStatus = "connected";
            } else if (statusData.instance?.status === "connecting" || statusData.instance?.qrcode) {
              newStatus = "connecting";
            }
            
            // Extract phone from owner field (format: 559180910280)
            const phoneConnected = statusData.instance?.owner || statusData.phone || null;
            const profileName = statusData.instance?.profileName || null;
            const profilePictureUrl = statusData.instance?.profilePicUrl || statusData.instance?.profilePictureUrl || null;
            
            console.log("Mapped status:", newStatus, "Phone:", phoneConnected, "Profile:", profileName, "Picture:", profilePictureUrl);
            
            // Update DB if status changed or new profile info
            if (newStatus !== instance.status || phoneConnected !== instance.phone_connected || profilePictureUrl !== instance.profile_picture_url || profileName !== instance.profile_name) {
              await supabase
                .from("whatsapp_instances")
                .update({ 
                  status: newStatus,
                  phone_connected: phoneConnected,
                  profile_picture_url: profilePictureUrl,
                  profile_name: profileName,
                  last_connected_at: newStatus === "connected" ? new Date().toISOString() : instance.last_connected_at
                })
                .eq("id", entityId);
            }

            // Configure webhook when instance becomes connected
            if (isConnected && instance.status !== "connected") {
              const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-inbox-webhook`;
              console.log("Configuring webhook URL in UAZAPI:", webhookUrl);
              
              try {
                const webhookResponse = await fetch(`${uazapiUrl}/webhook`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "token": instance.instance_key,
                  },
                  body: JSON.stringify({
                    webhookURL: webhookUrl,
                    events: ["messages", "status", "qrcode"]
                  }),
                });
                
                if (webhookResponse.ok) {
                  console.log("Webhook configured successfully in UAZAPI");
                } else {
                  const webhookError = await webhookResponse.text();
                  console.error("Failed to configure webhook:", webhookError);
                }
              } catch (webhookErr) {
                console.error("Error configuring webhook:", webhookErr);
              }
            }

            return new Response(
              JSON.stringify({ 
                success: true, 
                status: newStatus, 
                phone: phoneConnected,
                profileName: profileName,
                profilePictureUrl: profilePictureUrl
              }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } catch (e) {
          console.error("UAZAPI status error:", e);
        }
      }

      return new Response(
        JSON.stringify({ success: true, status: instance.status, instance }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // DISCONNECT
    if (action === "disconnect" && entityId) {
      const { data: instance } = await supabase
        .from("whatsapp_instances")
        .select("instance_key")
        .eq("id", entityId)
        .single();

      // Disconnect from UAZAPI if we have instance_key
      if (instance?.instance_key) {
        try {
          await fetch(`${uazapiUrl}/instance/logout`, {
            method: "POST",
            headers: { "token": instance.instance_key },
          });
        } catch (e) {
          console.error("UAZAPI disconnect error:", e);
        }
      }

      const { error } = await supabase
        .from("whatsapp_instances")
        .update({ status: "disconnected", last_connected_at: null, qr_code: null })
        .eq("id", entityId);

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // CONFIGURE-WEBHOOK - Manually configure webhook for an instance
    if (action === "configure-webhook" && entityId) {
      const { data: instance, error } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("id", entityId)
        .single();

      if (error || !instance) {
        return new Response(
          JSON.stringify({ error: "Instance not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!instance.instance_key) {
        return new Response(
          JSON.stringify({ error: "Instância não inicializada. Conecte a instância primeiro." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-inbox-webhook`;
      console.log("Configuring webhook URL in UAZAPI:", webhookUrl);

      try {
        // UAZAPI v2 webhook configuration format (based on docs.uazapi.com)
        const webhookPayload = {
          enabled: true,
          url: webhookUrl,
          events: ["messages", "connection", "messages_update", "presence"],
          excludeMessages: ["wasSentByApi", "isGroupNo"], // Prevent loops + ignore groups
          addUrlEvents: true,      // Include URLs in events
          addUrlTypesMessages: true // Include media type URLs
        };
        
        console.log("Webhook payload:", JSON.stringify(webhookPayload));
        
        const webhookResponse = await fetch(`${uazapiUrl}/webhook`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "token": instance.instance_key,
          },
          body: JSON.stringify(webhookPayload),
        });

        const webhookData = await webhookResponse.json().catch(() => null);
        console.log("Webhook response:", webhookResponse.status, JSON.stringify(webhookData));

        if (webhookResponse.ok) {
          return new Response(
            JSON.stringify({ 
              success: true, 
              webhookUrl,
              configured: true,
              message: "Webhook configurado com sucesso!"
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: "Falha ao configurar webhook na UAZAPI",
              details: webhookData
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch (webhookErr) {
        console.error("Error configuring webhook:", webhookErr);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Erro ao comunicar com UAZAPI",
            details: String(webhookErr)
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // DELETE
    if (action === "delete" && entityId) {
      const { data: instance } = await supabase
        .from("whatsapp_instances")
        .select("instance_key, instance_name")
        .eq("id", entityId)
        .single();

      console.log("Deleting instance:", entityId, "name:", instance?.instance_name, "key:", instance?.instance_key ? "exists" : "none");

      // Delete from UAZAPI - uses DELETE /instance with instance token
      if (instance?.instance_key) {
        try {
          console.log("Calling UAZAPI delete for instance with key:", instance.instance_key);
          const deleteResponse = await fetch(`${uazapiUrl}/instance`, {
            method: "DELETE",
            headers: { 
              "token": instance.instance_key 
            },
          });
          
          console.log("UAZAPI delete response status:", deleteResponse.status);
          const deleteData = await deleteResponse.json();
          console.log("UAZAPI delete response:", JSON.stringify(deleteData));
        } catch (e) {
          console.error("UAZAPI delete error:", e);
        }
      } else {
        console.log("Skipping UAZAPI delete - no instance key");
      }

      const { error } = await supabase
        .from("whatsapp_instances")
        .delete()
        .eq("id", entityId);

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // CHECK-NUMBER - Verify if numbers have WhatsApp
    if (action === "check-number" && entityId) {
      const phones = body.phones as string[];
      const fetchName = body.fetchName as boolean ?? false;
      
      if (!phones || !Array.isArray(phones) || phones.length === 0) {
        return new Response(
          JSON.stringify({ error: "Lista de telefones é obrigatória" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: instance, error } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("id", entityId)
        .single();

      if (error || !instance) {
        return new Response(
          JSON.stringify({ error: "Instance not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!instance.instance_key) {
        return new Response(
          JSON.stringify({ error: "Instância não inicializada" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (instance.status !== "connected") {
        return new Response(
          JSON.stringify({ error: "Instância não está conectada" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // UAZAPI v2 - /chat/check - batch verification
      const formattedPhones = phones.map((phone: string) => formatPhoneNumber(phone));
      
      console.log(`[check-number] Checking ${formattedPhones.length} numbers via /chat/check`);
      console.log(`[check-number] Numbers:`, formattedPhones.slice(0, 5), formattedPhones.length > 5 ? `... and ${formattedPhones.length - 5} more` : '');

      try {
        const checkResponse = await fetch(`${uazapiUrl}/chat/check`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "token": instance.instance_key,
          },
          body: JSON.stringify({ 
            numbers: formattedPhones 
          }),
        });

        const checkData = await checkResponse.json();
        console.log(`[check-number] API response status: ${checkResponse.status}`);
        console.log(`[check-number] API response:`, JSON.stringify(checkData).slice(0, 500));

        const results: Array<{ phone: string; exists: boolean; whatsappName?: string | null; error?: string }> = [];

        // Handle different response formats from UAZAPI
        if (Array.isArray(checkData)) {
          // Response is an array of results
          for (const item of checkData) {
            const phone = item.query || item.number || item.jid?.replace("@s.whatsapp.net", "") || item.phone;
            // UAZAPI returns isInWhatsapp field
            const exists = item.isInWhatsapp === true || item.exists === true || item.registered === true || item.isRegistered === true;
            results.push({
              phone,
              exists,
              whatsappName: fetchName && exists ? (item.name || item.pushName || item.verifiedName || null) : null,
            });
          }
        } else if (checkData.results && Array.isArray(checkData.results)) {
          // Response has "results" field
          for (const item of checkData.results) {
            const phone = item.query || item.number || item.jid?.replace("@s.whatsapp.net", "") || item.phone;
            const exists = item.isInWhatsapp === true || item.exists === true || item.registered === true || item.isRegistered === true;
            results.push({
              phone,
              exists,
              whatsappName: fetchName && exists ? (item.name || item.pushName || item.verifiedName || null) : null,
            });
          }
        } else if (checkData.data && Array.isArray(checkData.data)) {
          // Response has "data" field
          for (const item of checkData.data) {
            const phone = item.query || item.number || item.jid?.replace("@s.whatsapp.net", "") || item.phone;
            const exists = item.isInWhatsapp === true || item.exists === true || item.registered === true || item.isRegistered === true;
            results.push({
              phone,
              exists,
              whatsappName: fetchName && exists ? (item.name || item.pushName || item.verifiedName || null) : null,
            });
          }
        } else {
          // Unknown format - log and return error
          console.error("[check-number] Unknown response format:", JSON.stringify(checkData));
          
          // Try to process single result if it has the expected fields
          if (checkData.exists !== undefined || checkData.registered !== undefined) {
            const exists = checkData.exists === true || checkData.registered === true;
            results.push({
              phone: formattedPhones[0],
              exists,
              whatsappName: fetchName && exists ? (checkData.name || checkData.pushName || null) : null,
            });
          } else {
            // Mark all as unknown
            for (const phone of formattedPhones) {
              results.push({
                phone,
                exists: false,
                error: "Formato de resposta desconhecido da API"
              });
            }
          }
        }

        console.log(`[check-number] Processed ${results.length} results`);
        
        return new Response(
          JSON.stringify({ success: true, results }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (e) {
        console.error("[check-number] Error:", e);
        return new Response(
          JSON.stringify({ error: `Erro ao verificar números: ${String(e)}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // FETCH-AVATAR - Get contact profile picture
    if (action === "fetch-avatar") {
      const conversationId = body.conversationId as string;
      const phone = body.phone as string;

      if (!conversationId || !phone) {
        return new Response(
          JSON.stringify({ error: "conversationId and phone are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Use service role to bypass RLS for fetching conversation
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      const supabaseAdmin = createClient(supabaseUrl!, supabaseServiceKey!);

      // Get conversation first
      const { data: conversation, error: convError } = await supabaseAdmin
        .from("conversations")
        .select("id, instance_id, phone, contact_avatar")
        .eq("id", conversationId)
        .single();

      if (convError || !conversation) {
        console.error("[Avatar] Conversation not found:", convError);
        return new Response(
          JSON.stringify({ error: "Conversation not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get instance separately
      const { data: instance, error: instanceError } = await supabaseAdmin
        .from("whatsapp_instances")
        .select("id, instance_key, instance_name")
        .eq("id", conversation.instance_id)
        .single();

      if (instanceError || !instance?.instance_key) {
        console.error("[Avatar] Instance not found or not configured:", instanceError);
        return new Response(
          JSON.stringify({ error: "Instance not configured" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Format phone with international support
      const formattedPhone = formatPhoneNumber(phone);

      try {
        console.log(`[Avatar] Fetching avatar for: ${formattedPhone} via instance ${instance.instance_name}`);
        
        const avatarResponse = await fetch(`${uazapiUrl}/user/avatar`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "token": instance.instance_key,
          },
          body: JSON.stringify({
            Phone: formattedPhone,
            Preview: false
          }),
        });

        const avatarData = await avatarResponse.json();
        console.log("[Avatar] Response:", JSON.stringify(avatarData));

        const avatarUrl = avatarData.url || avatarData.URL || avatarData.imgUrl || avatarData.profilePicUrl || avatarData.avatar || null;

        if (avatarUrl) {
          // Update conversation with avatar using admin client
          await supabaseAdmin
            .from("conversations")
            .update({ contact_avatar: avatarUrl })
            .eq("id", conversationId);

          return new Response(
            JSON.stringify({ success: true, avatarUrl }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: false, error: "Avatar não encontrado" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (e) {
        console.error("[Avatar] Error:", e);
        return new Response(
          JSON.stringify({ error: String(e) }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // DELETE-CHAT - Delete conversation from UAZAPI and local database
    if (action === "delete-chat" && entityId) {
      const conversationId = entityId;
      const deleteFromWhatsApp = body.deleteFromWhatsApp === true;

      // Use admin client to bypass RLS
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      const supabaseAdmin = createClient(supabaseUrl!, supabaseServiceKey!);

      // Fetch conversation with phone number
      const { data: conversation, error: convError } = await supabaseAdmin
        .from("conversations")
        .select("id, phone, instance_id")
        .eq("id", conversationId)
        .single();

      if (convError || !conversation) {
        console.error("[Delete Chat] Conversation not found:", convError);
        return new Response(
          JSON.stringify({ error: "Conversa não encontrada" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[Delete Chat] Deleting conversation ${conversationId} for phone ${conversation.phone}`);

      // Fetch instance for API call
      const { data: instance } = await supabaseAdmin
        .from("whatsapp_instances")
        .select("id, instance_key")
        .eq("id", conversation.instance_id)
        .single();

      // Call UAZAPI /chat/delete if instance has key
      if (instance?.instance_key) {
        try {
          console.log(`[Delete Chat] Calling UAZAPI /chat/delete for phone: ${conversation.phone}`);
          
          const deleteResponse = await fetch(`${uazapiUrl}/chat/delete`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "token": instance.instance_key,
            },
            body: JSON.stringify({
              number: conversation.phone,
              deleteChatDB: true,
              deleteMessagesDB: true,
              deleteChatWhatsApp: deleteFromWhatsApp,
            }),
          });

          console.log("[Delete Chat] UAZAPI response status:", deleteResponse.status);
          const deleteData = await deleteResponse.json();
          console.log("[Delete Chat] UAZAPI response:", JSON.stringify(deleteData));
        } catch (e) {
          console.error("[Delete Chat] UAZAPI error:", e);
          // Continue to delete locally even if UAZAPI fails
        }
      } else {
        console.log("[Delete Chat] No instance key, skipping UAZAPI call");
      }

      // Delete conversation labels first (due to foreign key constraints)
      const { error: labelDeleteError } = await supabaseAdmin
        .from("conversation_labels")
        .delete()
        .eq("conversation_id", conversationId);

      if (labelDeleteError) {
        console.error("[Delete Chat] Error deleting labels:", labelDeleteError);
      }

      // Delete local messages
      const { error: msgDeleteError } = await supabaseAdmin
        .from("chat_inbox_messages")
        .delete()
        .eq("conversation_id", conversationId);

      if (msgDeleteError) {
        console.error("[Delete Chat] Error deleting messages:", msgDeleteError);
      }

      // Delete local conversation
      const { error: convDeleteError } = await supabaseAdmin
        .from("conversations")
        .delete()
        .eq("id", conversationId);

      if (convDeleteError) {
        console.error("[Delete Chat] Error deleting conversation:", convDeleteError);
        return new Response(
          JSON.stringify({ error: "Erro ao deletar conversa", details: convDeleteError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[Delete Chat] Successfully deleted conversation ${conversationId}`);

      return new Response(
        JSON.stringify({ success: true, message: "Conversa deletada com sucesso" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // BLOCK/UNBLOCK CONTACT - Uses UAZAPI /chat/block endpoint
    if (action === "block_contact") {
      const conversationId = body.conversationId as string;
      const shouldBlock = body.block as boolean;

      if (!conversationId) {
        return new Response(
          JSON.stringify({ error: "conversationId é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[Block Contact] ${shouldBlock ? 'Blocking' : 'Unblocking'} contact for conversation: ${conversationId}`);

      // Create admin client
      const supabaseAdmin = createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      // Fetch conversation to get phone and instance
      const { data: conversation, error: convError } = await supabaseAdmin
        .from("conversations")
        .select("id, phone, instance_id")
        .eq("id", conversationId)
        .single();

      if (convError || !conversation) {
        console.error("[Block Contact] Conversation not found:", convError);
        return new Response(
          JSON.stringify({ error: "Conversa não encontrada" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[Block Contact] Found conversation - Phone: ${conversation.phone}, Instance: ${conversation.instance_id}`);

      // Get instance to find instance_key
      const { data: instance, error: instError } = await supabaseAdmin
        .from("whatsapp_instances")
        .select("id, instance_key")
        .eq("id", conversation.instance_id)
        .single();

      if (instError || !instance) {
        console.error("[Block Contact] Instance not found:", instError);
        return new Response(
          JSON.stringify({ error: "Instância não encontrada" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!instance.instance_key) {
        return new Response(
          JSON.stringify({ error: "Instância sem chave de API configurada" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Call UAZAPI /chat/block endpoint
      try {
        console.log(`[Block Contact] Calling UAZAPI /chat/block for ${conversation.phone}, block=${shouldBlock}`);
        
        const blockResponse = await fetch(`${uazapiUrl}/chat/block`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "token": instance.instance_key,
          },
          body: JSON.stringify({
            number: conversation.phone,
            block: shouldBlock,
          }),
        });

        console.log("[Block Contact] UAZAPI response status:", blockResponse.status);
        const blockData = await blockResponse.json();
        console.log("[Block Contact] UAZAPI response:", JSON.stringify(blockData));

        if (!blockResponse.ok) {
          return new Response(
            JSON.stringify({ 
              error: `Erro ao ${shouldBlock ? 'bloquear' : 'desbloquear'} contato`, 
              details: blockData 
            }),
            { status: blockResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Update conversation metadata with blocked status
        const { error: updateError } = await supabaseAdmin
          .from("conversations")
          .update({
            metadata: {
              is_blocked: shouldBlock,
              blocked_at: shouldBlock ? new Date().toISOString() : null,
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", conversationId);

        if (updateError) {
          console.error("[Block Contact] Error updating conversation metadata:", updateError);
        }

        console.log(`[Block Contact] Successfully ${shouldBlock ? 'blocked' : 'unblocked'} contact`);

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: shouldBlock ? "Contato bloqueado com sucesso" : "Contato desbloqueado com sucesso",
            blocked: shouldBlock
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (e) {
        console.error("[Block Contact] UAZAPI error:", e);
        return new Response(
          JSON.stringify({ error: `Erro ao ${shouldBlock ? 'bloquear' : 'desbloquear'} contato: ${String(e)}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // LIST BLOCKED CONTACTS - Uses UAZAPI GET /chat/block endpoint
    if (action === "list_blocked") {
      const instanceId = body.instanceId as string;

      if (!instanceId) {
        return new Response(
          JSON.stringify({ error: "instanceId é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[List Blocked] Fetching blocked contacts for instance: ${instanceId}`);

      // Get instance to find instance_key
      const { data: instance, error: instError } = await supabase
        .from("whatsapp_instances")
        .select("id, instance_key, instance_name")
        .eq("id", instanceId)
        .eq("user_id", user.id)
        .single();

      if (instError || !instance) {
        console.error("[List Blocked] Instance not found:", instError);
        return new Response(
          JSON.stringify({ error: "Instância não encontrada" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!instance.instance_key) {
        return new Response(
          JSON.stringify({ error: "Instância sem chave de API configurada" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Call UAZAPI GET /chat/block endpoint
      try {
        console.log(`[List Blocked] Calling UAZAPI GET /chat/block`);
        
        const listResponse = await fetch(`${uazapiUrl}/chat/block`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "token": instance.instance_key,
          },
        });

        console.log("[List Blocked] UAZAPI response status:", listResponse.status);
        const listData = await listResponse.json();
        console.log("[List Blocked] UAZAPI response:", JSON.stringify(listData));

        if (!listResponse.ok) {
          return new Response(
            JSON.stringify({ 
              error: "Erro ao listar contatos bloqueados", 
              details: listData 
            }),
            { status: listResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Parse blocked contacts - UAZAPI may return different formats
        let blockedContacts: string[] = [];
        if (Array.isArray(listData)) {
          blockedContacts = listData;
        } else if (listData.blocked) {
          blockedContacts = listData.blocked;
        } else if (listData.contacts) {
          blockedContacts = listData.contacts;
        } else if (listData.numbers) {
          blockedContacts = listData.numbers;
        }

        // Clean phone numbers (remove @s.whatsapp.net suffix)
        blockedContacts = blockedContacts.map((phone: string) => 
          phone.replace('@s.whatsapp.net', '').replace('@g.us', '')
        );

        console.log(`[List Blocked] Found ${blockedContacts.length} blocked contacts`);

        return new Response(
          JSON.stringify({ 
            success: true, 
            blocked: blockedContacts,
            instance: {
              id: instance.id,
              name: instance.instance_name
            }
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (e) {
        console.error("[List Blocked] UAZAPI error:", e);
        return new Response(
          JSON.stringify({ error: `Erro ao listar contatos bloqueados: ${String(e)}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // UNBLOCK CONTACT BY PHONE - Direct unblock without conversation
    if (action === "unblock_contact") {
      const instanceId = body.instanceId as string;
      const phone = body.phone as string;

      if (!instanceId || !phone) {
        return new Response(
          JSON.stringify({ error: "instanceId e phone são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[Unblock Contact] Unblocking ${phone} for instance: ${instanceId}`);

      // Get instance to find instance_key
      const { data: instance, error: instError } = await supabase
        .from("whatsapp_instances")
        .select("id, instance_key")
        .eq("id", instanceId)
        .eq("user_id", user.id)
        .single();

      if (instError || !instance) {
        return new Response(
          JSON.stringify({ error: "Instância não encontrada" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!instance.instance_key) {
        return new Response(
          JSON.stringify({ error: "Instância sem chave de API configurada" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Call UAZAPI /chat/block with block=false
      try {
        const unblockResponse = await fetch(`${uazapiUrl}/chat/block`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "token": instance.instance_key,
          },
          body: JSON.stringify({
            number: phone,
            block: false,
          }),
        });

        const unblockData = await unblockResponse.json();

        if (!unblockResponse.ok) {
          return new Response(
            JSON.stringify({ error: "Erro ao desbloquear contato", details: unblockData }),
            { status: unblockResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Also update any conversation with this phone
        const supabaseAdmin = createClient(
          supabaseUrl,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        await supabaseAdmin
          .from("conversations")
          .update({
            metadata: { is_blocked: false, blocked_at: null },
            updated_at: new Date().toISOString(),
          })
          .eq("phone", phone)
          .eq("instance_id", instanceId);

        return new Response(
          JSON.stringify({ success: true, message: "Contato desbloqueado com sucesso" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (e) {
        return new Response(
          JSON.stringify({ error: `Erro ao desbloquear contato: ${String(e)}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ========== LABEL MANAGEMENT ACTIONS ==========

    // GET_LABELS - Fetch all labels from WhatsApp
    if (action === "get_labels") {
      const instanceId = body.instanceId as string;

      if (!instanceId) {
        return new Response(
          JSON.stringify({ error: "instanceId é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[Get Labels] Fetching labels for instance: ${instanceId}`);

      const { data: instance, error: instError } = await supabase
        .from("whatsapp_instances")
        .select("id, instance_key, instance_name")
        .eq("id", instanceId)
        .eq("user_id", user.id)
        .single();

      if (instError || !instance) {
        return new Response(
          JSON.stringify({ error: "Instância não encontrada" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!instance.instance_key) {
        return new Response(
          JSON.stringify({ error: "Instância sem chave de API configurada" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        const labelsResponse = await fetch(`${uazapiUrl}/labels`, {
          method: "GET",
          headers: {
            "token": instance.instance_key,
            "Accept": "application/json",
          },
        });

        console.log(`[Get Labels] Response status: ${labelsResponse.status}`);
        const labelsData = await labelsResponse.json();
        console.log(`[Get Labels] Response:`, JSON.stringify(labelsData));

        if (!labelsResponse.ok) {
          return new Response(
            JSON.stringify({ error: "Erro ao buscar etiquetas", details: labelsData }),
            { status: labelsResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Parse the response - UAZAPI returns array of labels
        let labels = [];
        if (Array.isArray(labelsData)) {
          labels = labelsData;
        } else if (labelsData.labels) {
          labels = labelsData.labels;
        } else if (labelsData.data) {
          labels = labelsData.data;
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            labels,
            instance: {
              id: instance.id,
              name: instance.instance_name
            }
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (e) {
        console.error("[Get Labels] Error:", e);
        return new Response(
          JSON.stringify({ error: `Erro ao buscar etiquetas: ${String(e)}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // CREATE_LABEL - Create a new label via /label/edit
    if (action === "create_label") {
      const instanceId = body.instanceId as string;
      const labelName = body.name as string;
      const colorCode = body.colorCode as number ?? 0;

      if (!instanceId || !labelName) {
        return new Response(
          JSON.stringify({ error: "instanceId e name são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[Create Label] Creating label "${labelName}" for instance: ${instanceId}`);

      const { data: instance, error: instError } = await supabase
        .from("whatsapp_instances")
        .select("id, instance_key")
        .eq("id", instanceId)
        .eq("user_id", user.id)
        .single();

      if (instError || !instance) {
        return new Response(
          JSON.stringify({ error: "Instância não encontrada" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!instance.instance_key) {
        return new Response(
          JSON.stringify({ error: "Instância sem chave de API configurada" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        const createResponse = await fetch(`${uazapiUrl}/label/edit`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "token": instance.instance_key,
          },
          body: JSON.stringify({
            labelid: "", // Empty = create new
            name: labelName,
            color: colorCode,
            delete: false,
          }),
        });

        console.log(`[Create Label] Response status: ${createResponse.status}`);
        const createData = await createResponse.json();
        console.log(`[Create Label] Response:`, JSON.stringify(createData));

        if (!createResponse.ok) {
          return new Response(
            JSON.stringify({ error: "Erro ao criar etiqueta", details: createData }),
            { status: createResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Extract the created label ID
        const labelId = createData.id || createData.labelid || createData.label?.id;

        return new Response(
          JSON.stringify({ 
            success: true, 
            labelId,
            message: "Etiqueta criada com sucesso"
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (e) {
        console.error("[Create Label] Error:", e);
        return new Response(
          JSON.stringify({ error: `Erro ao criar etiqueta: ${String(e)}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // DELETE_LABEL - Delete a label via /label/edit with delete=true
    if (action === "delete_label") {
      const instanceId = body.instanceId as string;
      const labelId = body.labelId as string;

      if (!instanceId || !labelId) {
        return new Response(
          JSON.stringify({ error: "instanceId e labelId são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[Delete Label] Deleting label ${labelId} for instance: ${instanceId}`);

      const { data: instance, error: instError } = await supabase
        .from("whatsapp_instances")
        .select("id, instance_key")
        .eq("id", instanceId)
        .eq("user_id", user.id)
        .single();

      if (instError || !instance) {
        return new Response(
          JSON.stringify({ error: "Instância não encontrada" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!instance.instance_key) {
        return new Response(
          JSON.stringify({ error: "Instância sem chave de API configurada" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        const deleteResponse = await fetch(`${uazapiUrl}/label/edit`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "token": instance.instance_key,
          },
          body: JSON.stringify({
            labelid: labelId,
            delete: true,
          }),
        });

        console.log(`[Delete Label] Response status: ${deleteResponse.status}`);
        const deleteData = await deleteResponse.json();
        console.log(`[Delete Label] Response:`, JSON.stringify(deleteData));

        if (!deleteResponse.ok) {
          return new Response(
            JSON.stringify({ error: "Erro ao excluir etiqueta", details: deleteData }),
            { status: deleteResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, message: "Etiqueta excluída com sucesso" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (e) {
        console.error("[Delete Label] Error:", e);
        return new Response(
          JSON.stringify({ error: `Erro ao excluir etiqueta: ${String(e)}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ASSIGN_CHAT_LABELS - Add/remove labels from a chat via /chat/labels
    if (action === "assign_chat_labels") {
      const instanceId = body.instanceId as string;
      const phone = body.phone as string;
      const addLabelIds = body.addLabelIds as string[] | string | undefined;
      const removeLabelIds = body.removeLabelIds as string[] | string | undefined;

      if (!instanceId || !phone) {
        return new Response(
          JSON.stringify({ error: "instanceId e phone são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[Assign Labels] Phone: ${phone}, Add: ${addLabelIds}, Remove: ${removeLabelIds}`);

      const { data: instance, error: instError } = await supabase
        .from("whatsapp_instances")
        .select("id, instance_key")
        .eq("id", instanceId)
        .eq("user_id", user.id)
        .single();

      if (instError || !instance) {
        return new Response(
          JSON.stringify({ error: "Instância não encontrada" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!instance.instance_key) {
        return new Response(
          JSON.stringify({ error: "Instância sem chave de API configurada" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        // Build request body
        const requestBody: Record<string, unknown> = { number: phone };
        
        if (addLabelIds) {
          requestBody.add_labelid = Array.isArray(addLabelIds) ? addLabelIds : [addLabelIds];
        }
        if (removeLabelIds) {
          requestBody.remove_labelid = Array.isArray(removeLabelIds) ? removeLabelIds : [removeLabelIds];
        }

        console.log(`[Assign Labels] Request body:`, JSON.stringify(requestBody));

        const assignResponse = await fetch(`${uazapiUrl}/chat/labels`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "token": instance.instance_key,
          },
          body: JSON.stringify(requestBody),
        });

        console.log(`[Assign Labels] Response status: ${assignResponse.status}`);
        const assignData = await assignResponse.json();
        console.log(`[Assign Labels] Response:`, JSON.stringify(assignData));

        if (!assignResponse.ok) {
          return new Response(
            JSON.stringify({ error: "Erro ao atribuir etiquetas", details: assignData }),
            { status: assignResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, message: "Etiquetas atualizadas com sucesso" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (e) {
        console.error("[Assign Labels] Error:", e);
        return new Response(
          JSON.stringify({ error: `Erro ao atribuir etiquetas: ${String(e)}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // DELETE MESSAGE - Remove message locally and optionally from WhatsApp
    if (action === "delete_message") {
      const messageId = body.messageId as string;
      const deleteForEveryone = body.deleteForEveryone as boolean || false;
      const whatsappId = body.whatsappId as string; // ID from metadata.whatsapp_id
      const instanceId = body.instanceId as string;

      if (!messageId) {
        return new Response(
          JSON.stringify({ error: "ID da mensagem obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[Delete Message] messageId: ${messageId}, deleteForEveryone: ${deleteForEveryone}, whatsappId: ${whatsappId}`);

      // Get instance for API call if deleting for everyone
      if (deleteForEveryone && whatsappId && instanceId) {
        const { data: instance } = await supabase
          .from("whatsapp_instances")
          .select("instance_key")
          .eq("id", instanceId)
          .single();

        if (instance?.instance_key) {
          try {
            // Call UAZAPI /message/delete endpoint
            console.log(`[Delete Message] Calling UAZAPI to delete message: ${whatsappId}`);
            const deleteResponse = await fetch(`${uazapiUrl}/message/delete`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "token": instance.instance_key,
              },
              body: JSON.stringify({ id: whatsappId }),
            });

            console.log(`[Delete Message] UAZAPI response status: ${deleteResponse.status}`);
            const deleteData = await deleteResponse.json();
            console.log(`[Delete Message] UAZAPI response:`, JSON.stringify(deleteData));
            // Even if UAZAPI fails, we still delete locally
          } catch (e) {
            console.error("[Delete Message] UAZAPI error:", e);
            // Continue with local deletion
          }
        }
      }

      // Update local database (soft delete with metadata)
      if (deleteForEveryone) {
        // Mark as deleted for everyone - keep record but clear content
        const { error: updateError } = await supabase
          .from("chat_inbox_messages")
          .update({
            content: "🚫 Mensagem apagada",
            media_url: null,
            media_type: null,
            metadata: {
              deleted: true,
              deleted_for_everyone: true,
              deleted_at: new Date().toISOString()
            }
          })
          .eq("id", messageId);

        if (updateError) {
          console.error("[Delete Message] DB update error:", updateError);
          throw new Error(`Erro ao apagar mensagem: ${updateError.message}`);
        }
      } else {
        // Delete only for current user - hard delete
        const { error: deleteError } = await supabase
          .from("chat_inbox_messages")
          .delete()
          .eq("id", messageId);

        if (deleteError) {
          console.error("[Delete Message] DB delete error:", deleteError);
          throw new Error(`Erro ao apagar mensagem: ${deleteError.message}`);
        }
      }

      console.log(`[Delete Message] ✓ Message deleted successfully`);

      return new Response(
        JSON.stringify({ success: true, deletedForEveryone: deleteForEveryone }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SAVE CONTACT - Add contact to WhatsApp agenda via UAZAPI
    if (action === "save_contact") {
      const conversationId = body.conversationId as string;
      const customName = body.name as string;

      if (!conversationId) {
        return new Response(
          JSON.stringify({ error: "ID da conversa obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[Save Contact] conversationId: ${conversationId}, name: ${customName}`);

      // Get conversation to find phone and instance
      const { data: conversation, error: convError } = await supabase
        .from("conversations")
        .select("phone, instance_id, contact_name")
        .eq("id", conversationId)
        .single();

      if (convError || !conversation) {
        return new Response(
          JSON.stringify({ error: "Conversa não encontrada" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get instance key
      const { data: instance } = await supabase
        .from("whatsapp_instances")
        .select("instance_key")
        .eq("id", conversation.instance_id)
        .single();

      if (!instance?.instance_key) {
        return new Response(
          JSON.stringify({ error: "Instância não conectada" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        // Call UAZAPI /contact/add
        const contactName = customName || conversation.contact_name || conversation.phone;
        console.log(`[Save Contact] Calling UAZAPI /contact/add for phone: ${conversation.phone}, name: ${contactName}`);
        
        const addResponse = await fetch(`${uazapiUrl}/contact/add`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "token": instance.instance_key,
          },
          body: JSON.stringify({
            phone: formatPhoneNumber(conversation.phone),
            name: contactName
          }),
        });

        console.log(`[Save Contact] UAZAPI response status: ${addResponse.status}`);
        const addData = await addResponse.json();
        console.log(`[Save Contact] UAZAPI response:`, JSON.stringify(addData));

        if (!addResponse.ok) {
          return new Response(
            JSON.stringify({ error: "Erro ao salvar contato", details: addData }),
            { status: addResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Also update the local contact_name if a custom name was provided
        if (customName) {
          await supabase
            .from("conversations")
            .update({ contact_name: customName })
            .eq("id", conversationId);
        }

        return new Response(
          JSON.stringify({ success: true, message: "Contato salvo na agenda!" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (e) {
        console.error("[Save Contact] Error:", e);
        return new Response(
          JSON.stringify({ error: `Erro ao salvar contato: ${String(e)}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // MAKE CALL - Initiate attention call via UAZAPI
    if (action === "make_call") {
      const phone = body.phone as string;
      const instanceKey = body.instanceKey as string;

      if (!phone || !instanceKey) {
        return new Response(
          JSON.stringify({ error: "phone e instanceKey obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[Make Call] phone: ${phone}, instanceKey: ${instanceKey.substring(0, 8)}...`);

      try {
        const formattedPhone = formatPhoneNumber(phone);
        
        const response = await fetch(`${uazapiUrl}/call/make`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "token": instanceKey,
          },
          body: JSON.stringify({ number: formattedPhone }),
        });

        console.log(`[Make Call] UAZAPI response status: ${response.status}`);
        const data = await response.json();
        console.log(`[Make Call] Response:`, JSON.stringify(data));

        if (response.ok) {
          return new Response(
            JSON.stringify({ success: true, data }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          return new Response(
            JSON.stringify({ success: false, error: data.message || "Falha ao fazer ligação" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch (e) {
        console.error("[Make Call] Error:", e);
        return new Response(
          JSON.stringify({ error: `Erro ao fazer ligação: ${String(e)}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // REJECT CALL - Reject incoming call via UAZAPI
    if (action === "reject_call") {
      const instanceKey = body.instanceKey as string;
      const phone = body.phone as string;
      const callId = body.callId as string;

      if (!instanceKey) {
        return new Response(
          JSON.stringify({ error: "instanceKey obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[Reject Call] instanceKey: ${instanceKey.substring(0, 8)}..., phone: ${phone || 'all'}`);

      try {
        const requestBody: Record<string, string> = {};
        if (phone) requestBody.number = formatPhoneNumber(phone);
        if (callId) requestBody.id = callId;
        
        const response = await fetch(`${uazapiUrl}/call/reject`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "token": instanceKey,
          },
          body: JSON.stringify(requestBody),
        });

        console.log(`[Reject Call] UAZAPI response status: ${response.status}`);
        const data = await response.json();
        console.log(`[Reject Call] Response:`, JSON.stringify(data));

        return new Response(
          JSON.stringify({ success: response.ok, data }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (e) {
        console.error("[Reject Call] Error:", e);
        return new Response(
          JSON.stringify({ error: `Erro ao rejeitar ligação: ${String(e)}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // RENAME CONTACT - Update contact name locally
    if (action === "rename_contact") {
      const conversationId = body.conversationId as string;
      const newName = body.name as string;

      if (!conversationId || !newName?.trim()) {
        return new Response(
          JSON.stringify({ error: "ID e nome do contato obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[Rename Contact] conversationId: ${conversationId}, newName: ${newName}`);

      const { error: updateError } = await supabase
        .from("conversations")
        .update({ contact_name: newName.trim() })
        .eq("id", conversationId);

      if (updateError) {
        console.error("[Rename Contact] Error:", updateError);
        return new Response(
          JSON.stringify({ error: `Erro ao renomear: ${updateError.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[Rename Contact] ✓ Contact renamed successfully`);

      return new Response(
        JSON.stringify({ success: true, message: "Nome atualizado com sucesso" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SEND MEDIA CAROUSEL - Rich carousel with images and structured buttons
    if (action === "send_carousel") {
      const phone = body.phone as string;
      const instanceKey = body.instanceKey as string;
      const text = body.text as string;
      const carousel = body.carousel as Array<{
        text: string;
        image?: string;
        video?: string;
        document?: string;
        filename?: string;
        buttons: Array<{
          id: string;
          text: string;
          type: "REPLY" | "URL" | "COPY" | "CALL";
        }>;
      }>;
      const delay = body.delay as number | undefined;

      if (!phone || !instanceKey || !text || !carousel?.length) {
        return new Response(
          JSON.stringify({ error: "phone, instanceKey, text e carousel são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[Send Carousel] phone: ${phone}, cards: ${carousel.length}`);

      const formattedPhone = formatPhoneNumber(phone);
      
      const requestBody: Record<string, unknown> = {
        number: formattedPhone,
        text: text,
        carousel: carousel,
        readchat: true
      };

      if (delay) requestBody.delay = delay;

      try {
        const response = await fetch(`${uazapiUrl}/send/carousel`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "token": instanceKey,
          },
          body: JSON.stringify(requestBody),
        });

        const data = await response.json();
        console.log(`[Send Carousel] Response:`, JSON.stringify(data));

        if (!response.ok) {
          return new Response(
            JSON.stringify({ success: false, error: data.error || "Erro ao enviar carrossel", data }),
            { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (e) {
        console.error("[Send Carousel] Error:", e);
        return new Response(
          JSON.stringify({ success: false, error: String(e) }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // SEND INTERACTIVE MENU - Buttons, List, Poll, Carousel
    if (action === "send_menu") {
      const phone = body.phone as string;
      const instanceKey = body.instanceKey as string;
      const menuType = body.menuType as "button" | "list" | "poll" | "carousel";
      const text = body.text as string;
      const choices = body.choices as string[];
      const footerText = body.footerText as string | undefined;
      const listButton = body.listButton as string | undefined;
      const selectableCount = body.selectableCount as number | undefined;
      const imageButton = body.imageButton as string | undefined;

      if (!phone || !instanceKey || !menuType || !text || !choices?.length) {
        return new Response(
          JSON.stringify({ error: "phone, instanceKey, menuType, text e choices são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[Send Menu] type: ${menuType}, phone: ${phone}, choices: ${choices.length}`);

      const formattedPhone = formatPhoneNumber(phone);
      
      const requestBody: Record<string, unknown> = {
        number: formattedPhone,
        type: menuType,
        text: text,
        choices: choices
      };

      if (footerText) requestBody.footerText = footerText;
      if (listButton && menuType === "list") requestBody.listButton = listButton;
      if (selectableCount && menuType === "poll") requestBody.selectableCount = selectableCount;
      if (imageButton) requestBody.imageButton = imageButton;

      try {
        const response = await fetch(`${uazapiUrl}/send/menu`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "token": instanceKey,
          },
          body: JSON.stringify(requestBody),
        });

        const data = await response.json();
        console.log(`[Send Menu] Response:`, JSON.stringify(data));

        if (!response.ok) {
          return new Response(
            JSON.stringify({ success: false, error: data.error || "Erro ao enviar menu", data }),
            { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (e) {
        console.error("[Send Menu] Error:", e);
        return new Response(
          JSON.stringify({ success: false, error: String(e) }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // LIST instances
    if (action === "list" || !action) {
      const { data: instances, error } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, instances }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Function error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
