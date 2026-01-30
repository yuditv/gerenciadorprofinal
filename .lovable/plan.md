
## Contexto do problema (o que está acontecendo)
1) Você tentou habilitar a opção “Prevent use of leaked passwords” (HIBP) no Supabase e não consegue. Pela sua captura de tela, isso ocorre porque esse recurso é **somente do plano Pro** do Supabase (“Only available on Pro plan and above”).  
2) Esse bloqueio **não tem relação direta** com a funcionalidade pedida (controle de iniciar IA automaticamente em novas conversas). A implementação do toggle “Auto IA” pode (e deve) funcionar mesmo sem HIBP.

Além disso, notei um problema técnico importante no último diff:
- Foi **editado** `src/integrations/supabase/types.ts`. Isso **não pode** ser editado manualmente neste projeto (e tende a quebrar tipos/geração). Precisamos **reverter** essa alteração e tipar a nova tabela de preferências por interfaces locais no frontend.

---

## Objetivo do ajuste (requisito aprovado)
Você aprovou:
- **Auto IA**: Não iniciar automaticamente
- **Agente padrão**: Escolher um agente

Então o comportamento final desejado será:
- Em **novas conversas**: **não iniciar a IA automaticamente** (continua como hoje: IA desativada e aparece a pergunta “Nova conversa — ativar IA?” no Atendimento).
- Na aba **Agente IA**: existir uma área de configurações para:
  - Ligar/desligar “Iniciar IA automaticamente em novas conversas”
  - Escolher um “Agente padrão” (um agente existente)
- Quando o usuário clicar “Ativar IA” no Atendimento:
  - Se existir “Agente padrão” configurado, a conversa passa a ter `active_agent_id = default_agent_id` (para não ficar “sem agente” quando a IA for ativada).

---

## O que já existe e será aproveitado
- O webhook `supabase/functions/whatsapp-inbox-webhook/index.ts` hoje cria novas conversas com:
  - `ai_enabled: false`
  - `metadata.ai_prompt_pending: true`
  Isso é exatamente o modo “não iniciar automaticamente” e causa o prompt no Atendimento.
- O Atendimento (`src/pages/Atendimento.tsx`) já possui a lógica do prompt via `ai_prompt_pending`.

---

## Mudanças necessárias (alto nível)
### A) Banco de dados (já criado)
A migration já cria a tabela:
- `public.ai_agent_preferences` com:
  - `auto_start_ai boolean default false`
  - `default_agent_id uuid null`
  - RLS por usuário

### B) Frontend: criar tela/config no “Agente IA”
1) Criar um hook novo (ex.: `useAIAgentPreferences`) para:
   - Buscar preferências do usuário logado
   - Criar registro se não existir (upsert)
   - Atualizar `auto_start_ai` e `default_agent_id`

2) Ajustar a UI em `src/components/AIAgentAdmin.tsx`:
   - Adicionar um novo `TabsTrigger` e `TabsContent`, por exemplo: **“Preferências”** ou **“Configurações”**
   - Dentro dessa aba:
     - `Switch` “Iniciar IA automaticamente em novas conversas”
     - Um `Select` para escolher o **Agente padrão** (usando a lista `agents`, preferindo “principais” e ativos)
     - Mostrar validações amigáveis:
       - Se “Auto-start” estiver ligado e não existir “Agente padrão”, mostrar aviso e/ou impedir salvar (ou salvar mas avisar que a IA ligará sem agente; como você escolheu “Escolher um agente”, vamos exigir agente ao ativar auto-start)

3) Reverter a dependência de tipos gerados:
   - **Remover** as mudanças manuais em `src/integrations/supabase/types.ts`
   - Usar uma interface local para a linha da tabela:
     ```ts
     type AIAgentPreferences = {
       user_id: string;
       auto_start_ai: boolean;
       default_agent_id: string | null;
       created_at?: string;
       updated_at?: string;
     }
     ```

### C) Atendimento: ao “Ativar IA”, aplicar agente padrão automaticamente
No `src/pages/Atendimento.tsx`, dentro de `upsertDecision(true)`:
- Buscar preferências (`ai_agent_preferences`) e, se tiver `default_agent_id`:
  - Atualizar a conversa com:
    - `ai_enabled: true`
    - `active_agent_id: default_agent_id` (somente se `conv.active_agent_id` estiver vazio, para não sobrescrever transferências)
    - `metadata.ai_prompt_pending: false`

Isso garante: “Ativar IA” já define qual agente vai responder.

### D) Backend: respeitar preferências quando Auto IA estiver ligado (preparar o caminho)
Mesmo você tendo escolhido “Não iniciar automaticamente”, precisamos implementar o toggle completo.
Então no `whatsapp-inbox-webhook` (criação de nova conversa):
- Ler `ai_agent_preferences` do dono (`instance.user_id`)
- Se `auto_start_ai === true`:
  - Criar conversa com:
    - `ai_enabled: true`
    - `active_agent_id: default_agent_id` (se setado)
    - `metadata.ai_prompt_pending: false` (não precisa perguntar)
- Se `auto_start_ai === false` (seu caso):
  - Manter o comportamento atual:
    - `ai_enabled: false`
    - `metadata.ai_prompt_pending: true`

Também aplicar o mesmo padrão no `sync-chats/index.ts` quando criar conversas “novas” via sincronização (para consistência).

---

## Correção do “não consigo ativar a opção” (HIBP)
- Explicar claramente no app/documentação interna: isso é limitação do plano do Supabase.
- Remover qualquer dependência/“bloqueio” no fluxo do nosso app que impeça você de seguir sem HIBP.  
Ou seja: **não vamos exigir essa opção** para concluir o recurso de Auto IA.

---

## Sequência de implementação (passo a passo)
1) Reverter/ajustar qualquer alteração manual em `src/integrations/supabase/types.ts` (não pode ser editado).
2) Implementar hook `useAIAgentPreferences` (React Query) para:
   - `select` do registro do usuário
   - `upsert` quando alterar toggle/agente
3) Atualizar `AIAgentAdmin.tsx` adicionando a aba “Preferências”:
   - Switch `auto_start_ai`
   - Select `default_agent_id`
4) Atualizar `Atendimento.tsx` para, ao clicar “Ativar IA” no prompt:
   - aplicar `active_agent_id = default_agent_id` (se houver)
5) Atualizar `whatsapp-inbox-webhook` na criação de conversa para usar `ai_agent_preferences` quando `auto_start_ai` estiver ligado
6) Atualizar `sync-chats` para usar preferências ao inserir conversas novas
7) Testes rápidos:
   - Criar nova conversa (mensagem recebida) com `auto_start_ai=false`: deve aparecer prompt e IA não responde automaticamente.
   - Habilitar `auto_start_ai=true` + escolher agente padrão: nova conversa já deve vir com IA ligada e respondendo (sem prompt).
   - No prompt “Ativar IA”: deve setar `active_agent_id` automaticamente para o agente padrão.

---

## Riscos e cuidados
- RLS: a tabela `ai_agent_preferences` tem RLS por usuário; no webhook precisamos usar cliente com privilégios adequados (service role) ou query com contexto apropriado.
- Não sobrescrever transferências: ao aplicar agente padrão no Atendimento, só setar `active_agent_id` se estiver vazio.
- Tipos Supabase: não editar `types.ts` manualmente; usar tipagem local.

---

## Resultado esperado para você (UX)
- Na aba **Agente IA** você terá um painel simples:
  - “Iniciar IA automaticamente em novas conversas” [on/off]
  - “Agente padrão” [selecionar agente]
- Com o toggle **desligado** (seu caso):
  - nada muda no automático: chega conversa nova → não inicia IA → aparece pergunta “ativar IA?”
- Quando você clicar “Ativar IA”, ele já começa usando o agente padrão que você escolheu (sem confusão/sem cair no “início”).

