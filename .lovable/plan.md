
## O que já foi feito (até agora)
1) Banco de dados criado para o chat cliente↔você (tempo real):
- `public.customer_chat_links`: guarda os links/convites (token) que você gera e manda para cada cliente.
- `public.customer_conversations`: guarda a conversa 1:1 (uma por cliente).
- `public.customer_messages`: guarda as mensagens do chat.

2) Segurança (RLS) aplicada:
- Só o dono da conta (você) consegue gerenciar os links.
- O cliente logado só consegue ver a própria conversa/mensagens (por `customer_user_id = auth.uid()`).
- Inserção de mensagem é permitida conforme `sender_type` (`owner` ou `customer`).

3) Trigger/validação:
- Função `validate_customer_message_sender()` já valida `sender_type` e conteúdo vazio/tamanho.

4) Frontend:
- Ainda não existe interface pronta para esse chat no Atendimento nem a “página do cliente”.
- Por isso você não está “vendo” o chat em lugar nenhum ainda.

## Onde “está o chat” agora
- Ele já existe no banco, mas falta criar as telas e a lógica no app.
- Sem a tela do cliente e sem a tela dentro do Atendimento, não tem como usar ainda (só via SQL/SDK).

## Objetivo do que vamos construir
- Você configura o “perfil do chat” (nome e foto) usando o que já existe em `profiles` (display_name/avatar_url).
- Você gera um link único por cliente.
- O cliente abre o link, cria conta (email/senha) com nome obrigatório.
- Depois disso, ele conversa com você em tempo real (igual WhatsApp).
- Dentro do `/atendimento`, você terá uma área “Chat do Cliente” para ver a lista de clientes e responder.

Observação importante (pela sua decisão):
- “Somente eu” atende: vamos esconder/bloquear essa área para atendentes (membros). Só o dono da conta vê.

## Design de rotas (para não misturar com o painel)
Hoje o app tem:
- Rotas do painel (protegidas) usando `ProtectedRoute`.
- `/auth` e `/attendant-auth` (públicas, mas redirecionam se já estiver logado).

Precisamos adicionar rotas do cliente sem “jogar” ele para o painel:
- `/c/:token` → página pública do chat (convite), com Login/Cadastro do cliente.
- `/c/:token/chat` (ou `/customer/chat`) → chat do cliente já logado.

Vamos criar um “guard” de cliente (CustomerRoute) que:
- Exige login para a tela do chat do cliente.
- Se o usuário logado for dono/atendente (painel), redireciona para o painel, evitando confusão.
- Se for cliente, mantém ele no chat do cliente.

## Backend necessário (Edge Functions)
Pelo RLS atual, o cliente NÃO pode ler `customer_chat_links` (por segurança), então precisamos de edge functions para:
1) `customer-chat-link-info`
   - Entrada: `token`
   - Saída: dados básicos do chat (nome/foto do dono via `profiles`, e se o link está ativo)
   - Uso: mostrar “Chat com {Seu Nome}” na tela antes do login.

2) `customer-chat-redeem-link`
   - Requer cliente autenticado
   - Entrada: `token`, `customer_name`
   - Faz:
     - valida token/ativo
     - “resgata” o link: define `customer_user_id`, `customer_name`, `redeemed_at`
     - cria (ou reutiliza) `customer_conversations` para (owner_id, customer_user_id)
     - retorna `conversationId`
   - Uso: depois do cadastro/login, vincula o cliente ao chat certo.

Sem essas funções, o cliente não consegue iniciar o chat com segurança.

## Frontend (Cliente) — telas e comportamento
### 1) Página do convite `/c/:token`
Componentes/fluxo:
- Carrega `customer-chat-link-info` para mostrar:
  - seu nome e sua foto (do `profiles`)
  - “Entre para conversar”
- Tabs: “Entrar” e “Criar conta”
- Cadastro exige:
  - nome (obrigatório)
  - email
  - senha
- Ao finalizar login/cadastro:
  - chama `customer-chat-redeem-link` (com token e nome)
  - redireciona para `/c/:token/chat`

### 2) Chat do cliente `/c/:token/chat`
- Busca a conversa do cliente (pelo retorno do redeem ou por query “minha conversa desse owner”).
- Lista de mensagens (estilo WhatsApp: bolhas, horário, alinhamento direita/esquerda).
- Envio:
  - Insert direto em `customer_messages` com `sender_type='customer'` (RLS permite).
- Tempo real:
  - `supabase.channel(...).on('postgres_changes', INSERT/UPDATE)` em `customer_messages` filtrando `conversation_id`.
- Leitura:
  - Ao abrir o chat, marcar mensagens como lidas (atualizar `is_read_by_customer=true` em mensagens recebidas do owner).
  - (Opcional) atualizar `unread_customer_count` no `customer_conversations` quando for necessário.

## Frontend (Atendimento) — “Chat do Cliente” dentro do painel
### 1) Adicionar uma nova área no `/atendimento`
- No topo (onde hoje alterna “conversations/dashboard”), adicionar mais uma opção:
  - “WhatsApp”
  - “Chat do Cliente”
  - “Dashboard”
- Quando “Chat do Cliente” estiver selecionado:
  - Coluna esquerda: lista de conversas com clientes (`customer_conversations` do owner)
  - Área principal: painel de chat com mensagens + composer
  - Barra superior: dados do cliente (nome, avatar se tiver) + status online (opcional futuro)

### 2) Restrições (Somente você)
- Usar `useAccountContext()`:
  - Se `isMember === true`, esconder a aba “Chat do Cliente” e/ou mostrar aviso “Apenas o dono da conta pode acessar”.
- (Recomendado) Também validar no backend/RLS (já usamos `account_owner_id(auth.uid())`, mas aqui é decisão de UI).

### 3) Gerador de link por cliente (dentro do Atendimento)
- Criar um painel simples “Gerenciar links”:
  - Botão “Criar link”
  - Campo “Nome do cliente”
  - Botão “Copiar link”
  - Lista de links criados (ativo/inativo)
  - Botão “Desativar link”
- Link gerado:
  - `https://SEU_DOMINIO/c/{token}`
- Token: gerado no frontend (ex.: `crypto.randomUUID()` ou string randômica) e inserido em `customer_chat_links`.

## Hooks e componentes novos (padrão do projeto)
Vamos seguir o padrão existente (`useInboxMessages`, `useInboxConversations`) criando:
- `useCustomerChatLinks()`
  - list/create/deactivate links
- `useCustomerConversations()`
  - fetch conversas do owner
  - realtime de novas mensagens para atualizar `last_message_at` e ordenar
- `useCustomerMessages(conversationId)`
  - fetch mensagens
  - send message (owner)
  - realtime insert/update
- Componentes UI:
  - `CustomerChatSidebar` (lista)
  - `CustomerChatPanel` (mensagens + envio)
  - `CreateCustomerChatLinkDialog` (criar e copiar link)
- Páginas:
  - `CustomerChatInvite.tsx` (rota `/c/:token`)
  - `CustomerChatRoom.tsx` (rota `/c/:token/chat`)

## Ajustes necessários no roteamento
- Atualizar `src/App.tsx` para registrar:
  - `<Route path="/c/:token" element={<CustomerChatInvite/>} />`
  - `<Route path="/c/:token/chat" element={<CustomerChatRoom/>} />`
- Implementar um guard de cliente que:
  - não use `PublicRoute` (porque `PublicRoute` redireciona usuários logados pro painel)
  - valide se o usuário é cliente (ex.: detectando se ele é “member” ou “owner” e redirecionando para `/` se for)
  - mantém o cliente no chat

## Testes (checklist prático)
1) Dono cria link no Atendimento e copia.
2) Abrir link em janela anônima.
3) Cliente cria conta com nome obrigatório.
4) Cliente envia mensagem → aparece em tempo real no Atendimento (aba Chat do Cliente).
5) Dono responde → aparece em tempo real no chat do cliente.
6) Recarregar ambas telas → histórico permanece.
7) Confirmar que atendente (member) não vê a aba Chat do Cliente.

## Riscos / pontos de atenção
- Misturar “cliente logado” com “painel logado” no mesmo navegador pode confundir (porque Supabase Auth é compartilhado).
  - Mitigação: guard + redirecionamentos claros + sugestão de usar janela anônima para testar como cliente.
- Contadores de não lidas:
  - Podemos começar simples (sem contador perfeito) e adicionar depois via triggers ou updates no app.

## Entregáveis (o que você vai ver quando pronto)
- No `/atendimento`: uma nova aba “Chat do Cliente” (somente você).
- Um botão para criar e copiar link por cliente.
- Para o cliente: uma página tipo WhatsApp com login/cadastro e chat em tempo real.

