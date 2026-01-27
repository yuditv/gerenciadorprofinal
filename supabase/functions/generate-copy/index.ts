import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  prompt: string;
  type: 'copy' | 'anuncio' | 'lembrete' | 'promocao';
  tone: 'casual' | 'formal' | 'persuasivo' | 'urgente';
  includeVariables: boolean;
  quantity?: number; // 1-5, default 1
}

const typeDescriptions: Record<string, string> = {
  copy: 'uma copy geral para WhatsApp Marketing',
  anuncio: 'um anúncio promocional atrativo',
  lembrete: 'um lembrete amigável e direto',
  promocao: 'uma oferta promocional irresistível'
};

const toneDescriptions: Record<string, string> = {
  casual: 'casual e amigável, como uma conversa entre amigos',
  formal: 'formal e profissional, transmitindo credibilidade',
  persuasivo: 'persuasivo e convincente, focado em conversão',
  urgente: 'urgente e com senso de escassez, criando FOMO'
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, type, tone, includeVariables, quantity = 1 }: RequestBody = await req.json();

    if (!prompt || !prompt.trim()) {
      return new Response(
        JSON.stringify({ error: 'Prompt é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'API key não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const variablesInstruction = includeVariables 
      ? `
VARIÁVEIS DISPONÍVEIS (use quando fizer sentido):
- {nome} = Nome do cliente
- {plano} = Plano atual do cliente
- {vencimento} = Data de vencimento
- {dias} = Dias até o vencimento

Inclua essas variáveis de forma natural na mensagem para personalização.`
      : 'NÃO use variáveis como {nome}, {plano}, etc. Crie uma mensagem genérica.';

    // Clamp quantity between 1 and 5
    const safeQuantity = Math.min(Math.max(Math.floor(quantity), 1), 5);
    
    const typeDesc = typeDescriptions[type] || typeDescriptions.copy;
    const toneDesc = toneDescriptions[tone] || toneDescriptions.persuasivo;

    let systemPrompt: string;
    let userPrompt: string;

    if (safeQuantity === 1) {
      // Single message generation
      systemPrompt = `Você é um copywriter especialista em WhatsApp Marketing no Brasil, focado em conversão e engajamento.

REGRAS OBRIGATÓRIAS:
1. Máximo 500 caracteres (WhatsApp corta mensagens muito longas)
2. Use emojis estrategicamente (2-4 no máximo, sem exageros)
3. Inclua um call-to-action claro e direto
4. Linguagem brasileira natural e coloquial
5. Evite palavras que disparam filtros de spam (GRÁTIS em caps, URGENTE excessivo)
6. Primeira linha deve capturar atenção imediatamente
7. Use quebras de linha para facilitar leitura
8. NÃO inclua saudações genéricas como "Olá!" no início

${variablesInstruction}

FORMATO DE SAÍDA:
Retorne APENAS a mensagem final, sem explicações, sem aspas, sem markdown. A mensagem deve estar pronta para copiar e usar.`;

      userPrompt = `Crie ${typeDesc} com tom ${toneDesc}.

BRIEFING DO CLIENTE:
${prompt}

Lembre-se: retorne APENAS a mensagem, nada mais.`;
    } else {
      // Multiple message generation
      systemPrompt = `Você é um copywriter especialista em WhatsApp Marketing no Brasil, focado em conversão e engajamento.

TAREFA: Crie EXATAMENTE ${safeQuantity} mensagens DIFERENTES e ÚNICAS.

REGRAS OBRIGATÓRIAS PARA CADA MENSAGEM:
1. Máximo 500 caracteres por mensagem
2. Use emojis estrategicamente (2-4 no máximo)
3. Inclua um call-to-action claro
4. Linguagem brasileira natural e coloquial
5. Evite palavras que disparam filtros de spam
6. Primeira linha deve capturar atenção
7. NÃO inclua saudações genéricas como "Olá!" no início

REGRAS PARA VARIAÇÕES:
1. Cada mensagem deve ter abordagem DIFERENTE
2. Varie as palavras iniciais de cada mensagem
3. Use emojis diferentes em cada uma
4. Mude a estrutura e ordem das informações
5. Mantenha o mesmo objetivo, mas com textos distintos

${variablesInstruction}

FORMATO DE SAÍDA OBRIGATÓRIO:
Numere cada mensagem assim: [1], [2], [3]...
Cada mensagem em uma linha separada após o número.
Sem explicações, sem aspas, sem markdown extra.`;

      userPrompt = `Crie ${safeQuantity} variações de ${typeDesc} com tom ${toneDesc}.

BRIEFING DO CLIENTE:
${prompt}

IMPORTANTE: Retorne EXATAMENTE ${safeQuantity} mensagens numeradas de [1] a [${safeQuantity}].`;
    }

    console.log('Generating copy with prompt:', { type, tone, includeVariables, quantity: safeQuantity, promptLength: prompt.length });

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.85,
        max_tokens: safeQuantity > 1 ? 1500 : 600,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error('Rate limit exceeded');
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns segundos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        console.error('Payment required');
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes. Por favor, adicione créditos à sua conta.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Erro ao gerar mensagem. Tente novamente.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      console.error('No content in response:', data);
      return new Response(
        JSON.stringify({ error: 'Resposta vazia da IA. Tente novamente.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generated copy successfully, length:', content.length);

    if (safeQuantity === 1) {
      // Single message - return as before for backwards compatibility
      return new Response(
        JSON.stringify({ content, messages: [content] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Multiple messages - parse the numbered format
      const messageRegex = /\[(\d+)\]\s*([\s\S]*?)(?=\[\d+\]|$)/g;
      const messages: string[] = [];
      let match;
      
      while ((match = messageRegex.exec(content)) !== null) {
        const messageText = match[2].trim();
        if (messageText) {
          messages.push(messageText);
        }
      }

      // Fallback: if regex didn't work, try splitting by [number]
      if (messages.length === 0) {
        const parts = content.split(/\[\d+\]/).filter((p: string) => p.trim());
        messages.push(...parts.map((p: string) => p.trim()));
      }

      // If still no messages, return the whole content as single message
      if (messages.length === 0) {
        messages.push(content);
      }

      console.log(`Parsed ${messages.length} messages from AI response`);

      return new Response(
        JSON.stringify({ 
          content: messages[0], // First message for backwards compatibility
          messages 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error in generate-copy:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});