import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface VerificationRequest {
  email: string;
  type: 'signup' | 'resend';
}

const getVerificationEmailHtml = (verificationUrl: string): string => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirme seu Email</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
    <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 32px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">✉️ Confirme seu Email</h1>
    </div>
    <div style="padding: 32px;">
      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-top: 0;">
        Olá! Obrigado por se cadastrar.
      </p>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Para ativar sua conta e começar a usar o sistema, clique no botão abaixo para confirmar seu email:
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${verificationUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Confirmar Email
        </a>
      </div>
      <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
        Se você não criou uma conta, pode ignorar este email com segurança.
      </p>
      <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
        Atenciosamente,<br>
        <strong>Equipe GerenciadorPro</strong>
      </p>
    </div>
    <div style="background-color: #f9fafb; padding: 16px; text-align: center;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">
        Este link expira em 24 horas. Se o botão não funcionar, copie e cole este link no seu navegador:
      </p>
      <p style="color: #6b7280; font-size: 11px; margin: 8px 0 0; word-break: break-all;">
        ${verificationUrl}
      </p>
    </div>
  </div>
</body>
</html>
`;

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not configured");
    return new Response(
      JSON.stringify({ error: "Email service not configured" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  try {
    const { email, type }: VerificationRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`[send-verification-email] Sending verification email to: ${email}, type: ${type}`);

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const origin = req.headers.get('origin') || 'https://id-preview--cb514275-a2d5-4bb5-bc84-94edde26937f.lovable.app';
    const redirectTo = `${origin}/email-confirmed`;

    // NOTE: In current @supabase/auth-js types, `generateLink({ type: 'signup' })` requires a password.
    // This function only sends verification emails, so we use:
    // - 'invite' for new signups (creates/invites a user without requiring password here)
    // - 'magiclink' for resends / existing users
    const primaryLinkType: 'invite' | 'magiclink' = type === 'signup' ? 'invite' : 'magiclink';

    const { data, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: primaryLinkType,
      email,
      options: { redirectTo },
    });

    if (linkError) {
      // If user already exists (or invite is not allowed), fall back to magic link
      if (linkError.message?.toLowerCase().includes('already been registered')) {
        const { data: magicData, error: magicError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email,
          options: { redirectTo },
        });

        if (magicError) {
          console.error("Error generating magic link:", magicError);
          return new Response(
            JSON.stringify({ error: "Failed to generate verification link" }),
            { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        // Send email with magic link
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "GerenciadorPro <onboarding@resend.dev>",
            to: [email],
            subject: "✉️ Confirme seu Email - GerenciadorPro",
            html: getVerificationEmailHtml(magicData.properties.action_link),
          }),
        });

        const result = await emailResponse.json();

        if (!emailResponse.ok) {
          console.error("Resend API error:", result);
          throw new Error(result.message || "Failed to send email");
        }

        console.log("Verification email sent successfully:", result);
        return new Response(JSON.stringify({ success: true, ...result }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      console.error("Error generating link:", linkError);
      return new Response(
        JSON.stringify({ error: linkError.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Send email with verification link
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "GerenciadorPro <onboarding@resend.dev>",
        to: [email],
        subject: "✉️ Confirme seu Email - GerenciadorPro",
        html: getVerificationEmailHtml(data.properties.action_link),
      }),
    });

    const result = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error("Resend API error:", result);
      throw new Error(result.message || "Failed to send email");
    }

    console.log("Verification email sent successfully:", result);

    return new Response(JSON.stringify({ success: true, ...result }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-verification-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
