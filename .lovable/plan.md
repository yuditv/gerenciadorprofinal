
Objetivo (escopo “do zero” só do Teste VPN)
- Recriar o “sistema do teste da VPN” do zero, mas mantendo o resto do projeto intacto.
- Novo comportamento escolhido por você:
  - Modo: Offline (recomendado)
  - Campos: Usuário+Senha, Conexões+Minutos, V2Ray+UUID, e um Template de cópia
  - Acesso: Tanto no Atendimento (Inbox) quanto em uma página separada

O que vai mudar (visão do usuário)
1) No Atendimento (Inbox)
- O botão “VPN” continua existindo no ChatPanel.
- Ao clicar, abre um novo modal “Teste VPN (Offline)” que:
  - Gera automaticamente os dados (usuário/senha/uuid) e permite editar
  - Mostra os campos em cards/linhas com botão “Copiar” por campo
  - Mostra um bloco “Template para copiar” (texto pronto) + botão “Copiar template”

2) Página separada
- Criar uma página dedicada (ex.: /vpn-test) com o mesmo gerador offline.
- Essa página deve ser acessível pelo menu/topbar (FloatingSidebar) via um item “VPN”.

O que vai mudar (arquitetura / código)
A) Zerar a dependência do Servex / Edge Function (para esse fluxo)
- O modal e a página NÃO vão chamar:
  - supabase.functions.invoke('vpn-test-generator')
  - nem qualquer edge function para Servex
- Com isso eliminamos:
  - 400 “Campos obrigatórios faltando”
  - 403 Cloudflare “Just a moment”
  - e qualquer instabilidade/blank screen vinda do backend

B) Nova “engine” offline única e reutilizável
- Manter/reestruturar um núcleo pequeno e previsível:
  - types.ts: VPNTestFormValues, VPNTestResult
  - utils.ts: generateOfflineValues(), normalize/validators e buildTemplate()
  - Um componente gerador reutilizável (ex.: VPNTestGenerator) usado:
    - no Dialog do Inbox
    - na Página /vpn-test

C) UI (componentização)
- Criar/ajustar componentes para ficar “do zero” (limpo e simples):
  1) VPNTestGenerator (com estado do formulário e resultado)
  2) VPNTestForm (form com validação e limites)
  3) VPNTestFields (exibição + copiar por campo)
  4) VPNTestTemplate (textarea readOnly com template pronto + copiar)
- O Dialog no Inbox vira um “wrapper” fino que só abre/fecha o gerador.

D) Navegação (Ambos)
- Inbox: já existe o botão VPN em src/components/Inbox/ChatPanel.tsx; manter e apontar para o novo dialog.
- Página separada:
  - Criar nova página em src/pages (ex.: src/pages/VPNTest.tsx)
  - Registrar rota no App.tsx: <Route path="/vpn-test" ... />
  - Adicionar item no FloatingSidebar:
    - Novo menuItems entry “VPN” que navega para /vpn-test
    - E ajustar handleClick para navegar quando item.id === 'vpn' (similar ao admin/engajamento)

Plano de implementação (passo a passo)
1) Remover o fluxo “API/Servex” do VPNTestGeneratorDialog
- Trocar o botão “Gerar Novo Teste” para:
  - gerar valores offline localmente
  - setar result/rawResponse
- Remover estados/erros relacionados a Servex (fnError, data.error, regex de cloudflare/campos obrigatórios, etc.)
- Manter UX de copiar (copyField / copyAll) e toasts.

2) Recriar o módulo VPNTest (do zero, mas mantendo compatibilidade mínima)
- types.ts
  - Garantir que VPNTestFormValues tenha exatamente os campos escolhidos:
    - username, password, connectionLimit, minutes, v2rayEnabled, v2rayUuid
  - Remover ownerId e qualquer referência a categoryId/Servex.
- utils.ts
  - generateOfflineValues() garantindo:
    - username e password <= 20 chars
    - password com caracteres seguros
    - uuid via crypto.randomUUID()
    - defaults: connectionLimit=1, minutes=60, v2rayEnabled=true
  - buildTemplate(values) para retornar o texto pronto do “Template de cópia”.
    - Exemplo de template (ajustável):
      - Usuário: ...
      - Senha: ...
      - Conexões: ...
      - Minutos: ...
      - V2Ray UUID: ...
- VPNTestForm.tsx
  - Manter inputs e limites atuais (20 chars, minutos max 360, conexões min 1)
  - Adicionar UI/ação “Gerar novo” (opcional) para regenerar usuário/senha/uuid sem fechar modal.
- VPNTestFields.tsx
  - Manter listagem e botão copiar por campo.
- Novo componente VPNTestTemplate.tsx (ou incorporar no Fields)
  - Mostrar template num Textarea readOnly (ou <pre> estilizado)
  - Botão “Copiar template”.

3) Criar a página /vpn-test
- Novo arquivo de página (ex.: src/pages/VPNTest.tsx) com:
  - Título “Teste VPN (Offline)”
  - Render do gerador (o mesmo usado no modal)
  - Layout consistente com o resto (Card/Container).
- Registrar no App.tsx (ProtectedRoute).

4) Adicionar acesso pelo menu (FloatingSidebar)
- Adicionar um MenuItem para “VPN” (id: "vpn") com ícone Wifi
- Ajustar handleClick:
  - Se item.id === 'vpn' => navigate('/vpn-test')
  - Sem depender de query param section.

5) (Opcional, mas recomendado) Desativar/limpar legado de Servex
- O edge function supabase/functions/vpn-test-generator/index.ts ficará “inútil” para esse fluxo.
- Depois da UI pronta e validada:
  - opção A: manter o código mas não usar (zero risco de regressão)
  - opção B: remover o código e também deletar a função no Supabase (mais “do zero” de verdade)
- Eu recomendo a opção B se você quiser “limpar” totalmente, mas só após confirmar que o offline está OK.

Validações e regras (para evitar bugs)
- Username e password: truncar para 20 e trim
- connectionLimit: min 1
- minutes: min 1, max 360
- v2rayUuid: só mostrar se v2rayEnabled=true
- Template sempre refletir o estado atual do formulário/resultado
- Não logar senha/credenciais no console (evitar vazamento em logs)

Como vamos testar (checklist)
1) No Atendimento: abrir /?section=atendimento
- Clicar “VPN” no topo do chat
- Gerar teste offline
- Testar “Copiar” por campo e “Copiar template”
- Fechar/reabrir: deve resetar para novos valores (ou manter, conforme definirmos)

2) Na página /vpn-test
- Acessar pelo menu e também via URL direta
- Repetir geração/cópia
- Verificar responsividade (mobile)

Se algo “do painel” ainda for necessário
- Como você escolheu Offline, o app não cria nada automaticamente na Servex.
- O “Template de cópia” será o ponto de integração manual: você copia e cria no painel quando quiser.

Se você quiser, depois desta fase (offline), dá para adicionar “um botão extra” futuro:
- “Abrir painel Servex” (link) + instruções, sem API.

Se estiver OK, eu implemento exatamente esse novo fluxo offline + página + item de menu, e deixo o Servex totalmente fora do caminho do usuário.
