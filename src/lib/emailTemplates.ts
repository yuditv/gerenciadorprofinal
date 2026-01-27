import { Client, planLabels, formatCurrency } from '@/types/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: 'welcome' | 'renewal' | 'expiration' | 'custom';
  icon: string;
}

export const emailTemplates: EmailTemplate[] = [
  {
    id: 'welcome',
    name: 'Boas-vindas',
    category: 'welcome',
    icon: '👋',
    subject: 'Bem-vindo(a) ao nosso serviço!',
    body: `Olá {nome}!

Seja muito bem-vindo(a) ao nosso serviço de {servico}!

Estamos muito felizes em tê-lo(a) conosco. Seu plano {plano} já está ativo e você tem acesso completo até {vencimento}.

Suas credenciais de acesso:
• Usuário: {usuario}
• Senha: {senha}

Se precisar de ajuda ou tiver alguma dúvida, estamos à disposição!

Atenciosamente,
Equipe de Suporte`,
  },
  {
    id: 'renewal-reminder',
    name: 'Lembrete de Renovação',
    category: 'renewal',
    icon: '🔄',
    subject: 'Seu plano vence em breve - Renove agora!',
    body: `Olá {nome}!

Passando para lembrar que seu plano {plano} de {servico} vence em {vencimento}.

Para continuar aproveitando todos os benefícios sem interrupção, renove seu plano o quanto antes!

Valor do plano: {valor}

Entre em contato conosco para renovar ou tirar qualquer dúvida.

Atenciosamente,
Equipe de Suporte`,
  },
  {
    id: 'renewal-success',
    name: 'Confirmação de Renovação',
    category: 'renewal',
    icon: '✅',
    subject: 'Renovação confirmada com sucesso!',
    body: `Olá {nome}!

Sua renovação foi realizada com sucesso! 🎉

Detalhes da renovação:
• Plano: {plano}
• Serviço: {servico}
• Nova data de vencimento: {vencimento}
• Valor: {valor}

Continue aproveitando todos os benefícios do seu plano!

Atenciosamente,
Equipe de Suporte`,
  },
  {
    id: 'expiration-warning',
    name: 'Aviso de Vencimento',
    category: 'expiration',
    icon: '⚠️',
    subject: 'Atenção: Seu plano está prestes a vencer!',
    body: `Olá {nome}!

Seu plano {plano} de {servico} vence em {vencimento}.

Não deixe para última hora! Renove agora e evite interrupções no seu serviço.

Benefícios de renovar:
✓ Acesso ininterrupto
✓ Suporte prioritário
✓ Todas as funcionalidades

Valor para renovação: {valor}

Aguardamos seu contato!

Atenciosamente,
Equipe de Suporte`,
  },
  {
    id: 'expired',
    name: 'Plano Expirado',
    category: 'expiration',
    icon: '🔴',
    subject: 'Seu plano expirou - Reative agora!',
    body: `Olá {nome}!

Notamos que seu plano {plano} de {servico} expirou em {vencimento}.

Sentimos sua falta! Para reativar seu acesso e voltar a aproveitar todos os benefícios, entre em contato conosco.

Estamos prontos para ajudá-lo(a) a escolher o melhor plano para suas necessidades.

Atenciosamente,
Equipe de Suporte`,
  },
  {
    id: 'credentials',
    name: 'Enviar Credenciais',
    category: 'custom',
    icon: '🔑',
    subject: 'Suas credenciais de acesso',
    body: `Olá {nome}!

Seguem suas credenciais de acesso ao serviço de {servico}:

• Usuário: {usuario}
• Senha: {senha}
{app_info}

Se tiver qualquer dúvida sobre como acessar, estamos à disposição!

Atenciosamente,
Equipe de Suporte`,
  },
  {
    id: 'custom',
    name: 'Mensagem Personalizada',
    category: 'custom',
    icon: '✏️',
    subject: '',
    body: '',
  },
];

export function replaceTemplateVariables(template: string, client: Client): string {
  const variables: Record<string, string> = {
    '{nome}': client.name,
    '{email}': client.email || '',
    '{whatsapp}': client.whatsapp,
    '{plano}': planLabels[client.plan],
    '{servico}': client.service,
    '{valor}': client.price ? formatCurrency(client.price) : 'A definir',
    '{vencimento}': format(client.expiresAt, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }),
    '{cadastro}': format(client.createdAt, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }),
    '{usuario}': client.serviceUsername || 'Não definido',
    '{senha}': client.servicePassword || 'Não definida',
    '{app_info}': client.service === 'IPTV' && client.appName 
      ? `• App: ${client.appName}${client.device ? `\n• Dispositivo: ${client.device}` : ''}`
      : '',
  };

  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
  }

  return result;
}

export function getTemplatesByCategory(category?: string): EmailTemplate[] {
  if (!category || category === 'all') {
    return emailTemplates;
  }
  return emailTemplates.filter(t => t.category === category);
}
