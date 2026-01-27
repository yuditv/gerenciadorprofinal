/**
 * Spintax Parser
 * Handles syntax like: {{ key : option1 | option2 | option3 }}
 * Randomly selects one option for each key
 */

export interface SpintaxMatch {
  full: string;
  key: string;
  options: string[];
}

/**
 * Find all spintax patterns in a text
 */
export function findSpintaxPatterns(text: string): SpintaxMatch[] {
  const regex = /\{\{\s*([^:]+?)\s*:\s*([^}]+?)\s*\}\}/g;
  const matches: SpintaxMatch[] = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    const key = match[1].trim();
    const optionsStr = match[2];
    const options = optionsStr.split('|').map(opt => opt.trim()).filter(Boolean);
    
    matches.push({
      full: match[0],
      key,
      options
    });
  }

  return matches;
}

/**
 * Process spintax in text, replacing each pattern with a random option
 */
export function processSpintax(text: string): string {
  const patterns = findSpintaxPatterns(text);
  let result = text;

  for (const pattern of patterns) {
    const randomIndex = Math.floor(Math.random() * pattern.options.length);
    const selectedOption = pattern.options[randomIndex];
    result = result.replace(pattern.full, selectedOption);
  }

  return result;
}

/**
 * Replace variables in text with contact data
 */
export function replaceVariables(
  text: string, 
  contact: {
    name?: string;
    phone?: string;
    plan?: string;
    expires_at?: string;
    link?: string;
    email?: string;
    [key: string]: any;
  }
): string {
  let result = text;

  // Standard variables
  const firstName = contact.name?.split(' ')[0] || '';
  const daysUntilExpiry = contact.expires_at 
    ? Math.ceil((new Date(contact.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  const variables: Record<string, string> = {
    '{nome}': contact.name || '',
    '{primeiro_nome}': firstName,
    '{telefone}': contact.phone || '',
    '{plano}': contact.plan || '',
    '{vencimento}': contact.expires_at 
      ? new Date(contact.expires_at).toLocaleDateString('pt-BR')
      : '',
    '{dias}': String(daysUntilExpiry),
    '{link}': contact.link || '',
    '{email}': contact.email || '',
  };

  // Replace standard variables
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'gi'), value);
  }

  // Replace custom variables from contact.variables (if any)
  if (contact.variables && typeof contact.variables === 'object') {
    for (const [key, value] of Object.entries(contact.variables)) {
      result = result.replace(
        new RegExp(`\\{${key}\\}`, 'gi'), 
        String(value)
      );
    }
  }

  return result;
}

/**
 * Process both spintax and variables
 */
export function processMessage(
  text: string,
  contact: Parameters<typeof replaceVariables>[1]
): string {
  // First process spintax (random selection)
  let result = processSpintax(text);
  // Then replace variables
  result = replaceVariables(result, contact);
  return result;
}

/**
 * Generate preview with sample data
 */
export function generatePreview(text: string): string {
  const sampleContact = {
    name: 'João Silva',
    phone: '5511999998888',
    plan: 'Premium',
    expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    link: 'https://exemplo.com/renovar',
    email: 'joao@email.com'
  };

  return processMessage(text, sampleContact);
}

/**
 * Validate spintax syntax
 */
export function validateSpintax(text: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check for unclosed brackets
  const openCount = (text.match(/\{\{/g) || []).length;
  const closeCount = (text.match(/\}\}/g) || []).length;
  
  if (openCount !== closeCount) {
    errors.push('Chaves {{ }} não balanceadas');
  }

  // Check for patterns without colon separator
  const badPatterns = text.match(/\{\{[^:}]+\}\}/g) || [];
  if (badPatterns.length > 0) {
    errors.push('Padrão Spintax deve ter ":" separando chave das opções');
  }

  // Check for patterns without options
  const patterns = findSpintaxPatterns(text);
  for (const p of patterns) {
    if (p.options.length < 2) {
      errors.push(`Spintax "${p.key}" deve ter pelo menos 2 opções separadas por "|"`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Common spintax suggestions
 */
export const SPINTAX_SUGGESTIONS = [
  { key: 'saudacao', options: ['Olá', 'Oi', 'E aí', 'Hey'] },
  { key: 'emoji_saudacao', options: ['👋', '😊', '🙂', '✨'] },
  { key: 'emoji_urgencia', options: ['⚠️', '🚨', '❗', '⏰'] },
  { key: 'chamada', options: ['tudo bem?', 'como vai?', 'tudo certo?', 'beleza?'] },
  { key: 'despedida', options: ['Abraço!', 'Até logo!', 'Atenciosamente,', 'Grande abraço!'] },
];
