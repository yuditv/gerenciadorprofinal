import type { VPNTestFormValues } from "./types";

export function buildVPNTestTemplate(values: VPNTestFormValues) {
  const lines = [
    `Usuário: ${values.username}`,
    `Senha: ${values.password}`,
    `Conexões: ${values.connectionLimit}`,
    `Minutos: ${values.minutes}`,
  ];

  if (values.v2rayEnabled) {
    lines.push(`V2Ray UUID: ${values.v2rayUuid}`);
  }

  return lines.join("\n");
}
