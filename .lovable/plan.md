
Objetivo (seguir agora)
Implementar o fluxo completo “Renovação automática via PIX no dia do vencimento” com:
- Scheduler criando/reutilizando cobrança PIX e agendando mensagem especial
- Dispatcher enviando WhatsApp na ordem escolhida: **texto → imagem (QR)** (e opcionalmente um 2º texto com “copia e cola”, se necessário)
- Webhook Mercado Pago validando pagamento com o **token correto (do usuário)** quando for PIX de cliente, aplicando renovação automática e notificando o dono (Owner Notifications)
- Corrigir pontos técnicos pendentes (QR base64 padronizado, reuso de cobrança pendente, registro em renewal_history, etc.)

Status atual confirmado
- Migração do banco já foi aplicada: `client_pix_payments` ganhou `client_id`, `expected_plan`, `expected_plan_label`, `renewal_applied_at`, `renewal_error` + índices.
- Edge functions atuais:
  - `renewal-reminder-scheduler`: hoje só cria `scheduled_messages` tipo `renewal_reminder` (texto).
  - `scheduled-dispatcher`: hoje envia apenas texto via `/send/text`.
  - `generate-client-pix-v2`: cria PIX com token individual do usuário, mas não liga ao `client_id` e não normaliza `pix_qr_code` como Data URI.
  - `mercado-pago-webhook`: valida no Mercado Pago usando o token global `MERCADO_PAGO_ACCESS_TOKEN` (isso falha para PIX gerados por tokens individuais) e o handler de client PIX hoje “cadastra/atualiza cliente” de um jeito que não segue a regra de renovação (baseDate = max(now, expires_at)).

Decisões que você escolheu (vou implementar assim)
1) Validação do PIX: **Renovar mesmo se diferente** (ou seja, não vamos bloquear renovação se valor divergir; apenas registrar/logar para auditoria).
2) Ordem de envio no WhatsApp: **Texto depois imagem**.

Escopo das mudanças (o que será alterado)
A) Edge Function `generate-client-pix-v2`
1. Aceitar `client_id` no body e persistir em `client_pix_payments.client_id`.
2. Persistir também:
   - `expected_plan` e/ou `expected_plan_label` (com base no plano atual do cliente)
   - `duration_days` coerente com o plano
3. Normalizar `pix_qr_code`:
   - se vier base64 “cru” do Mercado Pago, salvar como `data:image/png;base64,${base64}`
4. Robustez Mercado Pago (mitigação de egress/PolicyAgent já usada em `wallet-pix`):
   - usar `AbortController` (timeout ~15s)
   - setar headers `Accept: application/json` e `User-Agent: gerenciadorpro/1.0 (supabase-edge)`
   - ler `response.text()` e só depois tentar `JSON.parse` (para lidar com HTML/WAF)

B) Edge Function `renewal-reminder-scheduler`
1. Continuar elegibilidade atual (whatsapp_reminders_enabled=true e auto_send_enabled=true), e continuar “só no dia” (0 dias).
2. Para cada cliente vencendo HOJE:
   - se `client.price` não existir ou for <= 0:
     - manter comportamento atual: agenda `scheduled_messages` tipo `renewal_reminder` (texto padrão)
     - registrar log claro (para você saber que faltou preço)
   - se tiver preço:
     - calcular `duration_days` por plano (monthly=30, quarterly=90, semiannual=180, annual=365)
     - tentar reutilizar cobrança pendente ainda válida:
       - buscar em `client_pix_payments` por `user_id + client_id` com `status='pending'` e `expires_at > now()`, ordenar desc e pegar 1
     - se não existir cobrança pendente válida:
       - gerar uma nova cobrança PIX usando o token individual do usuário (de `user_payment_credentials.mercado_pago_access_token_enc`)
       - inserir em `client_pix_payments` com:
         - `client_id`, `client_phone`, `amount=client.price`, `duration_days`, `expected_plan`, `expected_plan_label`, `status='pending'`, `expires_at`
     - criar `scheduled_messages` com:
       - `message_type = 'renewal_reminder_pix'`
       - `message_content` contendo:
         - mensagem de renovação (template de “today”)
         - instruções do PIX
         - o “copia e cola” (`pix_code`)
       - `scheduled_at = now()` e `status='pending'`
3. Importante: o scheduler não vai enviar WhatsApp diretamente; ele apenas prepara dados + agenda.

C) Edge Function `scheduled-dispatcher`
1. Detectar `message.message_type === 'renewal_reminder_pix'`
2. Para esse tipo:
   - localizar a cobrança em `client_pix_payments`:
     - preferir `user_id + client_id` (do scheduled_messages)
     - fallback: `user_id + client_phone` (caso algum registro antigo não tenha client_id)
     - exigir `status='pending'` e `expires_at > now()`
   - Envio na ordem escolhida (texto → imagem):
     1) Enviar texto via `/send/text` com:
        - `message_content` já com o copia/cola
     2) Enviar imagem (QR) via `/send/media` com:
        - `{ number, type: "image", file: pix_qr_code }`
        - `pix_qr_code` deve estar no formato Data URI (por isso o ajuste no `generate-client-pix-v2`)
   - Se faltar QR ou faltar pix_code por algum motivo:
     - degradar com elegância (mandar o que tiver) e marcar o scheduled_message como `sent` apenas se pelo menos 1 envio tiver sucesso; caso ambos falhem, marcar `failed`.
3. Para outros tipos de mensagem, manter comportamento atual (somente texto).
4. Logging mais detalhado para debug (IDs de message/client/payment e status de cada envio).

D) Edge Function `mercado-pago-webhook`
1. Ajustar o fluxo para escolher o token correto:
   - Antes de consultar Mercado Pago, localizar o pagamento no seu banco por `external_id`:
     1) `subscription_payments`
     2) `client_pix_payments`
     3) `wallet_topups`
   - Definir o access token a usar no GET /v1/payments/{id}:
     - subscription_payments: token global `MERCADO_PAGO_ACCESS_TOKEN`
     - wallet_topups: token global `MERCADO_PAGO_ACCESS_TOKEN`
     - client_pix_payments: token do dono do pagamento:
       - buscar `user_payment_credentials.mercado_pago_access_token_enc` pelo `payment.user_id`
2. Apenas se Mercado Pago retornar `status === 'approved'`:
   - Para `client_pix_payments`:
     - marcar como `paid` (se ainda não estiver) + `paid_at`
     - aplicar renovação automática no cliente:
       - localizar cliente por `client_id` (preferencial)
       - calcular:
         - `baseDate = max(now, clients.expires_at)`
         - `newExpiresAt = baseDate + duration_days` (em dias)
       - atualizar `clients.expires_at = newExpiresAt`
       - inserir `renewal_history`:
         - client_id, user_id, plan, previous_expires_at, new_expires_at
       - atualizar `client_pix_payments`:
         - `renewal_applied_at = now()` em caso de sucesso
         - `renewal_error = ...` em caso de falha (ex.: cliente não encontrado)
     - notificar o dono via `send-owner-notification`:
       - chamada interna (service role Bearer) com:
         - eventType: `payment_proof`
         - contactPhone: whatsapp do cliente
         - contactName (se disponível)
         - summary: “PIX aprovado — {cliente} — R$X — Renovado até {data}”
         - conversationId se existir em `client_pix_payments`
3. Reprocessamento/idempotência:
   - se `client_pix_payments.status` já for `paid` e `renewal_applied_at` já existir, não renovar de novo.
4. Robustez e padrões do projeto:
   - manter comportamento “sempre retornar 200” para evitar retries infinitos do Mercado Pago, mas logar claramente o erro.
   - adicionar mitigação de egress (headers, timeout, parse resiliente) igual ao `wallet-pix` quando fizer chamadas ao Mercado Pago.

E) Correção importante de qualidade (types do Supabase no front)
- Foi alterado `src/integrations/supabase/types.ts` no diff anterior, mas esse arquivo é “auto gerado / não editar”.
- Na implementação eu vou:
  - reverter esse arquivo para evitar drift (e respeitar a regra),
  - ajustar qualquer código TypeScript que precise dos novos campos usando `as any`/tipos locais (ou uma tipagem auxiliar segura), sem depender de mexer no arquivo gerado.

Sequência de implementação (ordem)
1) Ajustar `generate-client-pix-v2` (client_id + data URI + robustez MP).
2) Ajustar `renewal-reminder-scheduler` para:
   - calcular valor/duração
   - reutilizar/gerar cobrança PIX
   - criar `scheduled_messages` tipo `renewal_reminder_pix`
3) Ajustar `scheduled-dispatcher` para:
   - enviar “texto → imagem QR” quando `renewal_reminder_pix`
4) Refatorar `mercado-pago-webhook` para:
   - localizar pagamento no DB antes
   - consultar MP com token correto (principalmente para client_pix_payments)
   - aplicar renovação + renewal_history + owner notification
5) Ajuste técnico: reverter `src/integrations/supabase/types.ts` e acomodar tipagens sem editar arquivo gerado.
6) Testes ponta-a-ponta + logs

Checklist de teste (ponta a ponta)
1) Preparar um cliente:
   - expires_at = hoje
   - plan = monthly/quarterly/semiannual/annual
   - price preenchido
   - whatsapp válido
2) Rodar `renewal-reminder-scheduler`:
   - deve criar 1 registro em `client_pix_payments` (ou reutilizar um pending válido)
   - deve criar 1 registro em `scheduled_messages` com `message_type='renewal_reminder_pix'`
3) Rodar `scheduled-dispatcher`:
   - WhatsApp deve receber:
     - primeiro o texto com instruções + copia e cola
     - depois a imagem do QR
4) Aprovar o pagamento no Mercado Pago (teste real ou sandbox conforme você usa):
   - webhook deve:
     - marcar `client_pix_payments` como paid
     - atualizar `clients.expires_at` corretamente (baseDate = max(now, antigo))
     - inserir `renewal_history`
     - preencher `renewal_applied_at` (e não duplicar em reprocessamento)
     - disparar `send-owner-notification`
5) Conferir logs:
   - `renewal-reminder-scheduler`
   - `scheduled-dispatcher`
   - `mercado-pago-webhook`
   - `send-owner-notification`

Riscos / pontos de atenção
- Egress/PolicyAgent: já vimos que pode bloquear chamadas ao Mercado Pago; por isso vou padronizar a estratégia robusta (headers + timeout + parse resiliente) também nos pontos que ainda fazem fetch “cru”.
- UAZAPI: envio de mídia exige que `pix_qr_code` esteja num formato aceito (Data URI tem funcionado no `wallet-pix`).
- Idempotência no webhook: essencial para não renovar duas vezes se o Mercado Pago reenviar eventos.

Links operacionais (para você acompanhar)
- Edge Functions: https://supabase.com/dashboard/project/tlanmmbgyyxuqvezudir/functions
- Logs webhook: https://supabase.com/dashboard/project/tlanmmbgyyxuqvezudir/functions/mercado-pago-webhook/logs
- Logs scheduler: https://supabase.com/dashboard/project/tlanmmbgyyxuqvezudir/functions/renewal-reminder-scheduler/logs
- Logs dispatcher: https://supabase.com/dashboard/project/tlanmmbgyyxuqvezudir/functions/scheduled-dispatcher/logs
- Logs owner notification: https://supabase.com/dashboard/project/tlanmmbgyyxuqvezudir/functions/send-owner-notification/logs
