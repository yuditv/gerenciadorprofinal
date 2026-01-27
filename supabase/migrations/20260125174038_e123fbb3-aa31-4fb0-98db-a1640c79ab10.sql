-- Add payment info field and payment detection keywords to bot_proxy_config
ALTER TABLE public.bot_proxy_config 
ADD COLUMN IF NOT EXISTS owner_payment_info TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS payment_keywords TEXT[] DEFAULT ARRAY['pix', 'pagamento', 'pagar', 'chave pix', 'transferir', 'deposito', 'depositar', 'banco', 'conta', 'R$', 'reais', 'cpf', 'cnpj']::TEXT[],
ADD COLUMN IF NOT EXISTS block_bot_payment BOOLEAN DEFAULT FALSE;