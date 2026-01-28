
Objetivo
- Fazer o botão “VPN” na Central de Atendimento voltar a funcionar.
- Remover os erros de build atuais (que estão impedindo o deploy/execução das Edge Functions).
- Trocar a geração do teste VPN para usar o mesmo fluxo do seu n8n (via webhook), já que a chamada direta na Servex pode ser bloqueada/instável (Cloudflare/401/etc).

Diagnóstico (o que encontrei)
- O botão “VPN” existe e abre o modal `VPNTestGeneratorDialog` (em `src/components/Inbox/ChatPanel.tsx`), que chama `supabase.functions.invoke('vpn-test-generator')`.
- O build está falhando por erros TypeScript em `supabase/functions/wallet-pix/index.ts` (tipagem “never”), então mesmo que o VPN estivesse certo, o projeto fica quebrado.
- O `supabase/config.toml` foi acidentalmente reduzido para só `project_id = ...`, removendo as seções `[functions.*] verify_jwt = false`. Isso pode quebrar o comportamento esperado das funções.

O que vou implementar (em etapas)

1) Corrigir o build (obrigatório)
1.1) Restaurar `supabase/config.toml`
- Recriar o arquivo completo contendo:
  - `project_id = "tlanmmbgyyxuqvezudir"` como primeira linha (mantendo isso).
  - Todas as seções `[functions.<nome>]` com `verify_jwt = false` que existiam antes (incluindo `wallet-pix` e `vpn-test-generator`).
- Motivo: sem isso, algumas funções podem exigir JWT por padrão e falhar.

1.2) Corrigir a tipagem no Edge Function `wallet-pix`
- Ajustar `supabase/functions/wallet-pix/index.ts` para não inferir tipos “never” no `.from(...)`:
  - Opção A (mais simples e robusta em Edge Functions): tipar o client explicitamente como `any` / `SupabaseClient<any>` para evitar inferência `never`.
  - Garantir que `requireUser` e `creditWalletIfNeeded` aceitem esse tipo sem conflito.
- Atualizar CORS para o padrão do projeto (incluindo `x-supabase-client-platform*`) para prevenir falhas de preflight em browsers.

Resultado esperado da Etapa 1
- Build volta a passar.
- Edge Functions voltam a compilar e rodar.

2) Fazer o botão VPN usar o fluxo do n8n (recomendado)
2.1) Criar/usar segredo(s) para n8n
- Adicionar secrets (Supabase Edge Function Secrets), por exemplo:
  - `N8N_VPN_WEBHOOK_URL` (obrigatório): URL completa do webhook do n8n (Trigger).
  - `N8N_VPN_WEBHOOK_AUTH` (opcional): token/valor de Authorization, caso seu webhook esteja protegido.
- Motivo: não expor URLs/token no frontend e permitir troca sem novo deploy.

2.2) Atualizar a Edge Function `vpn-test-generator`
- Alterar `supabase/functions/vpn-test-generator/index.ts` para:
  - Ler `N8N_VPN_WEBHOOK_URL` (+ `N8N_VPN_WEBHOOK_AUTH` se existir).
  - Fazer `fetch` para o webhook do n8n (provavelmente POST JSON), repassando parâmetros que o seu workflow espera.
  - Incluir logs claros (status code, snippet do body em erro) e manter CORS completo.
- Entrada/Body sugerido para o n8n (ajustável ao seu workflow):
  - `{ "username": "<nome-ou-telefone>", "conversationId": "<id>", "phone": "<telefone>" }`

2.3) Ajustar o modal `VPNTestGeneratorDialog` para mandar contexto
- Hoje o dialog chama `invoke('vpn-test-generator')` sem body.
- Vou atualizar o componente para aceitar dados da conversa e enviar no invoke:
  - Alterar `VPNTestGeneratorDialog` para receber (opcional) `defaultUsername` e `phone` (ou receber a `conversation` inteira).
  - Em `ChatPanel.tsx`, passar `conversation.contact_name || conversation.phone` como `defaultUsername`.
  - No `invoke`, enviar `body: { username: defaultUsername, phone: conversation.phone, conversationId: conversation.id }`.
- Motivo: seu n8n parece gerar com base em campos como “nome/username” (pelos prints).

2.4) Normalizar a resposta para o UI
- Manter o comportamento atual do modal (renderizar campos dinamicamente).
- Se o n8n retornar um formato diferente, vou adicionar um “mapeador” simples para extrair:
  - username/login
  - password/senha
  - expires/validade
  - server/host
  - protocol/tipo
- Se vier uma lista/objeto complexo, o modal já mostra “Copiar Tudo”.

Resultado esperado da Etapa 2
- Clicar “VPN” → gera o teste via n8n → exibe credenciais no modal → botões de copiar funcionam.

3) Estratégia de fallback (caso o n8n falhe)
- Se o webhook do n8n estiver indisponível:
  - Mostrar erro amigável no modal (“serviço temporariamente indisponível”).
  - Logar detalhes na Edge Function para diagnóstico (sem vazar segredo).
- (Opcional) manter um fallback “direto Servex” desativado por padrão — só se você quiser.

4) Testes e validação
4.1) Validar build
- Confirmar que os erros do `wallet-pix` sumiram e o projeto compila.

4.2) Testar Edge Function isolada
- Chamar `vpn-test-generator` via ferramenta de teste (edge function curl) com um body de exemplo e verificar o retorno.

4.3) Testar end-to-end na UI
- Abrir Central de Atendimento → selecionar conversa → clicar “VPN” → “Gerar Novo Teste” → verificar se:
  - não dá erro no toast/modal
  - credenciais aparecem
  - “Copiar Tudo” funciona

Informações que ainda preciso de você (para finalizar a Etapa 2)
- A URL do Webhook do n8n que você usa para “gerar teste VPN” (a URL do Trigger/Webhook do workflow).
- Se ele exige header Authorization ou algum segredo no querystring.
- Qual body ele espera (ex: `{ "username": "..." }`) e um exemplo do JSON de resposta (pode ser print do “OUTPUT” do webhook no n8n).

Se você me passar isso, eu implemento o caminho via n8n e deixo o botão VPN funcionando mesmo quando a Servex estiver bloqueando chamadas diretas.
