import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { templates, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `Você é um assistente que gera mensagens curtas e naturais para conversas casuais no WhatsApp entre amigos.

REGRAS IMPORTANTES:
1. Gere APENAS frases curtas de 2-8 palavras
2. Use linguagem informal e brasileira
3. Inclua gírias e expressões comuns do dia a dia
4. Varie entre saudações, perguntas simples e comentários
5. NÃO use pontuação excessiva (máximo 1 emoji por mensagem)
6. Pareça uma conversa natural entre amigos
7. Alterne entre diferentes estilos: pergunta, afirmação, reação

Exemplos de boas mensagens:
- "e aí, beleza?"
- "tudo certo por aí?"
- "opa, suave?"
- "fala aí mano"
- "como tá?"
- "de boa?"
- "salve 👋"
- "eai, firmeza?"
- "blz?"
- "tmj"
- "suave demais"
- "tô de boa"
- "massa"
- "show"
- "dahora"`;

    const userPrompt = templates && templates.length > 0
      ? `Baseado nestes templates de contexto: "${templates.slice(0, 5).join(', ')}"

Gere 5 mensagens únicas e naturais para aquecimento de WhatsApp. ${context || ''}
Retorne APENAS as mensagens, uma por linha, sem numeração.`
      : `Gere 5 mensagens curtas e naturais para conversa casual no WhatsApp. ${context || ''}
Retorne APENAS as mensagens, uma por linha, sem numeração.`;

    console.log("Generating warming messages with AI...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.9,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add funds to your workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    // Parse messages from response
    const messages = content
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0 && line.length < 50)
      .slice(0, 5);

    console.log("Generated messages:", messages);

    return new Response(JSON.stringify({ messages }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating warming message:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
