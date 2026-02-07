

# Plano: Migrar de Mercado Pago para InfinitePay

## Resumo

Substituir toda a integracaoo com Mercado Pago pela InfinitePay (Checkout Integrado). A InfinitePay usa um modelo de **link de checkout** (nao gera QR Code PIX diretamente), entao o fluxo muda de "exibir QR Code inline" para "abrir link de pagamento InfinitePay".

## Como funciona a InfinitePay

A API e publica e simples:
- **Criar link de checkout**: `POST https://api.infinitepay.io/invoices/public/checkout/links`
- **Verificar pagamento**: `POST https://api.infinitepay.io/invoices/public/checkout/payment_check`
- **Webhook**: InfinitePay envia POST para sua URL quando o pagamento e aprovado
- Nao precisa de API Key -- usa o **handle** (nome de usuario InfinitePay, ex: `lucas-renda`)
- Precos em **centavos** (R$ 10,00 = 1000)

---

## Fase 1: Banco de Dados

**Migracao SQL:**
- Adicionar coluna `infinitepay_handle` na tabela `user_payment_credentials`
- Adicionar colunas `checkout_url` e `infinitepay_slug` nas tabelas `subscription_payments`, `client_pix_payments` e `wallet_topups`
- Manter colunas antigas temporariamente para compatibilidade

## Fase 2: Edge Functions (Backend)

### 2.1 - Nova funcao `infinitepay-checkout`
Substitui `mercado-pago-pix`. Dois modos:
- **create**: Chama `POST /invoices/public/checkout/links` com handle do admin (secret `INFINITEPAY_HANDLE`), items, order_nsu, redirect_url e webhook_url. Salva o link e slug no banco.
- **check**: Chama `POST /invoices/public/checkout/payment_check` com handle, order_nsu e slug. Se pago, ativa assinatura.

### 2.2 - Nova funcao `infinitepay-webhook`
Substitui `mercado-pago-webhook`. Recebe POST da InfinitePay com:
```
{ invoice_slug, amount, paid_amount, capture_method, transaction_nsu, order_nsu, receipt_url, items }
```
Logica identica ao webhook atual: marca pagamento como pago, ativa assinatura/renova cliente, envia notificacoes WhatsApp.

### 2.3 - Atualizar `generate-client-pix-v2`
Em vez de usar `MERCADO_PAGO_ACCESS_TOKEN` do usuario, usa `infinitepay_handle` da tabela `user_payment_credentials`. Chama a API InfinitePay para gerar link de checkout para o cliente.

### 2.4 - Atualizar `wallet-pix`
Mesma logica: substituir chamada Mercado Pago por InfinitePay. Gera link de checkout para recarga de creditos.

### 2.5 - Atualizar `ai-agent-chat` e `customer-chat-ai`
Substituir blocos de geracao de PIX via Mercado Pago pela API InfinitePay. Em vez de enviar QR Code, envia o link de checkout.

## Fase 3: Frontend

### 3.1 - `CredentialsSettings.tsx`
Trocar de "Mercado Pago Access Token" para "InfinitePay Handle". Campo simples de texto (ex: `lucas-renda`). Salva na coluna `infinitepay_handle`.

### 3.2 - `PIXPaymentDialog.tsx` (assinaturas)
Em vez de exibir QR Code, exibir:
- Botao "Abrir Checkout InfinitePay" que abre o link em nova aba
- Timer de expiracao
- Botao "Verificar Pagamento" que consulta o status
- Estado de sucesso quando confirmado

### 3.3 - `GeneratePIXDialog.tsx` (cobrar clientes)
Mesma abordagem: gerar link, exibir para copiar/enviar ao cliente via WhatsApp. Botao "Enviar Link" em vez de "Enviar QR Code".

### 3.4 - `useWalletTopup.ts`
Mudar invocacao de `wallet-pix` (mesma interface, so muda o backend).

### 3.5 - `useSubscription.ts`
Atualizar referencia de `mercado-pago-pix` para `infinitepay-checkout`.

## Fase 4: Secrets e Configuracao

- Adicionar secret `INFINITEPAY_HANDLE` (handle do admin do sistema)
- A secret `MERCADO_PAGO_ACCESS_TOKEN` pode ser removida depois
- Cada usuario configura seu proprio handle em Configuracoes > Credenciais

---

## Detalhes Tecnicos

### Payload de criacao do checkout:
```json
{
  "handle": "lucas-renda",
  "items": [
    { "quantity": 1, "price": 5000, "description": "Plano Premium - 30 dias" }
  ],
  "order_nsu": "sub_uuid_123",
  "redirect_url": "https://app.com/payment-success",
  "webhook_url": "https://supabase.co/functions/v1/infinitepay-webhook",
  "customer": {
    "name": "Joao Silva",
    "email": "joao@email.com",
    "phone_number": "+5511999887766"
  }
}
```

### Payload de verificacao:
```json
{
  "handle": "lucas-renda",
  "order_nsu": "sub_uuid_123",
  "slug": "codigo-da-fatura"
}
```

### Resposta de verificacao:
```json
{
  "success": true,
  "paid": true,
  "amount": 5000,
  "paid_amount": 5010,
  "installments": 1,
  "capture_method": "pix"
}
```

### Webhook recebido (pagamento aprovado):
```json
{
  "invoice_slug": "abc123",
  "amount": 5000,
  "paid_amount": 5010,
  "installments": 1,
  "capture_method": "credit_card",
  "transaction_nsu": "UUID",
  "order_nsu": "sub_uuid_123",
  "receipt_url": "https://comprovante.com/123",
  "items": [...]
}
```

## Arquivos Impactados

| Arquivo | Acao |
|---------|------|
| `supabase/migrations/new.sql` | Adicionar colunas |
| `supabase/functions/infinitepay-checkout/index.ts` | Criar (substitui mercado-pago-pix) |
| `supabase/functions/infinitepay-webhook/index.ts` | Criar (substitui mercado-pago-webhook) |
| `supabase/functions/generate-client-pix-v2/index.ts` | Editar |
| `supabase/functions/wallet-pix/index.ts` | Editar |
| `supabase/functions/ai-agent-chat/index.ts` | Editar (linhas 1212-1288) |
| `supabase/functions/customer-chat-ai/index.ts` | Editar (linhas 481-517) |
| `src/components/CredentialsSettings.tsx` | Editar |
| `src/components/PIXPaymentDialog.tsx` | Editar |
| `src/components/Inbox/GeneratePIXDialog.tsx` | Editar |
| `src/hooks/useWalletTopup.ts` | Editar |
| `src/hooks/useSubscription.ts` | Editar |
| `src/integrations/supabase/types.ts` | Atualizar tipos |

## Ordem de Execucao

1. Migracao SQL (adicionar colunas)
2. Criar `infinitepay-checkout` e `infinitepay-webhook`
3. Atualizar `generate-client-pix-v2` e `wallet-pix`
4. Atualizar componentes frontend
5. Atualizar funcoes de IA
6. Solicitar secret `INFINITEPAY_HANDLE`
7. Deploy e teste

