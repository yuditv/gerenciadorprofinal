
Objetivo
- Implementar um sistema de lucro (markup) para revenda: se o custo da API for R$10, você vende por R$13 (ou conforme %), e o sistema cobra o valor final do seu saldo em créditos.
- Como você escolheu: markup global (admin), cobrar preço final, e arredondar “sempre para cima”.

Situação atual (o que existe hoje)
- A tela /carteira já tem um campo “Markup (%)”, mas ele hoje é “por usuário” (tabela `user_pricing_settings`).
- A tela /engajamento ainda cria pedido direto pela edge function `smm-panel` (ação `add`) sem passar pelo sistema de cobrança/markup de forma segura.
- Já existem as tabelas do sistema financeiro (user_wallets, wallet_transactions, wallet_topups, smm_orders).

Problema que vamos corrigir
- Hoje dá para “criar pedido” sem o backend calcular e cobrar o preço final com lucro de forma confiável (alguém poderia manipular rate/quantidade no client, ou o pedido não ficar auditado/cobrado como deveria).

Solução proposta (visão geral)
1) Criar configuração global de markup (só admin altera)
2) Criar uma edge function nova para “comprar/cobrar e enviar pedido SMM” de forma segura (server-side)
3) Atualizar o frontend do Engajamento para:
   - Mostrar: custo da API, markup, preço final, lucro
   - Bloquear pedido se não tiver créditos suficientes
   - Ao clicar “Criar pedido”, chamar a nova função segura (não mais `smm-panel add` direto)

1) Banco de Dados (nova migration)
1.1) Criar tabela de configuração global
- Nova tabela (exemplo): `public.pricing_settings`
  - id (int, PK, default 1 ou sempre 1)
  - markup_percent numeric(8,2) not null default 0
  - updated_at timestamptz default now()
- RLS:
  - SELECT: permitir para usuários autenticados (todos precisam ler para mostrar o preço)
  - INSERT/UPDATE: somente admin (usando `public.is_admin(auth.uid())`)

1.2) (Opcional, mas recomendado) Funções SQL para débito/crédito atômicos
Para evitar problemas de concorrência (duas compras ao mesmo tempo gastando o mesmo saldo), criar funções:
- `wallet_debit(user_id uuid, amount numeric, reference_type text, reference_id text)`:
  - trava o registro do wallet (SELECT ... FOR UPDATE), valida saldo, atualiza `user_wallets`, insere `wallet_transactions` tipo `spend`
- `wallet_credit(...)` para refunds:
  - atualiza saldo e insere ledger tipo `refund`
Essas funções serão SECURITY DEFINER e só chamadas pela edge function (com service role), mantendo segurança e consistência.

2) Backend (Edge Function nova: `smm-order`)
Criar `supabase/functions/smm-order/index.ts` com:
- Autenticação: exigir Bearer token e obter user id (como já é feito em outros endpoints)
- Inputs (do client):
  - service_id, quantity, link
- Passos:
  1. Buscar o serviço e o rate real do provedor (não confiar no client):
     - chamar Instaluxo `action=services` e localizar o `service_id`
  2. Calcular custos:
     - provider_cost = (rate_per_1000 * quantity) / 1000
     - markup_percent = buscar em `pricing_settings.markup_percent`
     - price_final = provider_cost * (1 + markup/100)
     - arredondamento “sempre pra cima”: price_final = ceil(price_final*100)/100
     - profit = price_final - provider_cost (2 casas)
     - credits_needed = price_final (1 crédito = R$1)
  3. Validar saldo:
     - se credits < credits_needed: retornar erro “Saldo insuficiente”
  4. Debitar saldo e registrar auditoria:
     - debitar via função SQL (ou, se você preferir simplificar no primeiro release, debitar via sequência de upsert com cuidado; mas a recomendação é função SQL atômica)
     - criar registro em `smm_orders` status `pending` com:
       - provider_cost_brl, price_brl, credits_spent, profit_brl, markup_percent, service_name, provider_rate_per_1000, link, quantity
  5. Chamar Instaluxo `action=add` (criar pedido real)
  6. Sucesso:
     - atualizar `smm_orders` para `submitted` e salvar `provider_order_id`
  7. Falha externa:
     - atualizar `smm_orders` para `failed` (e `refunded` se refund feito)
     - estornar créditos via `wallet_credit` e ledger `refund`

Resposta da função para o frontend
- Retornar um payload padronizado:
  - order_id (uuid interno), provider_order_id (se houver)
  - provider_cost_brl, price_brl, profit_brl, credits_spent, markup_percent
  - status

3) Frontend
3.1) Engajamento (/engajamento)
- Parar de usar `useSmmPanel().addOrder` para criar pedidos.
- Continuar usando `useSmmPanel` apenas para listar serviços e mostrar rate/min/max (informativo).
- Adicionar um hook novo `useSmmOrder()` (mutation) que chama a edge function `smm-order`.
- Buscar o markup global para exibir o “preço de venda”:
  - criar `useGlobalPricingSettings()` que lê `pricing_settings`
- Exibir breakdown antes de criar:
  - Custo da API (provider_cost)
  - Markup (%) (global)
  - Preço final (credits_needed)
  - Lucro (profit)
- Bloqueio:
  - Se credits < credits_needed: desabilitar botão e mostrar “Saldo insuficiente, recarregue”
- UX:
  - Toast de sucesso com número do pedido (provider_order_id)
  - Toast de erro com mensagem amigável

3.2) Carteira (/carteira)
Como você escolheu “markup global (admin)”:
- Para usuários comuns:
  - Mostrar o markup atual (somente leitura)
  - Remover/ocultar o botão “Salvar” (ou desabilitar input)
- Para admin:
  - Manter edição e salvar no `pricing_settings`
Implementação:
- Criar checagem de admin (já existe `public.is_admin` no banco; no client podemos:
  - ou consultar uma tabela/flag existente de role (se já houver hook de permissões)
  - ou criar um endpoint simples/uso de hook existente `useUserPermissions`/`useProfile` para saber se é admin
  - caso não exista forma confiável no client, dá para mostrar o input para todos mas a gravação só vai funcionar para admin (RLS bloqueia). Melhor UX: esconder/desabilitar para não-admin.

4) Segurança/Consistência (regras importantes)
- O rate e o preço final NÃO podem vir do client: só o server calcula.
- O débito/refund deve acontecer server-side (edge function + service role), nunca no front.
- Registrar tudo em `smm_orders` e `wallet_transactions` para auditoria.

5) Testes e validação
- Testar fluxo:
  1) Usuário sem saldo tenta comprar: bloqueia e/ou erro “Saldo insuficiente”
  2) Usuário com saldo compra: ledger registra “spend”, `smm_orders` vira `submitted`
  3) Forçar erro do provedor (ex.: service inválido): `smm_orders` vira `failed/refunded` e ledger registra “refund”
- Verificar logs da edge function `smm-order` para debug e rastreio.

Entregáveis (o que vai mudar no código)
- Nova migration: `pricing_settings` + RLS + (opcional) funções SQL `wallet_debit/wallet_credit`
- Nova edge function: `smm-order`
- Frontend:
  - Hook novo `useGlobalPricingSettings`
  - Hook novo `useSmmOrder`
  - Atualização do Engajamento para usar `smm-order` e mostrar custo/preço/lucro
  - Atualização da Carteira para markup global e edição só para admin

Observação importante (sobre o “lucro”)
- O sistema vai cobrar do seu saldo o “preço final” (custo + lucro). Isso garante que você tem um valor de venda “interno” consistente.
- O dinheiro do “lucro” em si não é automaticamente sacado para fora (Mercado Pago/PIX) porque isso depende de você vender para seus clientes. O sistema vai registrar o lucro por pedido (profit_brl) e te dar relatórios, e você recebe do seu cliente por fora (ou podemos criar um módulo de cobrança para seus clientes depois).

Próximos passos que eu preciso para implementar sem erro
- Confirmar qual conta será “admin” para editar o markup global (pode ser por role já existente no banco).
