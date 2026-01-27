import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MERCADO_PAGO_ACCESS_TOKEN = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN")!;

type Action = "create" | "check";

type CreateBody = {
  action: "create";
  amount_brl: number;
};

type CheckBody = {
  action: "check";
  topup_id: string;
};

type RequestBody = CreateBody | CheckBody;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function requireUser(supabase: ReturnType<typeof createClient>, req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }
  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) throw new Error("Unauthorized");
  return user;
}

async function creditWalletIfNeeded(
  supabase: ReturnType<typeof createClient>,
  topup: { id: string; user_id: string; credits: number; status: string; amount_brl: number },
) {
  if (topup.status === "paid") {
    const { data: wallet } = await supabase
      .from("user_wallets")
      .select("credits")
      .eq("user_id", topup.user_id)
      .maybeSingle();
    return { alreadyCredited: true, walletCredits: Number(wallet?.credits ?? 0) };
  }

  // 1) mark paid
  const paidAt = new Date().toISOString();
  const { data: updatedTopup, error: updateErr } = await supabase
    .from("wallet_topups")
    .update({ status: "paid", paid_at: paidAt })
    .eq("id", topup.id)
    .select("*")
    .single();
  if (updateErr) throw updateErr;

  // 2) upsert wallet balance
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

  // 3) ledger entry
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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const user = await requireUser(supabase, req);

    const body = (await req.json()) as RequestBody;
    if (!body?.action) return json({ error: "Ação inválida" }, 400);

    if (body.action === "create") {
      const amount = Number(body.amount_brl);
      if (!Number.isFinite(amount) || amount < 1) return json({ error: "Valor mínimo é R$ 1,00" }, 400);

      const amountFixed = Number(amount.toFixed(2));
      const expirationDate = new Date(Date.now() + 30 * 60 * 1000);

      const mpPayload = {
        transaction_amount: amountFixed,
        description: `Recarga de créditos (${amountFixed.toFixed(2)} BRL)`,
        payment_method_id: "pix",
        payer: {
          email: user.email || "cliente@gerenciadorpro.com",
        },
        date_of_expiration: expirationDate.toISOString(),
      };

      const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${MERCADO_PAGO_ACCESS_TOKEN}`,
          "X-Idempotency-Key": `${user.id}-wallet-${Date.now()}`,
        },
        body: JSON.stringify(mpPayload),
      });

      const mpData = await mpResponse.json();
      if (!mpResponse.ok) {
        console.error("[wallet-pix] MP error", mpData);
        return json({ error: mpData.message || "Erro ao criar pagamento no Mercado Pago" }, 502);
      }

      const pixData = mpData.point_of_interaction?.transaction_data;
      const pixCode = pixData?.qr_code || null;
      const pixQrCode = pixData?.qr_code_base64 ? `data:image/png;base64,${pixData.qr_code_base64}` : null;

      const { data: topup, error: topupErr } = await supabase
        .from("wallet_topups")
        .insert({
          user_id: user.id,
          amount_brl: amountFixed,
          credits: amountFixed,
          status: "pending",
          external_id: mpData.id?.toString?.() ?? String(mpData.id),
          pix_code: pixCode,
          pix_qr_code: pixQrCode,
          expires_at: expirationDate.toISOString(),
        })
        .select("*")
        .single();
      if (topupErr) throw topupErr;

      return json({ success: true, topup });
    }

    // check
    const topupId = body.topup_id;
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

    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${topup.external_id}`, {
      headers: { Authorization: `Bearer ${MERCADO_PAGO_ACCESS_TOKEN}` },
    });
    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error("[wallet-pix] MP status error", mpData);
      return json({ error: "Falha ao consultar pagamento no Mercado Pago" }, 502);
    }

    if (mpData.status === "approved") {
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

    // update local status if expired/failed
    let nextStatus: string | null = null;
    if (mpData.status === "cancelled" || mpData.status === "rejected") nextStatus = "failed";
    else if (topup.expires_at && new Date(topup.expires_at) < new Date()) nextStatus = "expired";

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
