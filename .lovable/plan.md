
Resumo de como está a recarga de saldo (Engajamento / Carteira)

1) Onde o usuário vê e usa
- No Engajamento (cartão “Saldo”):
  - Mostra “Créditos disponíveis” vindo do hook `useWallet()` (tabela `user_wallets.credits`).
  - Admin vê o botão “Recarregar” que leva para `/carteira`.
- Na página `/carteira`:
  - Mostra saldo em créditos (1 crédito = R$ 1,00) e histórico (`wallet_transactions`).
  - Abre um modal para “Recarregar via PIX”:
    - Você informa o valor (mínimo R$ 1,00).
    - Clica “Gerar PIX” -> cria uma cobrança PIX no Mercado Pago.
    - Exibe QR Code + código copia/cola.
    - Faz polling a cada 8s chamando “Verificar” automaticamente (e tem botão manual “Verificar”).

2) Como o frontend fala com o backend
- O frontend usa `useWalletTopup()` que chama a Edge Function `wallet-pix` via:
  - action="create" com `amount_brl`
  - action="check" com `topup_id`
- O frontend passa o token do usuário no header `Authorization: Bearer <access_token>` (isso é importante para identificar o usuário no backend).

3) O que a Edge Function `wallet-pix` faz
- action="create"
  - Valida valor mínimo
  - Faz `fetch("https://api.mercadopago.com/v1/payments")` com `MERCADO_PAGO_ACCESS_TOKEN` (secret)
  - Se Mercado Pago responde OK:
    - Extrai `pix_code` e `pix_qr_code`
    - Salva um registro em `wallet_topups` com status `pending`
    - Retorna `topup` para o frontend mostrar o QR/code
- action="check"
  - Lê a recarga em `wallet_topups` do usuário
  - Faz `fetch("https://api.mercadopago.com/v1/payments/{external_id}")`
  - Se Mercado Pago diz `approved`:
    - Atualiza `wallet_topups` para `paid`
    - Upsert em `user_wallets` somando os créditos
    - Insere ledger em `wallet_transactions` (type="topup")
    - Retorna `wallet_credits` atualizado

4) Webhook do Mercado Pago (importante)
- Existe também `mercado-pago-webhook`, que valida o pagamento no Mercado Pago e processa alguns fluxos (assinatura, client_pix_payments, etc.).
- Pelo trecho que vimos, ele usa `MERCADO_PAGO_ACCESS_TOKEN` e consulta `GET /v1/payments/{id}` para validar.
- Ou seja: tanto o “create/check” (wallet-pix) quanto o webhook dependem de conseguir chamar a API do Mercado Pago via Edge Functions.

Confirmação: a credencial do Mercado Pago está configurada?
- Sim: existe um Secret chamado **`MERCADO_PAGO_ACCESS_TOKEN`** configurado no projeto.
- Observação importante: o fato do secret existir não garante que:
  1) o valor está correto/ativo (token válido), e/ou
  2) as chamadas de saída do Supabase para o domínio do Mercado Pago estão permitidas (egress/policy).

Sobre o erro “Edge function returned 502: At least one policy returned UNAUTHORIZED.”
O que isso normalmente significa (no contexto Supabase Edge)
- Esse erro não é “RLS do banco” (as operações no banco estão usando Service Role e tendem a passar).
- Esse erro costuma indicar bloqueio pelo “Policy Agent” da infraestrutura ao tentar fazer uma chamada externa (egress), ou alguma regra de rede/segurança negando a requisição.
- No seu caso, o ponto mais provável é o `fetch(...)` para `https://api.mercadopago.com/v1/payments` dentro da `wallet-pix` (e possivelmente também afetando o webhook).

Objetivo do ajuste
- Manter o fluxo de recarga funcionando mesmo quando ocorrer bloqueio/erro do Mercado Pago, e melhorar o diagnóstico para ficar claro se é:
  A) token inválido/sem permissão (401/403 vindo do MP)
  B) bloqueio de egress/policy (erro “At least one policy returned UNAUTHORIZED.”)
  C) WAF/Cloudflare/HTML response (parse JSON falha)
  D) problema momentâneo (timeout / 5xx do MP)

Plano de correção (código + diagnóstico)

Etapa 1 — Confirmar onde o erro acontece (rápido e objetivo)
1.1) Checar logs recentes da Edge Function `wallet-pix` na tentativa de “Gerar PIX”.
- Ver se o erro acontece antes ou depois do `fetch` ao Mercado Pago.
- Se a função nem chega a logar `mpResponse.status`, é forte sinal de bloqueio antes da resposta (policy agent).

1.2) Fazer uma chamada de teste direta para `wallet-pix` (action=create) no ambiente atual e capturar retorno completo.
- Resultado esperado para confirmar:
  - Se 502 com “policy unauthorized” -> egress/policy.
  - Se 401/403 com JSON do MP -> token/permissão.

Etapa 2 — Melhorar robustez do `wallet-pix` (mudanças no código)
2.1) Envolver o `fetch` do Mercado Pago com:
- Timeout via `AbortController` (ex.: 15s, como já foi feito no `smm-panel` em outras partes do projeto).
- Headers mais completos (alguns WAFs ficam menos agressivos):
  - `User-Agent: gerenciadorpro/1.0 (supabase-edge)`
  - `Accept: application/json`
  - manter `Content-Type` e `Authorization`

2.2) Tornar o parsing resiliente
- Hoje faz `await mpResponse.json()` sempre.
- Se o Mercado Pago (ou alguma camada) devolver HTML/texto, isso pode estourar e virar erro genérico.
- Ajuste:
  - ler `const raw = await mpResponse.text()`
  - tentar `JSON.parse(raw)` com try/catch
  - se não for JSON, logar os primeiros caracteres do raw e devolver erro amigável

2.3) Melhorar mensagens de erro retornadas ao frontend
- Quando der erro de policy agent:
  - retornar algo como:
    - `error: "Bloqueio de rede ao acessar Mercado Pago (egress/policy)."`
    - `details: "Supabase Edge não conseguiu sair para api.mercadopago.com. Verifique allowlist/egress no projeto ou use um proxy externo."`
- Quando der 401/403 do MP:
  - `error: "Mercado Pago rejeitou a credencial (token inválido ou sem permissão)."`
- Quando der 5xx:
  - `error: "Mercado Pago indisponível no momento."`

2.4) Aplicar a mesma robustez no “check” (consulta de status)
- Mesmo pacote de melhorias: timeout + parse robusto + mensagens claras.

Etapa 3 — Ajuste no frontend para orientar quando for bloqueio externo
3.1) No modal de recarga (/carteira), se o erro vier com “bloqueio de rede / policy”:
- Mostrar uma mensagem objetiva para você/admin:
  - “O Supabase bloqueou a saída para o Mercado Pago. Isso não é erro de valor/usuário.”
  - “Solução: liberar egress/allowlist para api.mercadopago.com no painel, ou usar um servidor proxy fora do Supabase.”

3.2) Não “travar” a UI
- Se não conseguiu criar PIX, manter o formulário e permitir tentar novamente.

Etapa 4 — Se for realmente egress/policy: solução operacional (fora do código)
4.1) Verificar configurações de rede/egress no Supabase (Projeto)
- Se existir allowlist/Outbound restrictions:
  - permitir domínio `api.mercadopago.com` (e possivelmente `mercadopago.com`).
- Se houver alguma política global impedindo “financial/checkout” providers, isso pode exigir ajuste no projeto.

4.2) Plano B (caso Supabase Edge não consiga mesmo acessar o Mercado Pago)
- Implementar um “proxy” fora do Supabase (ex.: servidor próprio/Vercel/Cloudflare Worker) que:
  - recebe request do `wallet-pix`
  - chama Mercado Pago
  - devolve resposta
- O Supabase Edge chamaria o proxy (se este não estiver bloqueado) e o proxy chama o Mercado Pago.
- Isso é a alternativa mais robusta quando há bloqueio por IP/WAF ou limitações de egress.

Arquivos que serão envolvidos (quando eu puder implementar)
- `supabase/functions/wallet-pix/index.ts`
  - timeout + headers + parse resiliente + mensagens melhores
- `src/pages/Wallet.tsx` (ou onde o modal de recarga trata erros)
  - exibir erro “policy/egress” de forma explícita
- (Opcional) `supabase/functions/mercado-pago-webhook/index.ts`
  - aplicar o mesmo padrão de timeout + parse resiliente, porque o webhook também depende de chamar Mercado Pago

Critérios de aceite (como você valida)
1) Em /carteira -> “Gerar PIX”:
- Em cenário saudável: gera QR + pix_code normalmente.
- Em cenário bloqueado: mostra erro claro de “bloqueio de rede/egress”, não “erro genérico 502”.
2) “Verificar”:
- Se aprovado: credita saldo e aparece no histórico.
- Se MP indisponível: erro amigável e possibilidade de tentar novamente.
3) Engajamento:
- O cartão de créditos atualiza (refetch) depois do crédito confirmado.

Observação sobre sua pergunta (“ver se a credencial está configurada”)
- Está configurada no projeto como secret (`MERCADO_PAGO_ACCESS_TOKEN`).
- O próximo passo é confirmar se o valor é válido e se a infraestrutura permite acesso ao domínio do Mercado Pago; o erro que você reportou aponta mais para bloqueio de saída do que para ausência de secret.
