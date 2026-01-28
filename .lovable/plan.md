
Objetivo (o que você perguntou)
- Hoje: o “bot” que foi criado pelo Wizard é um bot conversacional (IA). Ele responde como chat normal (texto/áudio transcrito) e não é, por padrão, um “menu 1/2/3” de automação numérica.
- Você quer: um modo de atendimento estilo URA/automação, onde o cliente digita “1”, “2”, “3”… para escolher opções.
- Você escolheu agora: **Resposta numérica**, **Menu simples**, **Gatilho manual**, e **Lembrar etapa** (ou seja, o bot precisa “saber” que está aguardando a opção do menu).

O que já existe no projeto (base que vamos aproveitar)
- Inbox já envia mensagens pelo `send-inbox-message` e registra em `chat_inbox_messages`.
- O webhook `whatsapp-inbox-webhook` já cria/atualiza conversas (`conversations`) e salva mensagens.
- A estrutura `Conversation` usada no frontend já considera `conversation.metadata` (mesmo que o types do Supabase esteja desatualizado), então podemos guardar estado de menu ali sem criar tabela nova.

O que vamos construir (comportamento final)
1) No Inbox, você terá um botão “Iniciar Menu” (manual) para a conversa atual.
2) Ao clicar:
   - O sistema envia uma mensagem com um menu simples (ex.: “1 - Suporte / 2 - Vendas / 3 - Financeiro”).
   - O sistema salva na conversa um “estado do menu” (ex.: aguardando escolha, etapa atual).
3) Quando o cliente responder com um número:
   - O sistema identifica que a conversa está “em modo menu” e que está aguardando opção.
   - Responde automaticamente com o texto configurado daquela opção.
   - Atualiza o estado para “concluído” (ou para próxima etapa, se você quiser evoluir depois).

Decisões importantes (com base no que você aprovou)
- Formato: o cliente vai digitar número (não botões do WhatsApp).
- Gatilho: manual (você decide quando iniciar o menu).
- Persistência: vamos armazenar estado na conversa (`conversations.metadata`) para lembrar etapa.
- Escopo: menu simples (uma etapa), mas estruturado para poder virar multi-etapas depois.

Implementação (passos)
A) Configuração do menu (onde ficam as opções e respostas)
- Adicionar no Wizard do Agente IA (CreateBotWizardDialog) uma etapa opcional “Menu Numérico (manual)”.
- Campos nessa etapa:
  - “Ativar menu numérico” (toggle)
  - “Mensagem do menu” (texto base)
  - Lista de opções (ex.: 1..9) com:
    - Número (1,2,3…)
    - Título curto (ex.: “Suporte”)
    - Resposta automática (texto que o bot envia ao cliente ao escolher)
- Onde salvar essa configuração:
  - Salvar como JSON dentro do agente em `ai_agents.consultation_context` (ou outro campo textual disponível) para não precisar criar tabela.
  - Estrutura sugerida (exemplo):
    ```json
    {
      "numeric_menu": {
        "enabled": true,
        "prompt": "Olá! Escolha uma opção:\n1 - Suporte\n2 - Vendas\n3 - Financeiro",
        "options": {
          "1": { "reply": "Beleza! Vamos para suporte. Me diga qual app você usa e o erro." },
          "2": { "reply": "Perfeito! Para vendas, qual plano você quer? 1 mês / 3 meses / 12 meses" },
          "3": { "reply": "Certo! Para financeiro, você quer 1) 2ª via 2) status do pagamento 3) renovar" }
        }
      }
    }
    ```
  - Isso deixa o bot “bem completo” porque o mesmo agente continua com memória/anti-spam/ferramentas, mas ganha um “modo automação” adicional.

B) Inbox UI: botão manual “Iniciar Menu”
- No `src/components/Inbox/ChatPanel.tsx`:
  - Adicionar um item no menu de ações (Dropdown/More options) algo como:
    - “Iniciar Menu do Bot”
    - (Opcional) “Encerrar Menu”
  - Regras para habilitar o botão:
    - Ter conversa selecionada
    - Ter `conversation.active_agent_id` definido (ou o agente ativo do roteamento)
    - O agente ter `numeric_menu.enabled === true`
- Ao clicar “Iniciar Menu”:
  1) Buscar o agente ativo da conversa (via Supabase) para obter `numeric_menu.prompt`.
  2) Enviar a mensagem do menu usando o fluxo normal do Inbox (chamando `onSendMessage()` com o texto do menu).
  3) Atualizar `conversations.metadata` para guardar o estado:
     - `metadata.bot_menu = { mode: "numeric", status: "waiting_choice", started_at, agent_id }`

C) Webhook: interpretar resposta numérica do cliente e responder automaticamente
- No `supabase/functions/whatsapp-inbox-webhook/index.ts`, no fluxo de mensagens recebidas (incoming):
  1) Depois de garantir que `conversation` existe e depois de salvar a mensagem recebida (para manter histórico), carregar:
     - `conversation.metadata`
     - `conversation.active_agent_id` (ou consultar agente vinculado)
     - Config do agente (`ai_agents.consultation_context`)
  2) Se `conversation.metadata.bot_menu.status === "waiting_choice"`:
     - Ler `message` (texto recebido) e extrair um número simples (ex.: regex `^\s*(\d+)\s*$`).
     - Se o número existir no `numeric_menu.options`:
       - Enviar a resposta automática (via UAZAPI send text ou pela função de envio já existente no webhook).
       - Registrar essa resposta no `chat_inbox_messages` como `sender_type: 'ai'` (ou como o padrão atual de mensagens automatizadas no seu webhook), com metadata indicando que veio do menu.
       - Atualizar `conversations.metadata.bot_menu` para:
         - `status: "done"` (menu simples)
         - `selected_option: "2"` etc.
         - `completed_at`
     - Se o cliente digitar algo inválido:
       - Responder “Opção inválida, responda com 1, 2 ou 3” e manter `waiting_choice`.

D) “Lembrar etapa” (persistência) e como isso funciona na prática
- Como o gatilho é manual e o menu é simples, “lembrar etapa” significa:
  - Depois que você inicia, a conversa fica “aguardando escolha”.
  - Depois que o cliente escolhe, marcamos como “done” para não ficar preso no menu.
- (Opcional, para ficar mais avançado depois) Podemos permitir:
  - “0 - Voltar” / “9 - Falar com humano”
  - multi-etapas com `step_id` e `data` dentro do `metadata.bot_menu`

E) Segurança, robustez e manutenção
- Evitar conflitos com IA:
  - Quando o menu estiver `waiting_choice`, o webhook deve priorizar o menu (não chamar IA para aquela mensagem).
  - Depois de `done`, volta ao fluxo normal (IA/roteamento/anti-spam).
- Logs:
  - Registrar no metadata da mensagem: `{ bot_menu: { selected: "1", agent_id, version } }`
- Tipos:
  - Atualizar o tipo do Supabase/TS para incluir `conversations.metadata` (o frontend já usa, mas o types.ts parece desatualizado).

Critérios de aceite (o que vamos validar no final)
1) No Inbox, clicar “Iniciar Menu do Bot” envia o menu ao cliente.
2) A conversa fica com estado “aguardando escolha”.
3) Cliente responde “1” e o sistema responde automaticamente com a mensagem configurada.
4) O estado do menu é marcado como concluído e não intercepta mais mensagens.
5) Toda a conversa fica registrada no histórico (mensagens do cliente + resposta do menu).

Arquivos que provavelmente serão alterados (visão técnica)
- `src/components/CreateBotWizardDialog.tsx` (nova etapa e persistir config no agente)
- `src/components/Inbox/ChatPanel.tsx` (botão manual para iniciar/encerrar menu)
- `supabase/functions/whatsapp-inbox-webhook/index.ts` (interceptar resposta numérica e responder)
- `src/integrations/supabase/types.ts` (opcional: corrigir schema/types do `conversations.metadata`)

Observação importante (expectativa)
- Esse “menu numérico” é automação determinística. Ele funciona muito bem para “triagem” e “atalhos”.
- A IA continua existindo e pode assumir depois do menu (ex.: após escolher “1 - Suporte”, a IA pode continuar o atendimento normalmente com aquele contexto). Se você quiser isso já na primeira versão, eu encaixo: após enviar a resposta do menu, marcamos um “assunto” e deixamos a IA seguir.

