import { useCallback, useState } from "react";
import { usePersistedState } from "./usePersistedState";

// Dicionário de erros comuns em português (erro → correção)
const CORRECTIONS: Record<string, string> = {
  // Acentuação e ortografia
  "voce": "você",
  "vc": "você",
  "tb": "também",
  "tbm": "também",
  "tambem": "também",
  "nao": "não",
  "entao": "então",
  "obrigadoo": "obrigado",
  "obrigadooo": "obrigado",
  "obrigadaa": "obrigada",
  "obrigadaaa": "obrigada",
  "ateh": "até",
  "ate": "até",
  "eh": "é",
  "esta": "está",
  "ja": "já",
  "so": "só",
  "nos": "nós",
  "pra": "para",
  "pro": "para o",
  "tah": "tá",
  "neh": "né",
  "pq": "porque",
  "porq": "porque",
  "porquê": "por quê",
  "qdo": "quando",
  "qnd": "quando",
  "qndo": "quando",
  "qto": "quanto",
  "qts": "quantos",
  "dnv": "de novo",
  "dps": "depois",
  "hj": "hoje",
  "hr": "hora",
  "hrs": "horas",
  "min": "minutos",
  "mins": "minutos",
  "seg": "segundos",
  "msg": "mensagem",
  "msgs": "mensagens",
  "msm": "mesmo",
  "mto": "muito",
  "mt": "muito",
  "mts": "muitos",
  "cmg": "comigo",
  "ctg": "contigo",
  "ngm": "ninguém",
  "ninguem": "ninguém",
  "alguem": "alguém",
  "td": "tudo",
  "tdo": "tudo",
  "tds": "todos",
  "oq": "o que",
  "oque": "o que",
  "blz": "beleza",
  "vlw": "valeu",
  "flw": "falou",
  "tmj": "tamo junto",
  "sqn": "só que não",
  "agr": "agora",
  "fds": "fim de semana",
  "pfv": "por favor",
  "pfvr": "por favor",
  "obg": "obrigado",
  "brigado": "obrigado",
  "brigada": "obrigada",

  // Erros comuns de digitação
  "concerteza": "com certeza",
  "derrepente": "de repente",
  "derepente": "de repente",
  "agente": "a gente",
  "mim fazer": "eu fazer",
  "mim mandar": "eu mandar",
  "mim enviar": "eu enviar",
  "menas": "menos",
  "poblema": "problema",
  "pobrema": "problema",
  "preblema": "problema",
  "ezemplo": "exemplo",
  "exenplo": "exemplo",
  "encima": "em cima",
  "embaixo": "em baixo",
  "afim": "a fim",
  "apartir": "a partir",
  "aonde": "onde",
  "agradesso": "agradeço",
  "agradeco": "agradeço",
  "excessão": "exceção",
  "excesão": "exceção",
  "precizar": "precisar",
  "analizar": "analisar",
  "pesquizar": "pesquisar",
  "paralizar": "paralisar",
  "utilizar": "utilizar",
  "necesario": "necessário",
  "necessario": "necessário",
  "geito": "jeito",
  "tiver-mos": "tivermos",
  "fizemos": "fizemos",
  "quizer": "quiser",
  "compania": "companhia",
  "exclarecer": "esclarecer",
  "exclareça": "esclareça",
  "exclarecimento": "esclarecimento",
  "previlégio": "privilégio",
  "privilégio": "privilégio",
  "cosseguir": "conseguir",
  "conceguir": "conseguir",
  "excessivamente": "excessivamente",

  // Abreviações de atendimento
  "info": "informação",
  "infos": "informações",
  "config": "configuração",
  "configs": "configurações",
  "cad": "cadastro",

  // Erros de cedilha e acentuação
  "situacao": "situação",
  "informacao": "informação",
  "configuracao": "configuração",
  "solucao": "solução",
  "atencao": "atenção",
  "promocao": "promoção",
  "operacao": "operação",
  "comunicacao": "comunicação",
  "aplicacao": "aplicação",
  "funcao": "função",
  "conexao": "conexão",
  "assinatura": "assinatura",
  "ativacao": "ativação",
  "renovacao": "renovação",
  "verificacao": "verificação",
  
  // Saudações e cordialidades
  "bom dia": "bom dia",
  "boa tardi": "boa tarde",
  "boa noiti": "boa noite",
  "boua tarde": "boa tarde",
  "oi tudo bem": "oi, tudo bem",
  "oii": "oi",
  "oiee": "oi",
  "olaa": "olá",
  "ola": "olá",
};

// Build a case-insensitive lookup
const CORRECTIONS_LOWER = new Map<string, string>();
Object.entries(CORRECTIONS).forEach(([key, val]) => {
  CORRECTIONS_LOWER.set(key.toLowerCase(), val);
});

/**
 * Corrige a última palavra digitada quando o usuário pressiona espaço.
 * Retorna o texto corrigido e se houve correção.
 */
function correctLastWord(text: string): { corrected: string; wasFixed: boolean } {
  // Apenas corrigir se termina com espaço (palavra acabou de ser completada)
  if (!text.endsWith(" ")) return { corrected: text, wasFixed: false };

  const trimmed = text.trimEnd();
  
  // Encontrar a última "palavra" (pode ser multi-word para expressões compostas)
  // Primeiro, tenta a última palavra simples
  const lastSpaceIdx = trimmed.lastIndexOf(" ");
  const lastWord = lastSpaceIdx >= 0 ? trimmed.slice(lastSpaceIdx + 1) : trimmed;
  
  if (!lastWord) return { corrected: text, wasFixed: false };
  
  const lowerWord = lastWord.toLowerCase();
  const fix = CORRECTIONS_LOWER.get(lowerWord);
  
  if (fix && fix.toLowerCase() !== lowerWord) {
    // Preservar capitalização se a primeira letra era maiúscula
    const replacement = lastWord[0] === lastWord[0].toUpperCase() 
      ? fix.charAt(0).toUpperCase() + fix.slice(1) 
      : fix;
    
    const prefix = lastSpaceIdx >= 0 ? trimmed.slice(0, lastSpaceIdx + 1) : "";
    return { corrected: prefix + replacement + " ", wasFixed: true };
  }
  
  // Tentar combinação de duas últimas palavras
  if (lastSpaceIdx > 0) {
    const prevSpaceIdx = trimmed.lastIndexOf(" ", lastSpaceIdx - 1);
    const twoWords = prevSpaceIdx >= 0 
      ? trimmed.slice(prevSpaceIdx + 1) 
      : trimmed;
    const lowerTwo = twoWords.toLowerCase();
    const fix2 = CORRECTIONS_LOWER.get(lowerTwo);
    
    if (fix2 && fix2.toLowerCase() !== lowerTwo) {
      const prefix = prevSpaceIdx >= 0 ? trimmed.slice(0, prevSpaceIdx + 1) : "";
      return { corrected: prefix + fix2 + " ", wasFixed: true };
    }
  }
  
  return { corrected: text, wasFixed: false };
}

export function useAutoCorrect() {
  const [isEnabled, setIsEnabled] = usePersistedState("autocorrect-enabled", true);
  const [lastCorrection, setLastCorrection] = useState<{ original: string; fixed: string } | null>(null);

  const processText = useCallback((text: string): string => {
    if (!isEnabled) return text;
    
    const { corrected, wasFixed } = correctLastWord(text);
    
    if (wasFixed) {
      // Store last correction for potential undo
      const trimmed = text.trimEnd();
      const lastSpaceIdx = trimmed.lastIndexOf(" ");
      const lastWord = lastSpaceIdx >= 0 ? trimmed.slice(lastSpaceIdx + 1) : trimmed;
      setLastCorrection({ original: lastWord, fixed: corrected.trimEnd().split(" ").pop() || "" });
    }
    
    return corrected;
  }, [isEnabled]);

  const toggleEnabled = useCallback(() => {
    setIsEnabled((prev: boolean) => !prev);
  }, [setIsEnabled]);

  return {
    isEnabled,
    toggleEnabled,
    processText,
    lastCorrection,
  };
}
