import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
};

const VERSION = "ai-learning-engine@2026-02-27.1";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request
    const body = await req.json().catch(() => ({}));
    const userId = body.userId as string;
    const agentId = body.agentId as string | null;
    const maxMessages = body.maxMessages || 100;

    if (!userId) {
      return new Response(JSON.stringify({ error: "userId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[${VERSION}] Starting learning session for user ${userId}, agent ${agentId || "all"}`);

    // Create learning session
    const { data: session, error: sessionError } = await supabase
      .from("ai_learning_sessions")
      .insert({
        user_id: userId,
        agent_id: agentId || null,
        status: "running",
      })
      .select()
      .single();

    if (sessionError) {
      console.error(`[${VERSION}] Error creating session:`, sessionError);
      throw new Error("Failed to create learning session");
    }

    // Fetch recent chat messages (Q&A pairs)
    let query = supabase
      .from("ai_chat_messages")
      .select("id, role, content, agent_id, session_id, created_at, metadata")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(maxMessages);

    if (agentId) {
      query = query.eq("agent_id", agentId);
    }

    const { data: messages, error: msgError } = await query;

    if (msgError) {
      console.error(`[${VERSION}] Error fetching messages:`, msgError);
      throw new Error("Failed to fetch messages");
    }

    if (!messages || messages.length === 0) {
      // No messages to learn from
      await supabase
        .from("ai_learning_sessions")
        .update({ status: "completed", completed_at: new Date().toISOString(), messages_analyzed: 0 })
        .eq("id", session.id);

      return new Response(JSON.stringify({ success: true, knowledge_extracted: 0, message: "No messages to analyze" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group messages into Q&A pairs by session
    const sessionGroups = new Map<string, Array<{ role: string; content: string; id: string }>>();
    for (const msg of messages) {
      const sid = msg.session_id || "default";
      if (!sessionGroups.has(sid)) sessionGroups.set(sid, []);
      sessionGroups.get(sid)!.push({ role: msg.role, content: msg.content, id: msg.id });
    }

    // Build conversation pairs
    const qaPairs: Array<{ question: string; answer: string; messageIds: string[] }> = [];
    for (const [, msgs] of sessionGroups) {
      // Sort by creation order (reversed since we fetched desc)
      msgs.reverse();
      for (let i = 0; i < msgs.length - 1; i++) {
        if (msgs[i].role === "user" && msgs[i + 1].role === "assistant") {
          qaPairs.push({
            question: msgs[i].content,
            answer: msgs[i + 1].content,
            messageIds: [msgs[i].id, msgs[i + 1].id],
          });
        }
      }
    }

    if (qaPairs.length === 0) {
      await supabase
        .from("ai_learning_sessions")
        .update({ status: "completed", completed_at: new Date().toISOString(), messages_analyzed: messages.length })
        .eq("id", session.id);

      return new Response(JSON.stringify({ success: true, knowledge_extracted: 0, message: "No Q&A pairs found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch existing knowledge to avoid duplicates
    let existingQuery = supabase
      .from("ai_knowledge_base")
      .select("id, question_pattern, best_answer, confidence_score, usage_count")
      .eq("user_id", userId);

    if (agentId) existingQuery = existingQuery.eq("agent_id", agentId);

    const { data: existingKnowledge } = await existingQuery;

    // Prepare context for the AI to extract patterns
    const pairsText = qaPairs.slice(0, 50).map((p, i) =>
      `### Par ${i + 1}\nPergunta: ${p.question}\nResposta: ${p.answer}`
    ).join("\n\n");

    const existingText = (existingKnowledge || []).map(k =>
      `- "${k.question_pattern}" (confiança: ${k.confidence_score})`
    ).join("\n");

    const systemPrompt = `Você é um analisador de conversas. Sua tarefa é extrair padrões de perguntas e respostas que possam ser reutilizados.

Analise os pares de pergunta/resposta abaixo e extraia CONHECIMENTOS REUTILIZÁVEIS.

Regras:
1. Identifique perguntas frequentes ou padrões comuns
2. Extraia a MELHOR resposta para cada padrão
3. Classifique por categoria (suporte, vendas, informação, técnico, geral)
4. Atribua um score de confiança (0.0 a 1.0) baseado na qualidade da resposta
5. NÃO inclua dados pessoais como nomes, telefones ou documentos
6. Generalize as perguntas para serem reutilizáveis
7. Se já existem conhecimentos similares, sugira atualizações

Conhecimentos já existentes (evite duplicatas):
${existingText || "Nenhum"}

Retorne APENAS JSON válido (sem markdown), no formato:
{
  "knowledge": [
    {
      "category": "suporte|vendas|informação|técnico|geral",
      "question_pattern": "Pergunta generalizada/padrão",
      "best_answer": "Melhor resposta para esta pergunta",
      "confidence_score": 0.8,
      "context_tags": ["tag1", "tag2"],
      "update_existing_id": null
    }
  ]
}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: pairsText },
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error(`[${VERSION}] AI error:`, aiResponse.status, errorText);
      throw new Error("AI analysis failed");
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData?.choices?.[0]?.message?.content || "";

    let extracted: { knowledge: Array<{
      category: string;
      question_pattern: string;
      best_answer: string;
      confidence_score: number;
      context_tags: string[];
      update_existing_id: string | null;
    }> };

    try {
      // Clean markdown code blocks if present
      const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      extracted = JSON.parse(cleaned);
    } catch {
      console.error(`[${VERSION}] Failed to parse AI response:`, rawContent);
      extracted = { knowledge: [] };
    }

    let knowledgeExtracted = 0;
    let knowledgeUpdated = 0;

    for (const item of extracted.knowledge || []) {
      if (!item.question_pattern || !item.best_answer) continue;

      if (item.update_existing_id) {
        // Update existing knowledge
        const { error: updateError } = await supabase
          .from("ai_knowledge_base")
          .update({
            best_answer: item.best_answer,
            confidence_score: Math.min(1, (item.confidence_score || 0.5) + 0.1),
            context_tags: item.context_tags || [],
          })
          .eq("id", item.update_existing_id)
          .eq("user_id", userId);

        if (!updateError) knowledgeUpdated++;
      } else {
        // Insert new knowledge
        const { error: insertError } = await supabase
          .from("ai_knowledge_base")
          .insert({
            user_id: userId,
            agent_id: agentId || null,
            category: item.category || "geral",
            question_pattern: item.question_pattern,
            best_answer: item.best_answer,
            confidence_score: item.confidence_score || 0.5,
            context_tags: item.context_tags || [],
            source_message_ids: qaPairs.slice(0, 5).flatMap(p => p.messageIds),
          });

        if (!insertError) knowledgeExtracted++;
      }
    }

    // Update learning session
    await supabase
      .from("ai_learning_sessions")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        messages_analyzed: messages.length,
        knowledge_extracted: knowledgeExtracted,
        knowledge_updated: knowledgeUpdated,
      })
      .eq("id", session.id);

    console.log(`[${VERSION}] Learning complete: ${knowledgeExtracted} new, ${knowledgeUpdated} updated from ${messages.length} messages`);

    return new Response(JSON.stringify({
      success: true,
      session_id: session.id,
      messages_analyzed: messages.length,
      qa_pairs_found: qaPairs.length,
      knowledge_extracted: knowledgeExtracted,
      knowledge_updated: knowledgeUpdated,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error(`[${VERSION}] Error:`, error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Internal server error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
