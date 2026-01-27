-- Insert default global canned responses
INSERT INTO public.canned_responses (user_id, short_code, content, is_global)
VALUES 
  ('e3a81db4-e967-4771-b7b3-a270eb985b31', 'oi', 'Olá! 👋 Tudo bem? Sou da equipe de atendimento. Como posso ajudá-lo(a) hoje?', true),
  ('e3a81db4-e967-4771-b7b3-a270eb985b31', 'preco', 'Nossos planos são:

📺 **Mensal**: R$ 30,00/mês
📺 **Trimestral**: R$ 80,00 (economia de R$ 10)
📺 **Semestral**: R$ 150,00 (economia de R$ 30)
📺 **Anual**: R$ 280,00 (economia de R$ 80)

Qual plano te interessa mais?', true),
  ('e3a81db4-e967-4771-b7b3-a270eb985b31', 'ajuda', 'Posso te ajudar com:

🔧 **Problemas técnicos** - dificuldades de acesso ou travamentos
💳 **Pagamentos** - segunda via, renovação, troca de plano
📱 **Instalação** - configurar em novos dispositivos
❓ **Dúvidas** - informações sobre o serviço

Sobre qual assunto você precisa de ajuda?', true),
  ('e3a81db4-e967-4771-b7b3-a270eb985b31', 'obrigado', 'Obrigado pelo contato! 🙏

Se precisar de mais alguma coisa, é só chamar. Estamos sempre à disposição! 

Tenha um ótimo dia! ✨', true),
  ('e3a81db4-e967-4771-b7b3-a270eb985b31', 'pix', 'Para pagamento via PIX:

📲 **Chave PIX**: seu@email.com
💰 **Valor**: R$ XX,XX

Após o pagamento, envie o comprovante aqui que liberamos seu acesso em até 5 minutos! ⚡', true),
  ('e3a81db4-e967-4771-b7b3-a270eb985b31', 'teste', 'Vou liberar um teste GRÁTIS de 24 horas para você experimentar! 🎁

Por favor, me informe:
1️⃣ Qual dispositivo você usa? (TV, celular, computador)
2️⃣ Qual app você prefere?

Assim que me informar, envio os dados de acesso!', true),
  ('e3a81db4-e967-4771-b7b3-a270eb985b31', 'renovar', 'Para renovar sua assinatura:

1️⃣ Escolha o plano desejado
2️⃣ Faça o pagamento via PIX
3️⃣ Envie o comprovante aqui

Liberamos em até 5 minutos após confirmar! ⚡

Qual plano você gostaria de renovar?', true),
  ('e3a81db4-e967-4771-b7b3-a270eb985b31', 'aguarde', 'Só um momento, por favor! ⏳ Estou verificando isso para você...', true)
ON CONFLICT DO NOTHING;