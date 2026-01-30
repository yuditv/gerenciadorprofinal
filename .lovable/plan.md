
Objetivo (o que vai acontecer)
- No dia do vencimento (HOJE), quando a automação enviar a mensagem para o cliente, ela já vai incluir:
  1) a mensagem de renovação,
  2) o QR Code do PIX (imagem),
  3) o “copia e cola” do PIX (código).
- Quando o cliente pagar:
  1) o sistema identifica automaticamente via webhook do Mercado Pago,
  2) renova automaticamente o plano do cliente (com base no plano do cliente e no valor esperado),
  3) envia uma notificação para você via WhatsApp usando Configurações > Notificações do Dono.

Como está hoje (diagnóstico rápido)
- `renewal-reminder-scheduler` cria registros em `scheduled_messages` e o `scheduled-dispatcher` envia somente texto via WhatsApp.
- Já existe Edge Function `generate-client-pix-v2` que cria PIX usando o Access Token do próprio usuário e grava em `client_pix_payments`.
- O webhook `mercado-pago-webhook` processa pagamentos aprovados, inclusive `client_pix_payments`, mas hoje ele valida o pagamento no Mercado Pago usando o token global `MERCADO_PAGO_ACCESS_TOKEN` — isso pode falhar para PIX criados com tokens individuais (cada usuário).

Mudanças necessárias (alto nível)
A) Automação: gerar PIX automaticamente no momento do envio da mensagem
B) Envio: mandar QR Code como mídia + depois mandar texto com código copia/cola
C) Pagamento: webhook validar e processar o pagamento usando o token do próprio usuário (credencial individual)
D) Renovação: estender o vencimento do cliente corretamente (e registrar histórico)
E) Notificação: avisar você via WhatsApp (Notificações do Dono)

1) Banco de dados (migrations)
1.1. Ajustar `client_pix_payments` para suportar renovação automática com rastreio melhor
- Adicionar colunas (todas opcionais para não quebrar dados antigos):
  - `client_id` (uuid, referencia `clients.id`) para ligar o pagamento a um cliente específico
  - `expected_plan` (text) e/ou `expected_plan_label` (text) para registrar o plano esperado no momento da cobrança
  - `renewal_applied_at` (timestamptz) para marcar quando a renovação foi aplicada automaticamente
  - `renewal_error` (text) para guardar motivo caso falhe (ex.: credencial faltando, cliente não encontrado)
- Índices recomendados:
  - índice em `client_pix_payments(external_id)` (se ainda não existir/garantir performance)
  - índice em `client_pix_payments(user_id, client_id, status, expires_at)` para reuso de cobranças pendentes

1.2. Garantir que a renovação fique registrada
- Se já existir `renewal_history` (você tem no front), garantir que o webhook insira um registro quando renovar via PIX:
  - `client_id`, `user_id`, `plan`, `previous_expires_at`, `new_expires_at`

2) Edge Function: `generate-client-pix-v2` (melhorias)
2.1. Normalizar QR Code base64
- Hoje `pix_qr_code` pode estar vindo sem o prefixo `data:image/png;base64,`.
- Ajustar para sempre salvar como `data:image/png;base64,${...}` (igual já é feito em outras funções), para o envio de mídia funcionar consistente.

2.2. Permitir vincular a cobrança ao cliente
- Aceitar `client_id` no payload e salvar em `client_pix_payments.client_id`.
- Salvar também `duration_days` calculado a partir do plano do cliente (ver item 3).

3) Edge Function: `renewal-reminder-scheduler` (gerar PIX + agendar mensagem)
Você escolheu:
- Quando enviar: No dia (HOJE)
- Valor do PIX: Preço do cliente (`clients.price`)
Então a lógica ficará:
3.1. Para cada cliente que vence HOJE:
- Validar se `client.price` existe e é > 0:
  - Se não existir: mandar somente a mensagem normal (sem PIX) e registrar log/notification_history como “sem preço”.
- Se existir:
  - Calcular `duration_days` baseado no `clients.plan`:
    - monthly → 30
    - quarterly → 90
    - semiannual → 180
    - annual → 365
  - Reusar PIX pendente existente:
    - buscar em `client_pix_payments` o mais recente para esse `client_id` com `status='pending'` e `expires_at > now()`
    - se existir, reaproveitar (evita mandar vários PIX seguidos)
  - Se não existir, criar um novo PIX chamando a lógica do `generate-client-pix-v2` (ou replicar a criação diretamente no scheduler usando o Access Token do usuário):
    - usar o Access Token salvo em `user_payment_credentials` do próprio usuário
    - salvar em `client_pix_payments` com:
      - `client_id`, `client_phone`, `plan_name`, `expected_plan`, `amount`, `duration_days`, `pix_code`, `pix_qr_code`, `external_id`, `status='pending'`, `expires_at`
3.2. Criar o `scheduled_messages` com um tipo específico, por exemplo:
- `message_type = 'renewal_reminder_pix'`
- `message_content` já com:
  - valor (formatado),
  - instrução “escaneie o QR Code”,
  - bloco com o pix copia/cola.
Obs.: O envio do QR Code (imagem) será feito no dispatcher (item 4), buscando no `client_pix_payments`.

4) Edge Function: `scheduled-dispatcher` (enviar QR + texto)
4.1. Se `message_type === 'renewal_reminder_pix'`:
- Antes de enviar, buscar o `client_pix_payments` “ativo” (pending e não expirado) para aquele `client_id` (ou por `user_id + client_phone` como fallback).
- Enviar primeiro a mídia (QR code) via UAZAPI `/send/media` usando `type: "image"`, `file: pix_qr_code`.
- Em seguida, enviar o texto (mensagem + pix_code).
4.2. Manter o comportamento atual para outros tipos de mensagem (só texto).

5) Edge Function: `mercado-pago-webhook` (validar com token correto + renovar + notificar)
Problema atual:
- Ele tenta validar todos os pagamentos no Mercado Pago com `MERCADO_PAGO_ACCESS_TOKEN` global.
- Para PIX criados com tokens individuais, isso pode retornar 404 e impedir o processamento.
Ajuste proposto:
5.1. Primeiro localizar o pagamento no seu banco (por `external_id`) antes de consultar a API do Mercado Pago:
- procurar em `subscription_payments`
- se não achar, procurar em `client_pix_payments`
- se não achar, procurar em `wallet_topups`
5.2. Escolher o token certo para consultar o Mercado Pago:
- Para `client_pix_payments`: buscar `user_payment_credentials.mercado_pago_access_token_enc` do `payment.user_id` e usar esse token para `GET /v1/payments/{id}`.
- Para `subscription_payments` e `wallet_topups`: manter o token global atual (porque são fluxos centralizados).
5.3. Se aprovado:
- Atualizar `client_pix_payments.status='paid'` + `paid_at`
- Renovar cliente:
  - localizar o cliente por `client_id` (preferencial) ou por `user_id + whatsapp`
  - calcular a nova data:
    - `baseDate = max(now, clients.expires_at)`
    - `newExpiresAt = baseDate + duration_days` (ou converter para meses, mas dias resolve e é consistente com o que você já armazena)
  - atualizar `clients.expires_at = newExpiresAt` e manter `clients.plan` como o plano atual
  - inserir em `renewal_history` o registro da renovação automática
- Notificar você (WhatsApp) via Notificações do Dono:
  - chamar internamente a função `send-owner-notification` com:
    - `eventType: 'payment_proof'`
    - `summary`: “PIX aprovado para {cliente} — Valor R$X — Plano {plano} — Renovado até {data}”
    - `contactPhone`: telefone do cliente
    - `conversationId` se estiver disponível no `client_pix_payments.conversation_id`
Obs.: isso respeita quiet hours e anti-spam já existentes.

6) UI (opcional, mas recomendado)
- Em Configurações > Notificações do Dono:
  - garantir que existe uma opção ligada para “pagamento” (hoje é “payment_proof”).
- Em Clientes:
  - garantir que `price` esteja preenchido (porque o valor do PIX sai daí).
- (Opcional) Em histórico do cliente:
  - mostrar entradas de `renewal_history` “Renovado via PIX”.

7) Regras/edge cases importantes
- Se o cliente não tiver `price`, o sistema envia só a mensagem (sem PIX) e registra log (para você identificar e corrigir).
- Se o usuário não tiver credencial do Mercado Pago configurada, o sistema:
  - não gera PIX automático,
  - envia só a mensagem,
  - registra erro no log do scheduler (para debug).
- Reuso de PIX: se já existe cobrança pendente e ainda válida, não cria outra.
- Segurança: o webhook continua retornando 200 sempre (como já faz) para evitar retries infinitos, mas vai logar claramente quando falhar.

8) Sequência de implementação (ordem)
1. Migrations no banco (novas colunas/índices no `client_pix_payments`).
2. Ajustar `generate-client-pix-v2` (QR code data URI + aceitar `client_id`).
3. Ajustar `renewal-reminder-scheduler` para gerar/reusar PIX e criar `scheduled_messages` do tipo `renewal_reminder_pix`.
4. Ajustar `scheduled-dispatcher` para enviar QR code (mídia) + texto quando `renewal_reminder_pix`.
5. Ajustar `mercado-pago-webhook` para:
   - validar com token correto por tipo
   - renovar cliente corretamente
   - chamar `send-owner-notification`
6. Testes ponta-a-ponta (ver checklist abaixo).

9) Checklist de teste (ponta a ponta)
- Preparar um cliente com:
  - `expires_at` = hoje,
  - `price` preenchido,
  - `plan` definido,
  - WhatsApp válido.
- Rodar o scheduler (via cron/execução manual) e confirmar:
  - criou `client_pix_payments` pendente,
  - criou `scheduled_messages` pendente.
- Rodar o dispatcher e confirmar:
  - WhatsApp recebeu imagem (QR) e depois texto (código).
- Simular pagamento (ou fazer um pagamento real de teste) e confirmar:
  - webhook marcou `client_pix_payments` como paid,
  - `clients.expires_at` foi estendido corretamente,
  - `renewal_history` recebeu o registro,
  - você recebeu a notificação via Notificações do Dono.

Links úteis no Supabase (para você acompanhar logs)
- Edge Functions (lista): https://supabase.com/dashboard/project/tlanmmbgyyxuqvezudir/functions
- Logs do webhook: https://supabase.com/dashboard/project/tlanmmbgyyxuqvezudir/functions/mercado-pago-webhook/logs
- Logs do scheduler: https://supabase.com/dashboard/project/tlanmmbgyyxuqvezudir/functions/renewal-reminder-scheduler/logs
- Logs do dispatcher: https://supabase.com/dashboard/project/tlanmmbgyyxuqvezudir/functions/scheduled-dispatcher/logs
- Secrets (para conferir tokens): https://supabase.com/dashboard/project/tlanmmbgyyxuqvezudir/settings/functions
