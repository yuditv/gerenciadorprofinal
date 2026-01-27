
Contexto e diagnóstico (o que eu vi no seu projeto)
- O botão “Testar agente” chama a Edge Function `ai-agent-chat` via `supabase.functions.invoke('ai-agent-chat')`.
- A função está respondendo e funcionando (consigo chamar via teste server-side). Porém, ela está registrando no log:
  - “Using Google Gemini API directly with model: google/gemini-2.5-flash”
  - Em seguida: “Google Gemini API error: 404”
- O motivo do 404 é que o seu código está chamando o endpoint do Google Generative Language API:
  - `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?...`
  - Esse endpoint espera nomes de modelo no formato do Gemini “direto” (ex.: `gemini-2.0-flash`, `gemini-1.5-flash`, etc.).
  - Mas no seu banco / UI, o `ai_model` está sendo salvo como `google/gemini-2.5-flash` (formato típico de “AI Gateway / OpenAI-compatible routing”), o que gera URL inválida do ponto de vista do endpoint do Google → 404.

Resumo do problema em uma frase
- “Testar Agente” parou porque o app salva o modelo no formato `google/...`, mas a Edge Function está chamando o Gemini direto e precisa de `gemini-...`; com isso, a chamada ao Gemini retorna 404 e o chat cai em erro.

Objetivo da correção (de acordo com sua resposta)
- Você quer: Usar Gemini direto + você tem `GEMINI_API_KEY`.
- Então vamos:
  1) Ajustar a Edge Function para normalizar/validar o nome do modelo para Gemini direto (para não quebrar agentes já criados).
  2) Ajustar o formulário (Create/Edit Agent) para oferecer e salvar modelos compatíveis com Gemini direto (evitar que volte a quebrar).
  3) Melhorar o erro mostrado no “Testar Agente” para revelar o motivo real (ex.: “modelo inválido”) em vez da mensagem genérica.

Plano de implementação (passo a passo)

1) Corrigir no backend (Edge Function) a compatibilidade de modelos
Arquivo: `supabase/functions/ai-agent-chat/index.ts`

1.1) Criar uma função utilitária (no próprio arquivo) para normalizar `ai_model`
- Regras:
  - Se vier no formato `google/gemini-*`, remover o prefixo `google/`.
  - Se vier `google/gemini-2.5-*` (que não é aceito no endpoint direto), fazer fallback seguro:
    - Ex.: mapear `gemini-2.5-flash` → `gemini-2.0-flash`
    - `gemini-2.5-pro` → `gemini-2.0-flash` (ou `gemini-1.5-pro` dependendo da sua preferência; eu vou sugerir `gemini-2.0-flash` por ser mais “atual” e geralmente disponível)
  - Se vier `google/gemini-3-*` ou `*-preview`, também cair em fallback (`gemini-2.0-flash`) para evitar 404.
  - Se vier vazio/nulo: usar default `gemini-2.0-flash` (ou manter o default existente, mas hoje ele está como `gemini-2.0-flash` no código e isso é ok).

1.2) Logar claramente a normalização
- Ex.: `requestedModel=google/gemini-2.5-flash normalizedModel=gemini-2.0-flash`
- Isso ajuda muito quando um projeto foi “transferido” entre contas e parte dos dados ficou com formatos diferentes.

1.3) Usar o modelo normalizado na URL do Gemini
- Trocar `modelToUse` (atual) por `normalizedModel` no `geminiApiUrl`.

1.4) Garantir que erros do Gemini não derrubem o endpoint
- Hoje já existe tratamento e retorno JSON com CORS.
- Vamos manter isso, mas vamos enriquecer o `details` (por ex. incluir o `normalizedModel` e o `requestedModel`) em caso de 404 para diagnóstico.

2) Corrigir no frontend o “source of truth” do modelo (para parar de salvar `google/...`)
Arquivo: `src/components/CreateAgentDialog.tsx`

2.1) Atualizar a lista `AI_MODELS`
- Hoje a UI diz “IA Nativa (Gemini)” mas oferece modelos “google/gemini-2.5-*”.
- Para Gemini direto, a lista deve ser algo do tipo:
  - `gemini-2.0-flash` (recomendado)
  - `gemini-1.5-flash`
  - `gemini-1.5-pro` (se você quiser opção “mais inteligente”)
  - (opcional) `gemini-2.0-pro` se você confirmar que usa/tem disponível no seu projeto (nem sempre está liberado; para não quebrar, eu deixo só os mais seguros).

2.2) Definir default coerente
- Onde hoje está `ai_model: 'google/gemini-2.5-flash'`, trocar para `ai_model: 'gemini-2.0-flash'` para ver “funcionando” sem ajuste manual.

2.3) Normalizar no submit (proteção extra)
- Mesmo que algum dado antigo esteja em `google/...`, no `handleSubmit` vamos normalizar antes de enviar ao `updateAgent/createAgent`, garantindo que o banco passe a ficar consistente com Gemini direto.

3) Melhorar a mensagem de erro no “Testar Agente” (para não mascarar)
Arquivos:
- `src/components/AIAgentChat.tsx`
- (possivelmente) `src/hooks/useAIAgents.ts` (somente se precisar padronizar)

3.1) Em caso de falha, mostrar o erro real retornado pelo backend quando existir
- Hoje o catch sempre adiciona: “❌ Erro ao processar mensagem…”
- Vamos alterar para:
  - Se `error` tiver uma mensagem (do `supabase.functions.invoke`) mostrar um resumo: “Falha na IA: <mensagem curta>”
  - Se o backend retornar `data.error` (por exemplo “Gemini API returned status 404”), exibir isso em texto menor (para debug).
- Resultado: se acontecer de novo, você não fica “cego” com erro genérico.

4) Ajuste opcional (recomendado): “Consertar agentes existentes” automaticamente
- Seu agente atual no banco está com `ai_model = google/gemini-2.5-flash`.
- Depois das mudanças acima, ele deve funcionar mesmo assim (pela normalização no backend).
- Mas para deixar o banco limpo e evitar confusão, eu posso também:
  - Atualizar automaticamente (via UI/admin flow) os agentes `use_native_ai=true` que tenham `ai_model` começando com `google/` para `gemini-2.0-flash`.
  - Eu vou implementar isso de forma segura, sem mexer em agentes que já estão com `gemini-*`.

Como vamos validar (teste rápido)
1) Abrir “Agente IA” → “Testar Chat”.
2) Selecionar o agente “teste”.
3) Enviar “Oi”.
4) Confirmar:
   - Resposta aparece no chat.
   - Edge logs mostram “normalizedModel=gemini-2.0-flash”.
5) Se ainda falhar:
   - Conferir logs da `ai-agent-chat` e a mensagem exibida no chat (agora mais detalhada).

Riscos / pontos de atenção
- Modelos “2.5” e “3 preview” no formato `google/...` não são aceitos no endpoint Gemini direto usado no seu código hoje. Então precisamos escolher fallbacks seguros.
- Como você disse que o projeto foi transferido, é comum ter inconsistências entre “como o front salva” e “como o backend espera”. O plano acima corrige os dois lados.

Arquivos que serão alterados (quando você aprovar a implementação)
- `supabase/functions/ai-agent-chat/index.ts` (normalização/validação de modelo + logs)
- `src/components/CreateAgentDialog.tsx` (lista de modelos compatíveis com Gemini direto + default + normalização no submit)
- `src/components/AIAgentChat.tsx` (mensagens de erro mais informativas)

Observação importante
- Eu vi que você já tem o secret `GEMINI_API_KEY` configurado no projeto, então não vamos depender de nenhuma chave nova para essa correção.
