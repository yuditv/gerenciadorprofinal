
Objetivo
- Fazer a aba **Engajamento** realmente “puxar” (carregar) os serviços do painel SMM (Instaluxo) e preencher a lista + o select em “Criar pedido”.
- Hoje isso não acontece porque as chamadas para a Edge Function `smm-panel` estão dando **“Failed to fetch”** no navegador, então o React Query não recebe dados e a UI fica vazia.

O que já foi observado (diagnóstico rápido)
- O front está chamando corretamente: `supabase.functions.invoke("smm-panel", { body: { action: "services" } })`.
- No Network do navegador aparecem várias tentativas para:
  - `POST https://tlanmmbgyyxuqvezudir.supabase.co/functions/v1/smm-panel`
  - com body `{"action":"services"}`
  - e erro **“Failed to fetch”**.
- Logs da edge function mostram que ela chegou a receber request (`[smm-panel] request from user=...`), mas não temos logs depois disso, o que indica forte chance de:
  1) travar/timeout na chamada externa para `https://instaluxo.com/api/v2`, ou
  2) resposta em formato inesperado (menos provável causar “Failed to fetch”), ou
  3) algum bloqueio/intermitência (TLS/redirect/firewall) ao acessar `instaluxo.com` a partir do ambiente da Edge Function.

Pergunta pendente (você já confirmou que tem)
- Você marcou que tem **JSON de exemplo** do `action=services`. Na implementação, vou usar isso para ajustar o parser (porque muitos painéis SMM retornam formatos diferentes: lista direta, ou objeto com chave `services`, etc.).

Plano de implementação (o que vou mudar quando você aprovar)
1) Teste controlado do endpoint `smm-panel` (para ver o erro real)
   - Vou chamar a Edge Function via ferramenta de teste (server-side), com body:
     - `{"action":"services"}`
     - `{"action":"balance"}`
   - Objetivo: diferenciar “problema de navegador/CORS” vs “problema de execução/fetch externo”.
   - Vou também olhar os logs da edge function imediatamente após o teste, para pegar o stack/erro real.

2) Fortalecer a Edge Function `supabase/functions/smm-panel/index.ts`
   2.1) Adicionar timeout e tratamento de falhas de rede
   - Implementar `AbortController` (ex.: 15s) no `fetch(INSTALUXO_BASE_URL, ...)`.
   - Se der timeout, retornar JSON claro:
     - `{ error: "Timeout ao conectar no painel SMM" }` (status 504)
   - Se der erro de rede/TLS, retornar:
     - `{ error: "Falha ao conectar no painel SMM", details: "...mensagem..." }` (status 502)
   - Motivo: hoje a função provavelmente trava em silêncio; com timeout e catch detalhado a UI vai conseguir exibir o erro.

   2.2) Logging útil (para não ficar “cego”)
   - Logar antes e depois do fetch:
     - action, baseUrl, tempo (ms), status http do Instaluxo, e um pedaço seguro do corpo (sem vazar API key).
   - Exemplo de logs:
     - `[smm-panel] calling instaluxo action=services`
     - `[smm-panel] instaluxo responded status=200 time=532ms`

   2.3) Normalizar URL e evitar pequenas incompatibilidades
   - Garantir que `INSTALUXO_BASE_URL` não tenha “//” no final (normalizar com `replace(/\/+$/, '')`), e manter como `https://instaluxo.com/api/v2`.
   - Isso evita variações de endpoint que alguns painéis tratam mal.

   2.4) Tornar o retorno da Edge Function “padrão do app”
   - Em vez de retornar “qualquer coisa que o painel devolveu”, vou padronizar a resposta para o front:
     - Para `services`: sempre retornar `{ services: SmmService[] }`
     - Para `balance`: `{ balance, currency }`
     - Para erros do painel: `{ error: "..." }`
   - Isso deixa o front simples e resistente a mudanças do provedor.

3) Ajustar o hook do front `src/hooks/useSmmPanel.ts`
   - Atualizar `servicesQuery` para aceitar os formatos comuns:
     - Se vier `data` como array => usar direto.
     - Se vier `data.services` como array => usar `data.services`.
     - Se vier `{ error }` => lançar erro para React Query (para cair em `isError`).
   - Também vou melhorar a mensagem de erro exibida (para você saber exatamente “por que está vazio”).

4) Ajustar a UI `src/pages/Engajamento.tsx` para ficar óbvio quando falhou
   - Em “Serviços” e no Select do “Criar pedido”:
     - Se `servicesQuery.isError`, mostrar um texto mais claro (“Falha ao carregar serviços: <mensagem>”) e um botão “Tentar novamente”.
   - Se `servicesQuery` retornar vazio de verdade (0 serviços), mostrar “O painel retornou 0 serviços” (diferente de erro).

5) Validação final (checagem de ponta a ponta)
   - Recarregar `/engajamento`:
     - Confirmar que o saldo aparece (ou erro claro).
     - Confirmar que a lista “Serviços” aparece (ou erro claro).
     - Confirmar que o Select de serviços em “Criar pedido” popula.
   - Se você colar aqui o JSON real do `action=services`, eu valido se estamos mapeando corretamente os campos (`service`, `name`, `category`, `rate`, `min`, `max`).

O que eu preciso de você (para fechar 100%)
- Cole aqui o **JSON de exemplo** do retorno do Instaluxo para `action=services` (pode ser só um pedaço: 2 ou 3 itens já ajuda). Se tiver muita coisa, pode colar apenas o começo e um item do meio.

Riscos e como vou lidar
- Se o Instaluxo bloquear requisições do ambiente da Edge Function (anti-bot/firewall):
  - Vamos detectar pelo erro (TLS/403/timeout).
  - Aí o plano B é usar o endpoint/host correto alternativo que o painel fornecer (às vezes eles têm domínio “api.” separado) ou liberar IP (se o provedor permitir).
- Se o formato da resposta for diferente:
  - Com o JSON de exemplo, eu ajusto o parser para o formato exato.

Arquivos que serão alterados (na implementação)
- `supabase/functions/smm-panel/index.ts` (timeout, logs, parsing/padronização)
- `src/hooks/useSmmPanel.ts` (aceitar formatos e melhorar erros)
- `src/pages/Engajamento.tsx` (mensagens/UX de erro e botão “tentar novamente”)

Critério de sucesso
- Ao abrir `/engajamento`, a seção “Serviços” carrega e lista os serviços do painel, e o Select de “Criar pedido” deixa escolher qualquer serviço.
- Se o painel estiver fora do ar, a UI mostra o motivo (timeout/403/etc) em vez de ficar vazia.