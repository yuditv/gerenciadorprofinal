
# Plano: Corrigir Layout do Campo de Digitação Cortado

## Problema Identificado

O campo de digitação (composer) na Central de Atendimento está sendo cortado porque o layout não está fixando os elementos corretamente. O que acontece:

1. A página cresce conforme o número de mensagens aumenta
2. O compositor (campo de texto) desce junto com as mensagens
3. O usuário precisa rolar a tela para ver o campo de digitação

## Comportamento Desejado (como na imagem de referência)

```text
+--------------------------------------------------+
|  Header da página (fixo no topo)                 |
+----------+------------------------+---------------+
|          |                        |               |
| Lista de |   Área de mensagens    | Info Cliente  |
| Conversas|     (com scroll)       |   (fixo)      |
|  (fixo)  |                        |               |
|          +------------------------+               |
|          |  Compositor (fixo)     |               |
+----------+------------------------+---------------+
```

Todos os elementos devem ficar fixos na tela, exceto a área de mensagens que deve ter scroll próprio.

## Causa Raiz

O componente `MainLayout` tem `overflow-auto` no `<main>`, permitindo que todo o conteúdo role. Quando o Atendimento é renderizado dentro dele, não há restrição de altura que force apenas as mensagens a rolar.

## Solução

### 1. Ajustar o MainLayout (src/layouts/MainLayout.tsx)

Mudar o container principal para usar altura fixa e `overflow-hidden` para forçar os filhos a respeitarem o espaço disponível:

```tsx
// De:
<motion.main className="flex-1 p-6 overflow-auto ..."

// Para:
<motion.main className="flex-1 overflow-hidden h-full ..."
```

### 2. Ajustar Atendimento.tsx (src/pages/Atendimento.tsx)

Garantir que o container principal use todo o espaço disponível sem crescer:

```tsx
// De:
<div className="theme-atendimento h-full min-h-0 flex flex-col ..."

// Para:
<div className="theme-atendimento h-full flex flex-col overflow-hidden ..."
```

### 3. Ajustar ChatPanel.tsx (src/components/Inbox/ChatPanel.tsx)

Garantir que a estrutura interna respeite as alturas:

- Container principal: `h-full overflow-hidden`
- Área de mensagens (ScrollArea): `flex-1 min-h-0` (permite scroll interno)
- Compositor: `shrink-0` (não encolhe, fica fixo no final)

## Estrutura CSS Final

```text
MainLayout:
  ├── height: 100vh
  ├── display: flex, flex-col
  └── main: flex-1, overflow-hidden

Atendimento:
  ├── height: 100%, overflow-hidden
  └── Content: flex-1, min-h-0

ChatPanel:
  ├── flex-1, h-full, overflow-hidden
  ├── Header: shrink-0 (fixo)
  ├── Messages: flex-1, min-h-0, overflow-y-auto
  └── Composer: shrink-0 (fixo)
```

## Arquivos a Modificar

1. **src/layouts/MainLayout.tsx** - Ajustar overflow e height do main
2. **src/pages/Atendimento.tsx** - Garantir altura correta
3. **src/components/Inbox/ChatPanel.tsx** - Verificar estrutura flex

## Resultado Esperado

Após as alterações:
- O header fica fixo no topo
- A lista de conversas fica fixa à esquerda
- A área de mensagens tem scroll independente
- O campo de digitação fica fixo na parte inferior
- O painel de informações do cliente fica fixo à direita
- Nenhum scroll na página inteira, apenas dentro da área de mensagens
