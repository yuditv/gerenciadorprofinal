
Objetivo (completo, “os 3”)
- (1) Deixar bem claro no /engajamento o que é “Rate (custo)” (custo do provedor) e o que é “Preço final” (custo + markup), exibindo lucro estimado e bloqueando compra sem saldo.
- (2) Registrar vendas/pedidos de forma auditável para você conseguir apurar lucro por período/pedido (inclusive lucro “real” quando a API retorna o charge).
- (3) Implementar painel de acompanhamento do pedido: consultar status, atualizar status em lote, solicitar refill e cancelar (quando suportado), tudo integrado na UI.

O código PHP ajuda?
Sim. Ele é útil principalmente para:
- Confirmar os “actions” válidos (services, add, status, balance, refill, refill_status, cancel).
- Confirmar os nomes exatos dos campos esperados (order vs orders, refill vs refills, comments, runs, interval etc).
- Deixar claro que existe “multiStatus” (status com `orders=1,2,3`) e multiRefill/multiRefillStatus, que vamos espelhar no Edge Function para ganhar performance no painel de pedidos.

Diagnóstico do que está acontecendo hoje (por que “não sobe o rate” e “não tira lucro”)
- Hoje o front está correto ao NÃO “subir o rate”: rate é custo do provedor (API), não deve mudar com markup.
- O problema real é que o seu fluxo atual ainda cria pedido direto via Edge Function `smm-panel` (proxy) e não faz cobrança/lançamento do “preço final” nem grava o pedido na tabela `smm_orders` de forma completa.
- Consequência: você até “vê” o lucro estimado na tela, mas o sistema não registra, não soma em relatório, e não controla status/refill/cancel porque não existe uma camada de “order management” no backend.

Arquitetura proposta (alto nível)
1) Manter `smm-panel` como “proxy técnico” (chamada externa Instaluxo), mas ampliar ações suportadas:
   - adicionar: refill, refill_status, cancel
   - permitir: status em lote (orders) e refill_status em lote (refills)
2) Criar um novo Edge Function “orquestrador” (ex.: `smm-orders`) que:
   - valida usuário (JWT)
   - calcula custos/preço com base no serviceId e no markup global (pricing_settings)
   - debita créditos com atomicidade (via função SQL `wallet_debit`)
   - cria registro em `smm_orders` com status “pending”
   - chama a Instaluxo (action add)
   - em sucesso: salva provider_order_id e status “submitted”
   - em falha: reembolsa créditos (via `wallet_credit`) e marca pedido “failed/refunded”
   - para status/refill/cancel: consulta Instaluxo, atualiza colunas do pedido e retorna resultado padronizado
3) Frontend:
   - /engajamento vira um “hub” com Tabs: “Criar pedido” | “Meus pedidos” | “Relatórios”
   - “Criar pedido”: UI mais inteligente (campos extras dependendo do tipo do serviço)
   - “Meus pedidos”: tabela com ações (atualizar status, refill, cancelar)
   - “Relatórios”: somatórios e gráficos (lucro estimado, lucro real por charge, total por período)

Parte A — UI completa de preço/lucro (e bloqueios)
1) Ajustar o cálculo e exibição no /engajamento:
   - Manter “Rate (custo)” como custo do provedor (sem markup).
   - Exibir claramente:
     - Custo provedor (estimado): provider_cost_brl = (rate/1000) * qty
     - Markup global (%): pricing_settings.markup_percent
     - Preço final (cobrado do usuário em créditos): final_price_brl = provider_cost_brl * (1 + markup/100)
     - Lucro estimado: profit_brl = final_price_brl - provider_cost_brl
   - Adicionar aviso quando o saldo de créditos for menor que o preço final.
   - Botão “Criar pedido” bloqueado se:
     - dados inválidos
     - saldo insuficiente
     - ou se o serviço exigir “comments” e comments estiver vazio.
2) Melhorar seleção de serviços sem mudar layout macro:
   - Usar o `categories` já calculado no hook para filtrar serviços por categoria (select “Categoria” + select “Serviço”).
   - Adicionar busca (Input) para filtrar por nome/id.
   - Limitar itens renderizados com filtro + slice (já tem slice(0,400), vamos tornar isso mais útil ao usuário).

Parte B — Registro de pedidos e lucro (venda/relatório)
A tabela `smm_orders` já existe, mas hoje está subutilizada. Vamos evoluir para conseguir:
- “lucro estimado” (baseado no rate)
- “lucro real” (baseado no charge retornado pela API quando disponível)
- histórico, status e auditoria

1) Migração SQL (necessária)
Adicionar colunas em `public.smm_orders` para suportar gestão completa:
- provider_currency (text, nullable)
- provider_charge (numeric, nullable)  — charge retornado pela API (normalmente na moeda do painel)
- provider_status (text, nullable)     — status textual da API (pending/completed/…)
- provider_remains (integer, nullable)
- provider_start_count (integer, nullable)
- last_synced_at (timestamptz, nullable)
- requested_refill_at (timestamptz, nullable)
- provider_refill_id (text, nullable)
- provider_refill_status (text, nullable)
- cancelled_at (timestamptz, nullable)
- meta (jsonb, default '{}'::jsonb) — para salvar payload extra (comments/runs/interval etc) sem quebrar schema
- profit_real_brl (numeric, nullable) — quando houver charge, lucro real = price_brl - charge_brl_convertido (se mesma moeda, ou armazenar raw e calcular apenas se BRL)

Observação importante: como a API pode retornar currency/charge em outra moeda, podemos começar “sem conversão” (armazenar raw charge+currency) e manter lucro_real como “disponível só se currency for BRL” ou “se a instalação operar em BRL”. Alternativa é criar uma tabela de câmbio, mas eu não incluiria isso agora sem necessidade.

2) RLS (provavelmente já ok para SELECT do próprio usuário)
- Já existe policy de SELECT do próprio user em smm_orders.
- Para INSERT/UPDATE de pedidos: faremos via Edge Function usando Service Role, então não dependemos de permitir escrita via client (mais seguro).

3) Hook(s) novos no frontend
- `useSmmOrders()`:
  - query listando últimos pedidos do usuário (order by created_at desc, limit 50/100)
  - query de agregados para relatório (sum(profit_brl), sum(price_brl), count, por range de datas)
  - mutations chamando Edge Function `smm-orders` para:
    - createOrder
    - refreshStatus (um pedido)
    - refreshStatuses (lote)
    - requestRefill
    - cancelOrders

Parte C — Status, refill e cancel no painel (completo)
1) Expandir `smm-panel` (proxy) para suportar:
- action: "refill" (payload: order | orders)
- action: "refill_status" (payload: refill | refills)
- action: "cancel" (payload: orders)
- action: "status" suportar tanto order quanto orders

2) Criar Edge Function `smm-orders` (orquestrador seguro)
Endpoints/ações sugeridas (body.action):
- create:
  - input: serviceId, link, quantity, comments?, runs?, interval?
  - fluxo:
    1) validar usuário
    2) buscar pricing_settings (markup_percent)
    3) buscar o serviço (via smm-panel/services ou callSmmApi('services') e localizar serviceId)
    4) calcular provider_cost_brl (rate/1000*qty) e final price
    5) debitar wallet (wallet_debit(user, finalPrice, reference_type='smm_order', reference_id=orderId))
    6) inserir smm_orders (pending)
    7) chamar Instaluxo action add
    8) atualizar smm_orders (submitted + provider_order_id + provider fields se vierem)
    9) em erro: wallet_credit refund + status=failed/refunded
- status:
  - input: orderId (nosso UUID) ou provider_order_id
  - chama Instaluxo status, atualiza provider_status/charge/remains/start_count/currency/last_synced_at
- status_multi:
  - input: array de provider_order_id
  - chama Instaluxo status (orders=1,2,3) e atualiza em lote
- refill:
  - input: orderId (nosso UUID)
  - chama Instaluxo refill (order=provider_order_id), salva provider_refill_id + requested_refill_at
- refill_status:
  - input: refillId(s) e atualiza provider_refill_status
- cancel:
  - input: orderId(s)
  - chama Instaluxo cancel(orders=...), marca cancelled_at

Observação: nem todo serviço aceita refill/cancel. A API retorna erro; a UI deve mostrar a mensagem e desabilitar ações quando o serviço indicar refill/cancel=false (essas flags já existem no tipo SmmService).

3) UI “Meus pedidos” no /engajamento
- Tabela com colunas:
  - Data, Serviço, Quantidade, Preço (créditos), Lucro (estimado), Status (badge), Provider Order ID
- Ações por linha:
  - “Atualizar status”
  - “Refill” (se refill=true)
  - “Cancelar” (se cancel=true e status permitir)
- Ação em lote:
  - selecionar pedidos e “Atualizar status (lote)” para reduzir chamadas

4) UI “Relatórios” no /engajamento
- Cards:
  - Lucro estimado (soma profit_brl)
  - Total vendido (soma price_brl)
  - Total de pedidos
- Filtro rápido:
  - Hoje / 7 dias / 30 dias / Mês atual
- Export:
  - Exportar CSV (usando util já existente ou criar uma função simples) com pedidos do período

Sequência de implementação (dependências)
1) Conferir tabelas e colunas atuais (já confirmado que `smm_orders` existe) e criar migração para novas colunas + índices (ex.: index em (user_id, created_at desc), index em provider_order_id).
2) Atualizar Edge Function `smm-panel` (proxy) para refill/refill_status/cancel e status multi.
3) Criar Edge Function `smm-orders` para compra segura + status/refill/cancel com persistência em `smm_orders` e débito/estorno.
4) Frontend:
   - Ajustar /engajamento:
     - Tabs
     - Form com campos dinâmicos (comments / dripfeed)
     - Bloqueio por saldo (walletQuery.credits < finalPrice)
   - Criar painel “Meus pedidos”
   - Criar painel “Relatórios” com agregações e export
5) Observabilidade:
   - Log estruturado nas Edge Functions (já existe log no smm-panel)
   - Adicionar mensagens de erro padronizadas para UI (toast com detalhe)

Casos especiais e “pegadinhas” que vamos tratar
- Serviços “Custom Comments”: exigir textarea `comments` (linhas separadas).
- Serviços “Drip-feed”: exibir runs/interval e validar números > 0 quando preenchidos.
- Serviços tipo “Package”: alguns não exigem quantity; a API aceita sem quantity. Vamos permitir quantity opcional quando o serviço indicar isso (heurística: se min/max estiver vazio e type sugerir package, ou permitir “quantity” opcional com validação condicional).
- Moeda/charge: armazenar charge e currency como veio; lucro “real” só se currency for BRL (ou deixar como “lucro real (quando disponível)”).
- Segurança: toda criação/cancel/refill deve ser server-side; o client nunca decide preço final.

O que você verá no final (resultado esperado)
- Você muda o markup no /carteira (admin) e imediatamente:
  - o “Preço final” e o “Lucro estimado” mudam no /engajamento
  - o botão de compra passa a cobrar o preço final (créditos)
- Cada pedido fica registrado em “Meus pedidos”, com:
  - status atualizável
  - refill/cancel quando disponível
- Em “Relatórios” você consegue “tirar seu lucro” no sentido de:
  - ver total de lucro por período
  - exportar a lista de pedidos e lucro
  - acompanhar lucro real quando a API informar charge

Checklist técnico (para eu implementar em modo default)
- SQL migration: alterar `smm_orders` + índices.
- Edge Functions: atualizar `smm-panel`; adicionar `smm-orders`.
- Hooks: `useSmmOrders` (novo) + ajustes em `useSmmPanel` (status/refill/cancel).
- Página: `src/pages/Engajamento.tsx` com Tabs e novos painéis.
