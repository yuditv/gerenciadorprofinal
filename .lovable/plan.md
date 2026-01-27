
Objetivo
- Criar um sistema de “carteira” (créditos) para o usuário logado recarregar via PIX (Mercado Pago) e gastar esses créditos ao criar pedidos no Engajamento.
- Implementar markup percentual para calcular o preço final do serviço (seu lucro = preço final - custo da API).
- Regras confirmadas:
  - Quem recarrega: usuário logado
  - Pagamento: PIX Mercado Pago
  - Precificação: markup percentual
  - Moeda interna: créditos
  - Conversão: 1 crédito = R$ 1,00
  - Recarga mínima: R$ 1,00
  - Onde: Página Carteira + mostrar em Engajamento + bloquear pedido sem saldo + mostrar lucro antes de confirmar

O que já existe e vamos reaproveitar
- Já existem secrets Mercado Pago (MERCADO_PAGO_ACCESS_TOKEN) e Service Role (SUPABASE_SERVICE_ROLE_KEY).
- Já existem Edge Functions de Mercado Pago:
  - supabase/functions/mercado-pago-pix (cria PIX e salva em subscription_payments)
  - supabase/functions/mercado-pago-webhook (processa webhooks e confirma pagamentos, já valida na API do MP)
- Já existe padrão de “PIX dialog” no front (GeneratePIXDialog) para inspirar UI e polling.

Arquitetura proposta (alto nível)
1) Banco (Supabase)
- Guardar saldo e histórico de movimentações (ledger).
- Guardar recargas PIX pendentes/pagas (para conciliar com webhook/check).
- Guardar configuração de markup do usuário.
- Guardar pedidos SMM e seus valores (custo, preço, lucro) para auditoria.

2) Edge Functions
- Nova Edge Function para recarga: wallet-pix
  - action=create: cria um pagamento PIX no Mercado Pago e grava em wallet_topups
  - action=check: consulta o pagamento no Mercado Pago e, se aprovado, credita o saldo
- Ajustar o webhook existente mercado-pago-webhook para também reconhecer pagamentos de wallet_topups (mesmo external_id) e creditar saldo automaticamente, sem depender do “check” manual.
- Ajustar o smm-panel (ou criar uma função específica “smm-order”) para:
  - Validar saldo
  - Calcular preço final (com markup) e créditos necessários
  - Debitar créditos e registrar pedido
  - Chamar a API do painel (Instaluxo) para criar o pedido
  - Em caso de falha externa, estornar créditos automaticamente e registrar estorno no ledger

3) Frontend (React)
- Criar página “Carteira”:
  - Mostra saldo de créditos (e equivalente em R$)
  - Mostra histórico (recargas e gastos)
  - Permite configurar markup percentual (ex.: 50%)
  - Botão “Recarregar” -> modal com valor em R$ -> gera PIX -> exibe QR + copiar código -> acompanha status
- Engajamento:
  - Mostrar saldo de créditos (além do saldo do painel SMM, se quiser manter ambos)
  - Ao selecionar serviço e quantidade:
    - Mostrar custo do painel (rate por 1000 -> custo estimado)
    - Mostrar preço final com markup
    - Mostrar lucro estimado
    - Mostrar créditos necessários
  - Bloquear “Criar pedido” se créditos insuficientes e mostrar quanto falta + CTA “Recarregar”

Detalhamento do Banco de Dados (migrations)
A) Tabelas novas
1) user_wallets
- user_id (uuid, PK)
- credits (numeric, default 0)
- updated_at / created_at

2) wallet_transactions (ledger)
- id (uuid PK)
- user_id (uuid)
- type (text) valores: topup | spend | refund | adjust
- credits (numeric) positivo/negativo (ex.: +10 topup, -2 spend)
- amount_brl (numeric, nullable) para recargas (R$)
- reference_type (text, ex.: 'wallet_topup' | 'smm_order')
- reference_id (uuid/text) para linkar a origem
- created_at

3) wallet_topups
- id (uuid PK)
- user_id (uuid)
- amount_brl (numeric)
- credits (numeric) (igual amount_brl, já que 1 crédito = R$1)
- status (text): pending | paid | expired | failed
- external_id (text) -> id do Mercado Pago
- pix_code (text nullable)
- pix_qr_code (text nullable)
- expires_at (timestamptz)
- paid_at (timestamptz nullable)
- created_at / updated_at

4) user_pricing_settings (ou smm_pricing_settings)
- user_id (uuid PK)
- markup_percent (numeric, default 0)
- updated_at / created_at

5) smm_orders
- id (uuid PK)
- user_id (uuid)
- service_id (int)
- service_name (text)
- quantity (int)
- link (text)
- provider_rate_per_1000 (numeric) (do painel)
- provider_cost_brl (numeric) (custo calculado)
- markup_percent (numeric)
- price_brl (numeric) (preço final)
- credits_spent (numeric)
- profit_brl (numeric)
- provider_order_id (text/int nullable)
- status (text): pending | submitted | failed | refunded
- error_message (text nullable)
- created_at

B) RLS (segurança)
- Ativar RLS em todas as tabelas acima.
- Policies:
  - user_wallets: SELECT somente onde user_id = auth.uid(); bloquear UPDATE/INSERT/DELETE pelo client (somente service role via edge function).
  - wallet_transactions: SELECT somente do próprio user; INSERT somente via service role (ou via edge function usando service role).
  - wallet_topups: SELECT somente do próprio user; INSERT somente via edge function (service role), UPDATE somente via edge function.
  - user_pricing_settings: SELECT/UPSERT/UPDATE somente do próprio user (aqui pode deixar o usuário alterar markup pelo front com RLS permissiva para o próprio user).
  - smm_orders: SELECT do próprio user; INSERT/UPDATE preferencialmente via edge function.

Observação importante
- Como o app já usa autenticação (ProtectedRoute), as policies com auth.uid() funcionam. A parte sensível (creditar/debitar) ficará em Edge Functions com service role, evitando que o front “invente saldo”.

Edge Functions (implementação)
1) Nova: supabase/functions/wallet-pix/index.ts
- CORS + OPTIONS
- Validar usuário via JWT (padrão seguro: supabase.auth.getClaims(token) com ANON KEY, como no smm-panel, ou supabase.auth.getUser(token) via service role — vamos padronizar para getClaims, mas manteremos coerente com o que já existe)
- action=create
  - validar amount_brl >= 1
  - credits = amount_brl
  - criar pagamento no Mercado Pago (pix) com date_of_expiration (ex.: 30 min)
  - salvar wallet_topups com external_id + pix_code + pix_qr_code + status pending
  - retornar dados para o front
- action=check
  - buscar wallet_topups do user
  - consultar Mercado Pago /v1/payments/{external_id}
  - se approved e ainda não paid:
    - marcar wallet_topups paid + paid_at
    - upsert em user_wallets somando credits
    - inserir wallet_transactions (type=topup, credits=+X, amount_brl, reference)
  - retornar status atualizado

2) Ajuste: supabase/functions/mercado-pago-webhook/index.ts
- Hoje ele:
  - valida webhook consultando MP
  - processa subscription_payments
  - processa client_pix_payments
- Vamos adicionar um bloco “terceiro”:
  - procurar por wallet_topups onde external_id = paymentId
  - se existir e status != paid:
    - atualizar para paid
    - creditar user_wallets
    - inserir wallet_transactions (topup)
- Resultado: mesmo que o usuário não clique em “verificar”, o saldo entra automático quando o MP bater o webhook.

3) Ajuste no fluxo de pedido SMM (recomendado)
- Para evitar que o front possa criar pedido sem saldo ou manipular preço, a cobrança deve ser server-side.
Opção A (mais segura): criar uma nova Edge Function “smm-order” e deixar o front chamar ela para criar pedido.
- A função faria:
  1) Validar usuário
  2) Carregar service do services list (ou receber rate/confirmar via cache) e markup_percent do usuário
  3) Calcular:
     - provider_cost_brl (rate/1000 * qty)
     - price_brl = provider_cost_brl * (1 + markup_percent/100)
     - credits_needed = arredondamento (definir regra: 2 casas decimais; como crédito=R$1, vamos usar 2 casas e permitir saldo fracionado)
     - profit = price_brl - provider_cost_brl
  4) Verificar user_wallets.credits >= credits_needed
  5) Debitar credits e registrar wallet_transactions (spend)
  6) Criar smm_orders status=pending
  7) Chamar Instaluxo (action=add) para criar pedido real
  8) Se sucesso:
     - atualizar smm_orders status=submitted + provider_order_id
  9) Se falha:
     - atualizar smm_orders status=failed
     - estornar credits (wallet_transactions refund + update user_wallets)
     - marcar smm_orders status=refunded (ou refund flag)
- Essa abordagem elimina fraude e mantém histórico.

Frontend (implementação)
1) Nova página: src/pages/Wallet.tsx (nome pode ser Carteira.tsx)
- Cards:
  - Saldo atual (créditos)
  - Configuração de markup (input % + salvar)
  - Recarregar (modal PIX)
  - Histórico (tabela paginada simples) com tipo, créditos, valor, data, referência

2) Hook(s)
- useWallet:
  - query saldo (user_wallets)
  - query histórico (wallet_transactions)
- useWalletTopup:
  - mutation create -> supabase.functions.invoke('wallet-pix', { action:'create', amount })
  - mutation check / polling -> invoke action:'check'
- usePricingSettings:
  - carregar/salvar markup_percent (user_pricing_settings)

3) Engajamento (src/pages/Engajamento.tsx)
- Mostrar saldo de créditos no topo/ao lado do card “Saldo” (podemos adicionar um card pequeno ou um row dentro).
- Na seção “Criar pedido”:
  - Exibir:
    - Custo (provider_cost)
    - Markup aplicado (%)
    - Preço final
    - Lucro estimado
    - Créditos necessários
  - Bloqueio:
    - Se credits < credits_needed: desabilitar botão + mostrar aviso + botão “Recarregar” que leva à página Carteira ou abre modal.
- A ação “Criar pedido” deixará de chamar addOrder direto e passará a chamar a nova edge function “smm-order” (ou, se mantivermos smm-panel, criaremos uma action “add_with_billing” lá — mas é melhor separar para manter o smm-panel simples).

4) Navegação
- Adicionar rota protegida no App.tsx: /carteira (ou /wallet)
- Adicionar item no FloatingSidebar (ou no menu do usuário) para acessar “Carteira”.
  - Como a sidebar hoje mistura “sections” e “routes”, vamos seguir o padrão do “Engajamento”: item que navega direto.

Regras de arredondamento (definir claramente para evitar briga de centavos)
- provider_cost_brl: calculado com 2 casas (rate e qty)
- price_brl: 2 casas
- credits_needed: igual ao price_brl (1 crédito = R$1), pode ser fracionado (ex.: 1.99 créditos)
- Se você preferir só crédito inteiro, a gente arredonda para cima (ceil). Mas como você quer 1,99 vs 0,99, crédito fracionado resolve perfeitamente.

Checklist de implementação (ordem)
1) Criar migrations com tabelas + RLS policies
2) Criar edge function wallet-pix
3) Atualizar mercado-pago-webhook para wallet_topups
4) Criar edge function smm-order (cobrança + pedido + estorno)
5) Front:
   - Página Carteira
   - Hooks de carteira e markup
   - Ajustar Engajamento para mostrar preço/lucro/créditos e bloquear sem saldo
   - Trocar criação de pedido para chamar smm-order
   - Adicionar rota e item de navegação
6) Testes rápidos:
   - Gerar PIX de R$1, pagar, confirmar saldo via webhook e via check manual
   - Tentar criar pedido sem saldo (bloqueia)
   - Criar pedido com saldo suficiente (debita, registra histórico)
   - Simular falha no painel SMM (estorno automático)

Riscos e como vamos tratar
- Concorrência (2 pedidos ao mesmo tempo): como o debit fica no backend, reduz risco. Para ficar “100%”, podemos usar uma RPC (função SQL) para debitar atomicamente; se necessário, implementamos depois.
- Webhook duplicado: vamos garantir idempotência verificando status != paid antes de creditar.
- Pagamento aprovado depois de expirar localmente: webhook ainda credita; o status “expired” será atualizado para “paid” se MP aprovou.

Entregáveis visíveis para você
- Página “Carteira” com recarga PIX (QR + copiar código) e histórico.
- Engajamento cobrando em créditos, mostrando custo, preço final e lucro.
- Criação de pedido bloqueada sem créditos.
- Saldo atual sempre atualizado (via query + webhook/poll).

Links úteis (quando formos implementar)
- Edge Functions: https://supabase.com/dashboard/project/tlanmmbgyyxuqvezudir/functions
- Logs do webhook: https://supabase.com/dashboard/project/tlanmmbgyyxuqvezudir/functions/mercado-pago-webhook/logs
- SQL Editor (migrations): https://supabase.com/dashboard/project/tlanmmbgyyxuqvezudir/sql/new
