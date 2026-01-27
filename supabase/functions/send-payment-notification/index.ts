import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Validate authentication - requires either service role key or valid JWT
 */
async function validateAuth(req: Request): Promise<{ valid: boolean; userId?: string; error?: string }> {
  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Missing or invalid authorization header' };
  }
  
  const token = authHeader.replace('Bearer ', '');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  // Check if it's the service role key (for internal edge function calls)
  if (token === supabaseServiceKey) {
    return { valid: true };
  }
  
  // Otherwise validate as a user JWT
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });
  
  const { data, error } = await supabase.auth.getClaims(token);
  
  if (error || !data?.claims) {
    return { valid: false, error: 'Invalid or expired token' };
  }
  
  return { valid: true, userId: data.claims.sub };
}

interface PaymentNotificationRequest {
  resellerName: string;
  resellerEmail: string;
  amount: number;
  referenceMonth: string;
  status: 'approved' | 'paid';
  paymentMethod?: string;
  paymentDate?: string;
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const formatMonth = (monthStr: string): string => {
  const [year, month] = monthStr.split('-');
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return `${months[parseInt(month) - 1]}/${year}`;
};

const getApprovedEmailHtml = (data: PaymentNotificationRequest): string => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Comissão Aprovada</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
    <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 32px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">✅ Comissão Aprovada!</h1>
    </div>
    <div style="padding: 32px;">
      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-top: 0;">
        Olá <strong>${data.resellerName}</strong>,
      </p>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Temos boas notícias! Sua comissão referente ao mês de <strong>${formatMonth(data.referenceMonth)}</strong> foi <strong style="color: #3b82f6;">aprovada</strong>!
      </p>
      <div style="background-color: #eff6ff; border-radius: 8px; padding: 24px; margin: 24px 0; text-align: center;">
        <p style="color: #6b7280; font-size: 14px; margin: 0 0 8px 0;">Valor da Comissão</p>
        <p style="color: #1d4ed8; font-size: 32px; font-weight: bold; margin: 0;">${formatCurrency(data.amount)}</p>
      </div>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        O pagamento será realizado em breve. Você receberá outra notificação assim que o pagamento for efetuado.
      </p>
      <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
        Atenciosamente,<br>
        <strong>Equipe de Gestão</strong>
      </p>
    </div>
    <div style="background-color: #f9fafb; padding: 16px; text-align: center;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">
        Este é um email automático. Por favor, não responda diretamente.
      </p>
    </div>
  </div>
</body>
</html>
`;

const getPaidEmailHtml = (data: PaymentNotificationRequest): string => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pagamento Realizado</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
    <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 32px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">💰 Pagamento Realizado!</h1>
    </div>
    <div style="padding: 32px;">
      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-top: 0;">
        Olá <strong>${data.resellerName}</strong>,
      </p>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Seu pagamento de comissão referente ao mês de <strong>${formatMonth(data.referenceMonth)}</strong> foi <strong style="color: #16a34a;">realizado com sucesso</strong>!
      </p>
      <div style="background-color: #f0fdf4; border-radius: 8px; padding: 24px; margin: 24px 0; text-align: center;">
        <p style="color: #6b7280; font-size: 14px; margin: 0 0 8px 0;">Valor Pago</p>
        <p style="color: #16a34a; font-size: 32px; font-weight: bold; margin: 0;">${formatCurrency(data.amount)}</p>
      </div>
      <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px; margin: 24px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="color: #6b7280; font-size: 14px; padding: 8px 0;">Forma de Pagamento:</td>
            <td style="color: #374151; font-size: 14px; padding: 8px 0; text-align: right; font-weight: 600;">
              ${data.paymentMethod === 'pix' ? 'PIX' : 
                data.paymentMethod === 'transfer' ? 'Transferência Bancária' : 
                data.paymentMethod === 'cash' ? 'Dinheiro' : 'Outro'}
            </td>
          </tr>
          <tr>
            <td style="color: #6b7280; font-size: 14px; padding: 8px 0;">Data do Pagamento:</td>
            <td style="color: #374151; font-size: 14px; padding: 8px 0; text-align: right; font-weight: 600;">
              ${data.paymentDate ? new Date(data.paymentDate).toLocaleDateString('pt-BR') : 'N/A'}
            </td>
          </tr>
        </table>
      </div>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Agradecemos sua parceria e continuamos contando com você!
      </p>
      <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
        Atenciosamente,<br>
        <strong>Equipe de Gestão</strong>
      </p>
    </div>
    <div style="background-color: #f9fafb; padding: 16px; text-align: center;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">
        Este é um email automático. Por favor, não responda diretamente.
      </p>
    </div>
  </div>
</body>
</html>
`;

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate authentication
  const auth = await validateAuth(req);
  if (!auth.valid) {
    console.error("[send-payment-notification] Authentication failed:", auth.error);
    return new Response(
      JSON.stringify({ error: 'Unauthorized', details: auth.error }),
      { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not configured");
    return new Response(
      JSON.stringify({ error: "Email service not configured" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }

  try {
    const data: PaymentNotificationRequest = await req.json();

    console.log("Sending payment notification email to:", data.resellerEmail);
    console.log("Payment status:", data.status);

    const isApproved = data.status === 'approved';
    const subject = isApproved 
      ? `✅ Sua comissão de ${formatCurrency(data.amount)} foi aprovada!`
      : `💰 Pagamento de ${formatCurrency(data.amount)} realizado!`;
    
    const html = isApproved 
      ? getApprovedEmailHtml(data) 
      : getPaidEmailHtml(data);

    // Send email using Resend API directly
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Gestão de Comissões <onboarding@resend.dev>",
        to: [data.resellerEmail],
        subject: subject,
        html: html,
      }),
    });

    const result = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error("Resend API error:", result);
      throw new Error(result.message || "Failed to send email");
    }

    console.log("Email sent successfully:", result);

    return new Response(JSON.stringify({ success: true, ...result }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-payment-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
