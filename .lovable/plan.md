
Objetivo
- Fazer o “Agente IA” entender áudios no Inbox/WhatsApp: ele não “ouve” áudio diretamente; a forma correta é transcrever (speech-to-text) e entregar o texto para o agente.
- Você escolheu: Inbox + WhatsApp + Agente IA, modo Automático, salvar no banco, idioma pt-BR.

O que existe hoje (diagnóstico rápido)
- O Inbox já recebe e exibe áudio (player) e o WhatsApp webhook consegue baixar mídia (inclusive áudio) via UAZAPI.
- Porém, quando chega um áudio, normalmente o campo `message` fica vazio e o AI é chamado com `message: message` (texto), então o agente não tem conteúdo para “entender”.
- Há um buffer (`ai_message_buffer`) que junta mensagens antes de chamar o AI; ele hoje junta `message || caption || ''` — áudio sem transcript vira vazio e atrapalha a resposta.

Solução proposta (alto nível)
1) Transcrever automaticamente todo áudio recebido no WhatsApp/Inbox (pt-BR).
2) Salvar a transcrição no banco no `metadata` da mensagem (para reaproveitar e aparecer para todos).
3) Quando a mensagem for áudio, alimentar o buffer/Agente IA com o texto transcrito (ex.: “(ÁUDIO) <transcrição>”), para o agente responder normalmente.
4) Mostrar o texto transcrito embaixo do player de áudio no Inbox.

Decisão técnica: qual provedor de transcrição
- No seu projeto já existe `OPENAI_API_KEY` configurada como secret.
- Não existe `ELEVENLABS_API_KEY`.
- Para evitar depender de nova chave agora, a implementação vai usar OpenAI Speech-to-Text (Whisper) via Edge Function.
- Bônus: o código do webhook já sugere que o UAZAPI pode retornar `transcription?` no download; se realmente vier, vamos aproveitar primeiro (zero custo extra) e só chamar OpenAI como fallback.

Mudanças planejadas (passo a passo)

A) Backend — nova Edge Function de transcrição
1. Criar uma Edge Function, por exemplo: `supabase/functions/transcribe-audio/index.ts`
   - Entrada: `{ mediaUrl: string, mimeType?: string, language?: "pt" | "pt-BR", source?: "whatsapp" | "inbox" }`
   - Comportamento:
     - Baixar o arquivo do `mediaUrl` (arrayBuffer/blob).
     - Montar `multipart/form-data` e chamar OpenAI `POST https://api.openai.com/v1/audio/transcriptions`
       - `model`: `whisper-1` (ou equivalente suportado)
       - `language`: `pt` (para melhorar em pt-BR)
     - Retornar JSON: `{ text: string, provider: "openai", language: "pt", durationMs?: number }`
   - Segurança:
     - `verify_jwt = false` no `supabase/config.toml`, mas validar no código:
       - Permitir chamadas internas com Service Role (usadas pelo webhook).
       - Para chamadas do app, exigir usuário autenticado (ou no mínimo token válido) para não virar endpoint público de “transcrever qualquer URL”.
   - Tratamento de erro:
     - Retornar erros claros (ex.: 400 sem URL, 415 tipo não suportado, 429 rate limit, 500).

2. Atualizar `supabase/config.toml` para registrar a function com `verify_jwt = false`.

B) WhatsApp Inbox Webhook — transcrever e salvar no banco automaticamente
3. Ajustar `downloadMediaFromUAZAPI` (ou o trecho que consome a resposta) para capturar `data.transcription` quando existir.
4. No fluxo do `whatsapp-inbox-webhook`:
   - Após determinar `mediaUrl`, `mediaType`, `mimetype`:
     - Se for áudio (`mediaType === "audio"` ou `mimetype` começar com `audio/`):
       1) Determinar `transcriptText`:
          - Prioridade 1: transcription vinda do UAZAPI (se existir e não vier vazia).
          - Prioridade 2: chamar `transcribe-audio` com `mediaUrl` e `language: "pt"`.
       2) Ao inserir a mensagem em `chat_inbox_messages`, salvar:
          - `content`: pode continuar vazio (ou manter um placeholder), mas
          - `metadata.transcription = { text, provider, language, created_at }`
          - `metadata.media_kind = "audio"` (opcional, ajuda UI).
       3) Para o buffer e para o AI:
          - Quando for áudio, alimentar `message` (o texto usado pelo buffer) com algo como:
            - `"(ÁUDIO) " + transcriptText`
          - Assim o `ai_message_buffer` terá conteúdo real e o agente vai entender o que foi dito.

5. Garantir idempotência e custo controlado:
   - Se a mesma mensagem já tiver `metadata.transcription.text`, não transcrever de novo.
   - Se falhar a transcrição, registrar `metadata.transcription_error` (para debug) e seguir o fluxo sem quebrar a conversa.

C) Buffer Processor — compatibilidade com áudio transcrito
6. Confirmar que o buffer usa o texto que o webhook inseriu (a mensagem que entra no `ai_message_buffer`).
7. Se necessário, ajustar o formato de “combinedMessage” para deixar claro que aquilo veio de áudio (prefixo “(ÁUDIO)”).

D) Frontend — mostrar transcrição abaixo do player no Inbox
8. Em `src/components/Inbox/ChatPanel.tsx`:
   - Na renderização do áudio (`msg.media_type?.startsWith('audio/') ? <AudioPlayer .../>`):
     - Logo abaixo do player, se existir `msg.metadata.transcription.text`, renderizar um bloco:
       - Título pequeno: “Transcrição”
       - Texto: `metadata.transcription.text`
       - Opcional: badge “pt-BR” e “OpenAI” (provider)
   - Manter visual discreto para não poluir.

E) Testes manuais (checklist)
9. Testar no Inbox:
   - Receber um áudio pelo WhatsApp → verificar:
     - Player aparece
     - Transcrição aparece embaixo
     - A mensagem AI (se AI estiver habilitado) responde com base na transcrição (não “pergunta o que você disse”).
10. Testar cenários de erro:
   - Áudio muito grande / URL inválida → UI não quebra, apenas não mostra transcrição e loga erro em metadata.
   - Rate limit (429) → comportamento amigável (sem travar o fluxo).
11. Validar custo:
   - Reenviar/atualizar página não deve gerar nova transcrição (porque fica salva no banco).

Riscos e como vamos mitigar
- Áudios longos: pode ficar caro/lento.
  - Mitigação: limitar tamanho/duração (ex.: recusar > X MB), e/ou truncar/avisar.
- Endpoint público: alguém poderia abusar da transcrição.
  - Mitigação: exigir auth para chamadas do app; para webhook usar service role internamente.
- Diferentes formatos de áudio (ogg/opus/webm/mp3):
  - Mitigação: baixar como arquivo e enviar ao OpenAI; garantir filename coerente e mimetype.

Entregáveis (o que você vai ver pronto)
- Transcrição automática de áudio recebidos no WhatsApp/Inbox, salva no banco.
- Inbox exibindo transcrição embaixo do áudio.
- Agente IA respondendo baseado no texto transcrito (via buffer/ai-agent-chat), ou seja: “entende o áudio” indiretamente, do jeito correto.

Notas técnicas (para referência)
- Onde salvar: `chat_inbox_messages.metadata.transcription.text` (jsonb), sem necessidade de migration.
- Linguagem: usar `pt` (ou `pt-BR` se o provedor aceitar) para melhorar transcrição em português.
- AIAgentChat (chat web de teste) não vai “ouvir” áudio automaticamente nessa fase; o foco é Inbox/WhatsApp como você marcou. Depois podemos estender para permitir enviar áudio no teste do agente também.
