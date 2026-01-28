
Objetivo
- Você não vê “Category” no painel, mas a API do Servex está retornando erro 400 “Campos obrigatórios faltando”.
- Vamos adicionar no app um fluxo “listar e escolher” (automático) para descobrir Category/Owner via API e você só seleciona, sem precisar saber IDs.

O que está acontecendo (diagnóstico)
- Logs do Edge Function `vpn-test-generator` mostram chamadas válidas, mas a resposta do Servex é:
  - HTTP 400 com body: `{"error":"Campos obrigatórios faltando"}`
- Isso indica que, na sua conta/painel, o endpoint `POST /api/clients` exige algum campo adicional (muito comum: `category_id` e/ou `owner_id`), mesmo que no painel visual isso esteja “implícito”.

Solução proposta (alto nível)
1) Criar um novo Edge Function para “catálogo do Servex” (metadata)
- Nome sugerido: `servex-metadata`
- Funções:
  - Buscar lista de categorias (category) e/ou owners (owner) via endpoints do Servex.
  - Normalizar a resposta para o frontend (ex.: `[{ id, name }]`).
  - Ter estratégia de “tentativas” (probing) porque a documentação não está clara:
    - Tentar vários caminhos comuns (ex.: `/api/categories`, `/api/category`, `/api/owners`, `/api/users`, etc.) até encontrar um que retorne JSON com lista.

2) Modificar o Frontend (VPNTestGenerator.tsx)
- **Fluxo inicial**:
  a. Ao abrir o modal, exibir um loading/spinner inicial enquanto chama `servex-metadata`.
  b. Se retornar categorias, armazenar no estado (`availableCategories`) e se retornar owners, `availableOwners`.
  c. Se vierem listas não-vazias:
    - Mostrar um `<Select>` para categoria (e/ou owner se vier).
    - Exigir seleção antes de liberar o botão "Gerar no painel" se a lista tiver mais de 1 item.
    - Se a lista tiver apenas 1 item (categoria ou owner único), auto-selecionar.
  d. Se não retornar nada (probing falhou), "fallback": mostrar opcionalmente um campo manual Category/Owner com helper text.

- **Integração com a geração**:
  - Quando o usuário clicar "Gerar no painel", o payload já vai com `category_id` e `owner_id` (quando presentes).

- **Error handling**:
  - Se o 400 ainda ocorrer (improvável se a lista for válida, mas pode acontecer se houver outro campo obrigatório), mostrar a mensagem de erro com "campos faltando" explícitos (se possível, parseando o response do Servex).

3) Estratégia de "tentativas" (Probing) no servex-metadata
- Tentamos GET em múltiplos endpoints (caminhos possíveis):
  - `/api/categories`
  - `/api/category`
  - `/api/clients/categories`
  - `/api/owners`
  - `/api/users`
  - (E se o Servex tiver algum endpoint de "schema" ou "metadata", tentamos também).
- A primeira tentativa que retornar:
  - 200 OK + JSON array com pelo menos 1 elemento → normalize e devolve como `categories` ou `owners`.
  - Se nenhuma tentativa der 200 OK, não é erro crítico, apenas não conseguimos descobrir. Retornamos vazio.

4) Logs ampliados para suporte
- Se a seleção manual vier vazia ou se o 400 ainda ocorrer após escolher, mostrar no modal o log bruto/parcial da resposta (de forma amigável, permitindo o usuário "copiar erro" para debug).

Detalhes técnicos

Edge Function: `servex-metadata`
- Localização: `supabase/functions/servex-metadata/index.ts`
- Método: `GET` (ou POST com um parâmetro `scope` se quisermos forçar fetch de category ou owner).
- Autenticação: Usa o mesmo `SERVEX_API_KEY`.
- Timeout: 15 segundos (AbortController) tal como em `vpn-test-generator`.
- Response:
  ```typescript
  {
    categories?: Array<{ id: number, name: string }>,
    owners?: Array<{ id: number, name: string }>,
    error?: string
  }
  ```

Alterações no Front-end
- **VPNTestGenerator.tsx**
  1. Criar estado:
     ```typescript
     const [availableCategories, setAvailableCategories] = useState<Array<{ id: number; name: string }>>([])
     const [availableOwners, setAvailableOwners] = useState<Array<{ id: number; name: string }>>([])
     const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
     const [selectedOwnerId, setSelectedOwnerId] = useState<number | null>(null)
     const [isLoadingMetadata, setIsLoadingMetadata] = useState(false)
     ```
  2. useEffect "on mount" (ou logo após `open=true` se for modal-driven):
     ```typescript
     useEffect(() => {
       if (modalOpen) {
         fetchMetadata()
       }
     }, [modalOpen])
     ```
     Função `fetchMetadata` chama `servex-metadata` e popula os arrays.
  3. Renderizar:
     - Se `isLoadingMetadata`: spinner ("Carregando categorias do painel...").
     - Se `availableCategories.length > 0`:
       - `<Select>` com opções (id/name).
       - Se `length === 1`, seleciona automaticamente.
     - Se `availableOwners.length > 0`: idem.
     - Botão "Gerar no painel" só ativa se (categorias.length === 0 ou selectedCategoryId !== null) && (owners.length === 0 ou selectedOwnerId !== null).
  4. Payload de `generateOnPanel` inclui:
     ```typescript
     category_id: selectedCategoryId ?? undefined,
     owner_id: selectedOwnerId ?? undefined,
     ```

- **Manter o bloco de "Campos obrigatórios faltando" (fallback manual):**
  - Se a probing não achar nada, continuamos mostrando os inputs manuais (Category ID / Owner ID) como "plano B".

Fluxo final (resumo)
1. Usuário abre modal VPN
2. App chama `servex-metadata` para listar categorias/owners
3. Se retornar:
   - Mostra Select dropdown
   - Usuário escolhe (ou se só 1, auto-seleciona)
   - Clique "Gerar no painel" → payload já inclui IDs
4. Edge Function `vpn-test-generator` envia POST com category_id/owner_id
5. Servex cria teste com sucesso → retorna dados → UI exibe para copiar
6. Se ainda der 400, mostramos erro claramente (com possibilidade de "copiar erro").

Melhorias extras (opcionais, mas boas):
- Se o probing descobrir que o painel tem uma categoria default (ex.: primeira da lista se tiver "is_default"), auto-seleciona.
- Se existir endpoint de "schema" no Servex (improvável mas possível), usamos.
- Criar botão "Atualizar lista de categorias" pra reforçar a busca se o painel mudou.

Estrutura de arquivos (resumo)
```
supabase/functions/servex-metadata/
  index.ts           # Edge Function novo para probing de categories/owners

supabase/config.toml  # Adicionar [functions.servex-metadata] verify_jwt = false

src/components/Inbox/VPNTest/
  VPNTestGenerator.tsx  # Adicionar fetchMetadata, Select dropdowns, estados
```

Observações
- "Teste" que você quer usar: se na verdade "Teste" é um nome de categoria visível no painel, provavelmente vai aparecer na lista retornada pela API, e você vai selecionar visualmente.
- **Problema de Cloudflare 403**: no teste do curl do Edge Function, recebemos 403 com Cloudflare challenge page. Isso pode indicar que o Servex tem proteção contra bots ou IPs suspeitos. Vamos ajustar o User-Agent/Headers (já está feito) e considerar:
  - Se persistir o 403, pode ser que o Servex bloqueie chamadas de IPs da Supabase Edge.
  - Possível solução: chamar a API do seu servidor/backend (se tiver) ou configurar IP whitelist no Servex (se disponível).
  - Mas como você viu que funciona manualmente, vamos assumir que é questão de headers/configuração que vamos aprimorar.

Conclusão
- Vamos implementar um **descobrimento automático via API** para evitar que você tenha que saber IDs manuais.
- Se não achar, ainda tem fallback manual (inputs de texto).
- Isso deve resolver o erro 400 "Campos obrigatórios faltando" de forma amigável e automática.
