
Objetivo
- Pegar as “opções de instância” da documentação UAZAPI que você mostrou (Status detalhado, Atualizar nome, Privacidade, Desconectar) e colocar no seu sistema de Instâncias:
  - Resumo/atalhos no card da instância (aba WhatsApp → Instâncias)
  - Completo dentro do dialog de Configurações (botão de engrenagem)

O que eu vi no seu código (estado atual)
- Frontend:
  - Aba “WhatsApp → Instâncias” (src/pages/WhatsApp.tsx) já tem botões: QR Code, Status, Webhook, Testar, Configurações, Excluir.
  - O dialog atual “Configurações da Instância” (src/components/InstanceSettingsDialog.tsx) só salva:
    - daily_limit
    - business hours (start/end)
- Backend (Edge Function):
  - supabase/functions/whatsapp-instances/index.ts já implementa várias ações (create, qrcode, paircode, status, disconnect, delete, etc.)
  - Porém NÃO implementa ações para:
    - Atualizar nome da instância via UAZAPI (/instance/updateInstanceName)
    - Ler privacidade via UAZAPI (/instance/privacy)
    - Alterar privacidade via UAZAPI (/instance/privacy)
  - A action “status” já consulta /instance/status, mas retorna apenas status/phone/profileName/profilePictureUrl (vamos expandir para “detalhado”).

Requisitos confirmados (suas respostas)
- Opções a adicionar agora: Status detalhado + Atualizar nome + Privacidade + Desconectar
- Onde aparecer: Ambos (card + dialog)

Escopo funcional (como vai ficar para o usuário)
1) No card da instância (aba WhatsApp → Instâncias)
- Manter os botões existentes (QR Code, Status…)
- Adicionar mais atalhos (sem poluir):
  - “Renomear” (abre modal rápido)
  - “Privacidade” (abre modal rápido ou abre o dialog já na aba Privacidade)
  - “Desconectar” (confirmação + executa logout)
- “Status” passará a mostrar “detalhado” (com mais infos) e também atualizará melhor o banco.

2) No dialog de Configurações (engrenagem)
- Transformar o dialog em um layout com abas (Tabs) para ficar organizado:
  - Geral (o que já existe hoje: limites + horário comercial)
  - UAZAPI / Instância (Status detalhado + Renomear + Desconectar)
  - Privacidade (ver e alterar configurações)
- Tudo com feedback (toast) e loading states.

Detalhes técnicos por funcionalidade

A) Status detalhado (UAZAPI GET /instance/status)
Backend (Edge Function whatsapp-instances)
- Expandir a action "status":
  - Continuar chamando GET `${UAZAPI_URL}/instance/status` com header `token: instance.instance_key`
  - Normalizar resposta para incluir (quando existir):
    - instance.status (connected/connecting/disconnected)
    - instance.qrcode (se existir)
    - instance.paircode (se existir)
    - instance.owner (número conectado)
    - instance.profileName
    - instance.profilePicUrl
    - instance.platform / systemName (se vier)
    - lastDisconnect / lastDisconnectReason (se vier)
    - status.connected / status.loggedIn (se vier)
  - Atualizar o banco public.whatsapp_instances com o que já atualiza hoje:
    - status, phone_connected, profile_name, profile_picture_url, last_connected_at, qr_code (quando vier)
- Padrão de erro:
  - Para erros “funcionais” (sem instance_key, instance não encontrada etc.), retornar HTTP 200 com `{ success:false, error:'...' }` (para evitar supabase.functions.invoke estourar erro fatal no front).

Frontend
- No botão “Status” do card: além do toast “Status atualizado”, mostrar um resumo (ex.: “Conectado”, “Última desconexão…” quando existir).
- No dialog: mostrar um “painel de status” com campos em formato de lista (chave/valor) + botão “Atualizar agora”.

B) Atualizar nome da instância (UAZAPI POST /instance/updateInstanceName)
Backend
- Adicionar nova action no whatsapp-instances: "update_instance_name"
  - Validar:
    - instanceId obrigatório
    - name string 1..60 (ou 100) e trim
  - Chamar POST `${UAZAPI_URL}/instance/updateInstanceName` com header `token` e body `{ name }`
  - Se sucesso:
    - Atualizar `whatsapp_instances.instance_name = name` no banco (para refletir no sistema)
    - Retornar `{ success:true }`
  - Se falhar:
    - Retornar `{ success:false, error:'...' }` (HTTP 200)

Frontend
- Card: botão/ação “Renomear” abre dialog simples (Input) e salva.
- Dialog: campo “Nome da instância” com botão “Salvar nome”.
- Após salvar, refetchInstances() para atualizar lista imediatamente.

C) Privacidade (UAZAPI GET/POST /instance/privacy)
Backend
- Adicionar action "get_privacy"
  - Validar instanceId
  - Chamar GET `${UAZAPI_URL}/instance/privacy` com header `token`
  - Retornar `{ success:true, privacy: {...} }`
- Adicionar action "set_privacy"
  - Validar instanceId
  - Validar payload com whitelist:
    - groupadd, last, status, profile, readreceipts, online, calladd
  - Validar valores permitidos:
    - groupadd/last/status/profile: all | contacts | contact_blacklist | none
    - readreceipts: all | none
    - online: all | match_last_seen
    - calladd: all | known
  - Chamar POST `${UAZAPI_URL}/instance/privacy` com header `token` e body com apenas campos enviados
  - Retornar `{ success:true, privacy: {...atualizado} }`

Frontend (aba “Privacidade”)
- Ao abrir aba:
  - Carregar configurações atuais via "get_privacy"
  - Mostrar Selects (um para cada campo), com labels em PT-BR:
    - Quem pode adicionar aos grupos (groupadd)
    - Quem pode ver visto por último (last)
    - Quem pode ver recado/status (status)
    - Quem pode ver foto de perfil (profile)
    - Confirmação de leitura (readreceipts)
    - Quem pode ver online (online)
    - Quem pode fazer chamadas (calladd)
- Botões:
  - “Carregar do WhatsApp” (refetch)
  - “Salvar alterações” (chama set_privacy)
  - Mostrar aviso: “Broadcast/stories não é configurável pela API” (como na doc)

D) Desconectar (logout sem apagar instância)
Backend
- Reaproveitar action existente "disconnect" (já chama /instance/logout e seta status no banco).
- Ajustar a resposta para também seguir padrão `{ success:true }` e para erros funcionais retornar 200 `{ success:false, error }` quando possível.

Frontend
- Card: botão “Desconectar” (apenas se status conectado/connecting), com confirmação:
  - “Isso vai deslogar o WhatsApp desta instância. Você precisará reconectar via QR/pareamento.”
- Dialog: botão “Desconectar instância” em destaque (destructive).

Mudanças de código (arquivos que serão mexidos)
Frontend
- src/pages/WhatsApp.tsx
  - Adicionar ações novas no card (Renomear, Privacidade, Desconectar)
  - Abrir InstanceSettingsDialog já com “aba inicial” (ex.: abrir direto em Privacidade quando clicar)
- src/components/InstanceSettingsDialog.tsx
  - Refatorar para Tabs: Geral / Instância / Privacidade
  - Implementar UI e chamadas (via hook) para:
    - status detalhado
    - update name
    - get/set privacy
    - disconnect
- src/hooks/useWhatsAppInstances.ts
  - Adicionar funções:
    - updateInstanceName(instanceId, name)
    - getInstancePrivacy(instanceId)
    - setInstancePrivacy(instanceId, privacyPatch)
    - disconnectInstance(instanceId)
  - Reusar supabase.functions.invoke('whatsapp-instances', { action: ... })

Backend
- supabase/functions/whatsapp-instances/index.ts
  - Adicionar actions:
    - update_instance_name
    - get_privacy
    - set_privacy
  - Melhorar "status" para devolver payload mais completo
  - Ajustar resposta de erros para HTTP 200 com `{ success:false }` quando apropriado

Validações e segurança
- Frontend:
  - Validar nome (não vazio, limite de caracteres) antes de enviar.
- Backend:
  - Validar todos os inputs (instanceId, name, valores de privacidade) antes de chamar API externa.
  - Não aceitar chaves de privacidade fora da whitelist (para evitar injeção/valores inesperados).
- Manter a regra do projeto: erros funcionais retornam 200 com success:false para evitar “blank screen”.

Testes manuais (checklist rápido)
1) Status detalhado:
- Clicar “Status” no card → deve atualizar badge e informações (e atualizar DB com foto/nome/número se existir).
2) Atualizar nome:
- Renomear no card e no dialog → deve refletir na lista após refetch.
3) Privacidade:
- Abrir aba Privacidade → carregar valores atuais.
- Alterar 1-2 campos e salvar → confirmar que a API responde e o UI mostra “salvo”.
4) Desconectar:
- Clicar “Desconectar” → status deve ir para disconnected no banco e no UI.

Observação sobre “ainda tem mais fotos”
- Com as opções acima implementadas, você pode enviar depois as outras capturas (em blocos de 10) e eu adiciono o restante das opções que aparecerem nelas, seguindo o mesmo padrão (card + dialog).

Entregável final (resultado)
- Seu painel de Instâncias terá:
  - Status mais completo
  - Renomear instância integrado com UAZAPI e com seu banco
  - Tela de Privacidade completa (ler e alterar)
  - Botão de Desconectar (logout) sem excluir instância
