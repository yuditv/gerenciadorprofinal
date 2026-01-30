
Objetivo: verificar e garantir que o “envio automático de renovação” esteja realmente funcionando (criar lembretes + enviar WhatsApp automaticamente), respeitando a configuração `auto_send_enabled`.

Diagnóstico rápido do que existe hoje (pela base do código):
1) Existe o Edge Function `renewal-reminder-scheduler` que:
   - roda para usuários com `notification_settings.whatsapp_reminders_enabled = true`
   - cria registros em `scheduled_messages` com `status: "pending"` e `scheduled_at` “agora” (envio imediato)
   - porém, ele NÃO envia WhatsApp por si só; ele só “agenda” criando pendências
2) Existe o Edge Function `scheduled-dispatcher` que:
   - busca `scheduled_messages` pendentes (status pending e scheduled_at <= now)
   - pega a instância conectada do usuário em `whatsapp_instances`
   - envia via UAZAPI e marca como `sent` ou `failed`
3) Falta o elo principal para “automático de verdade”:
   - há cron agendado para o `renewal-reminder-scheduler` (migração `20260123044654...`)
   - NÃO há cron agendado para o `scheduled-dispatcher`
   - na prática, as mensagens podem estar ficando “pendentes” e só enviam se alguém disparar manualmente (ex.: por UI chamando `triggerDispatcher()`), o que dá a sensação de “não funciona”.

Plano de correção (para ficar 100% automático):
A) Ajustar regra para respeitar `auto_send_enabled`
   1. Atualizar `renewal-reminder-scheduler` para buscar apenas usuários com:
      - `whatsapp_reminders_enabled = true` E
      - `auto_send_enabled = true`
   2. Motivo: você escolheu “Respeitar auto_send”. Assim:
      - se auto_send estiver desligado, o sistema não cria mensagens pendentes (evita disparo automático inesperado)
   3. Adicional (boa prática): logar claramente quantos usuários foram pulados por `auto_send_enabled=false`.

B) Criar um cron job para rodar o `scheduled-dispatcher` “quase em tempo real”
   1. Criar agendamento no `pg_cron` para executar a cada 5 minutos (ex.: `*/5 * * * *`)
      - Isso garante que qualquer `scheduled_messages` criado pelo scheduler (ou por qualquer outro lugar) será enviado rapidamente.
   2. Implementação:
      - Usar `cron.schedule(...)` + `net.http_post(...)` apontando para:
        `https://tlanmmbgyyxuqvezudir.supabase.co/functions/v1/scheduled-dispatcher`
      - Com header Authorization Bearer (anon key) como já foi feito no cron do renewal-reminder.
   3. Observação importante: esse agendamento é “dado/configuração do projeto”, então deve ser aplicado via SQL “de insert/configuração” (não é mudança estrutural de tabela).

C) (Opcional, mas recomendado) Tornar o `scheduled-dispatcher` mais robusto e seguro
   1. Evitar marcar como failed permanentemente quando “não tem instância conectada”:
      - hoje ele marca `failed` se não existir instância conectada; isso pode “matar” a mensagem mesmo que a instância conecte depois.
      - alternativa: marcar como `pending` e adicionar um campo `last_error`/`attempts` (isso exigiria mudança de schema), ou manter `pending` e só registrar erro em `notification_history`.
   2. Garantir compatibilidade com endpoint UAZAPI:
      - o dispatcher usa `${uazapiUrl}/send/text` com payload `{ number, text }`
      - outros lugares do projeto usam outros endpoints (ex.: `/sendText` com `{ phone, message }`)
      - confirmar qual é o formato correto do seu UAZAPI atual e padronizar (isso evita “funciona às vezes / não funciona”).
   3. Ajustar CORS headers para o padrão completo do projeto (não é obrigatório para cron, mas bom para chamadas via painel).

D) Validar funcionamento com testes reais (passo a passo)
   1. Criar/selecionar 1 cliente com `expires_at` caindo em uma das janelas (ex.: amanhã) e WhatsApp válido.
   2. Garantir que o usuário dono tenha:
      - `notification_settings.whatsapp_reminders_enabled = true`
      - `notification_settings.auto_send_enabled = true`
      - uma instância em `whatsapp_instances` com `status="connected"` e `instance_key` preenchido
   3. Rodar manualmente para validar pipeline:
      - invocar `renewal-reminder-scheduler` e confirmar criação de registros em `scheduled_messages` (status pending)
      - invocar `scheduled-dispatcher` e confirmar envio + status sent
   4. Depois, aguardar o cron (5 min) e confirmar que dispara sozinho.

O que eu vou implementar quando você clicar em “Implement plan”:
1) Editar `supabase/functions/renewal-reminder-scheduler/index.ts`:
   - filtrar por `auto_send_enabled = true` além de `whatsapp_reminders_enabled = true`
   - melhorar logs para diagnosticar
2) Criar o cron do dispatcher via SQL (usando a abordagem correta de “configuração”, não schema)
   - nome do job: `scheduled-dispatcher-every-5-min`
   - schedule: `*/5 * * * *`
   - target: `functions/v1/scheduled-dispatcher`
3) Testar os Edge Functions para confirmar:
   - `scheduled_messages` indo de pending -> sent
   - `notification_history` registrando os envios
   - logs do edge function sem erros recorrentes

Resultado esperado:
- Todo dia 09:00 o scheduler cria as mensagens de renovação (somente para quem está com auto_send ligado).
- Em até 5 minutos, o dispatcher envia automaticamente pelo WhatsApp, sem precisar apertar nada.
