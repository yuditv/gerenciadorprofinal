import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INFINITEPAY_HANDLE = Deno.env.get("INFINITEPAY_HANDLE") || "";
const INFINITEPAY_API = "https://api.infinitepay.io/invoices/public/checkout";

type Action = "create" | "check";

type CreateBody = { action: "create"; amount_brl: number };
type CheckBody = { action: "check"; topup_id: string };
type RequestBody = CreateBody | CheckBody;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function requireUser(supabase: ReturnType<typeof createClient>, req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) throw new Error("Unauthorized");
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new Error("Unauthorized");
  return user;
}

async function creditWalletIfNeeded(
  supabase: any,
  topup: { id: string; user_id: string; credits: number; status: string; amount_brl: number }
) {
  if (topup.status === "paid") {
    const { data: wallet } = await supabase
      .from("user_wallets")
      .select("credits")
      .eq("user_id", topup.user_id)
      .maybeSingle();
    return { alreadyCredited: true, walletCredits: Number(wallet?.credits ?? 0) };
  }

  const paidAt = new Date().toISOString();
  const { data: updatedTopup, error: updateErr } = await supabase
    .from("wallet_topups")
    .update({ status: "paid", paid_at: paidAt })
    .eq("id", topup.id)
    .select("*")
    .single();
  if (updateErr) throw updateErr;

  const { data: existingWallet } = await supabase
    .from("user_wallets")
    .select("credits")
    .eq("user_id", topup.user_id)
    .maybeSingle();

  const current = Number(existingWallet?.credits ?? 0);
  const nextCredits = Number((current + Number(topup.credits)).toFixed(2));

  const { error: walletErr } = await supabase
    .from("user_wallets")
    .upsert({ user_id: topup.user_id, credits: nextCredits }, { onConflict: "user_id" });
  if (walletErr) throw walletErr;

  const { error: ledgerErr } = await supabase.from("wallet_transactions").insert({
    user_id: topup.user_id,
    type: "topup",
    credits: Number(topup.credits),
    amount_brl: Number(topup.amount_brl),
    reference_type: "wallet_topup",
    reference_id: topup.id,
  });
  if (ledgerErr) throw ledgerErr;

  return { alreadyCredited: false, walletCredits: nextCredits, updatedTopup };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase: any = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const user = await requireUser(supabase as any, req);

    const body = (await req.json()) as RequestBody;
    if (!body?.action) return json({ error: "Ação inválida" }, 400);

    if (body.action === "create") {
      const amount = Number(body.amount_brl);
      if (!Number.isFinite(amount) || amount < 1) return json({ error: "Valor mínimo é R$ 1,00" }, 400);

      const handle = INFINITEPAY_HANDLE;
      if (!handle) return json({ error: "InfinitePay não configurado (handle ausente)" }, 500);

      const amountFixed = Number(amount.toFixed(2));
      const priceInCents = Math.round(amountFixed * 100);
      const orderNsu = crypto.randomUUID();
      const expirationDate = new Date(Date.now() + 30 * 60 * 1000);

      const checkoutPayload = {
        handle,
        items: [
          {
            quantity: 1,
            price: priceInCents,
            description: `Recarga de créditos (${amountFixed.toFixed(2)} BRL)`,
          },
        ],
        order_nsu: orderNsu,
        redirect_url: `${SUPABASE_URL.replace('.supabase.co', '')}/carteira`,
        webhook_url: `${SUPABASE_URL}/functions/v1/infinitepay-webhook`,
        customer: {
          email: user.email || "cliente@gerenciadorpro.com",
        },
      };

      console.log("[wallet-pix] Creating InfinitePay checkout...");

      const ipResponse = await fetch(`${INFINITEPAY_API}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checkoutPayload),
      });

      const ipData = await ipResponse.json();

      if (!ipResponse.ok) {
        console.error("[wallet-pix] InfinitePay error:", JSON.stringify(ipData));
        return json({ error: ipData?.message || "Erro ao criar checkout InfinitePay" }, 502);
      }

      const checkoutUrl = ipData.url || ipData.checkout_url || ipData.link;
      const infinitepaySlug = ipData.slug || ipData.invoice_slug || orderNsu;

      const { data: topup, error: topupErr } = await supabase
        .from("wallet_topups")
        .insert({
          user_id: user.id,
          amount_brl: amountFixed,
          credits: amountFixed,
          status: "pending",
          external_id: orderNsu,
          checkout_url: checkoutUrl,
          infinitepay_slug: infinitepaySlug,
          expires_at: expirationDate.toISOString(),
        })
        .select("*")
        .single();
      if (topupErr) throw topupErr;

      return json({ success: true, topup });
    }

    // check
    const topupId = (body as CheckBody).topup_id;
    if (!topupId) return json({ error: "topup_id é obrigatório" }, 400);

    const { data: topup, error: topupErr } = await supabase
      .from("wallet_topups")
      .select("*")
      .eq("id", topupId)
      .eq("user_id", user.id)
      .single();
    if (topupErr || !topup) return json({ error: "Recarga não encontrada" }, 404);

    if (topup.status === "paid") {
      const { data: wallet } = await supabase
        .from("user_wallets")
        .select("credits")
        .eq("user_id", user.id)
        .maybeSingle();
      return json({ success: true, topup, wallet_credits: Number(wallet?.credits ?? 0) });
    }

    // Check with InfinitePay
    const handle = INFINITEPAY_HANDLE;
    if (!handle) return json({ error: "InfinitePay não configurado" }, 500);

    const checkPayload = {
      handle,
      order_nsu: topup.external_id,
      slug: topup.infinitepay_slug || topup.external_id,
    };

    const checkResponse = await fetch(`${INFINITEPAY_API}/payment_check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(checkPayload),
    });

    const checkData = await checkResponse.json();
    console.log("[wallet-pix] InfinitePay check:", JSON.stringify(checkData));

    if (checkData.paid === true || checkData.success === true) {
      const credited = await creditWalletIfNeeded(supabase, {
        id: topup.id,
        user_id: topup.user_id,
        credits: Number(topup.credits),
        status: String(topup.status),
        amount_brl: Number(topup.amount_brl),
      });

      const resultTopup = credited.updatedTopup ?? { ...topup, status: "paid", paid_at: new Date().toISOString() };
      return json({ success: true, topup: resultTopup, wallet_credits: credited.walletCredits });
    }

    // Check expiry
    let nextStatus: string | null = null;
    if (topup.expires_at && new Date(topup.expires_at) < new Date()) nextStatus = "expired";

    if (nextStatus && nextStatus !== topup.status) {
      const { data: updatedTopup } = await supabase
        .from("wallet_topups")
        .update({ status: nextStatus })
        .eq("id", topup.id)
        .select("*")
        .single();
      return json({ success: true, topup: updatedTopup });
    }

    return json({ success: true, topup });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro interno";
    const status = message === "Unauthorized" ? 401 : 500;
    console.error("[wallet-pix] error", e);
    return json({ error: message }, status);
  }
});
