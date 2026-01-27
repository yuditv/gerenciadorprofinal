import { Client, planLabels, getExpirationStatus, planPrices, formatCurrency } from '@/types/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function exportClientsToCSV(clients: Client[]): void {
  const headers = [
    'Nome',
    'WhatsApp',
    'Email',
    'Plano',
    'Valor do Plano',
    'Status',
    'Data de Cadastro',
    'Data de Vencimento',
    'Total de Renovações'
  ];

  const rows = clients.map(client => {
    const status = getExpirationStatus(client.expiresAt);
    const statusLabel = status === 'active' ? 'Ativo' : status === 'expiring' ? 'Expirando' : 'Vencido';
    
    return [
      client.name,
      client.whatsapp,
      client.email,
      planLabels[client.plan],
      formatCurrency(planPrices[client.plan]),
      statusLabel,
      format(client.createdAt, 'dd/MM/yyyy', { locale: ptBR }),
      format(client.expiresAt, 'dd/MM/yyyy', { locale: ptBR }),
      client.renewalHistory.length.toString()
    ];
  });

  const csvContent = [
    headers.join(';'),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(';'))
  ].join('\n');

  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `clientes_${format(new Date(), 'yyyy-MM-dd')}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportRenewalHistoryToCSV(clients: Client[]): void {
  const headers = [
    'Cliente',
    'Plano',
    'Data da Renovação',
    'Vencimento Anterior',
    'Novo Vencimento'
  ];

  const rows: string[][] = [];
  
  clients.forEach(client => {
    client.renewalHistory.forEach(renewal => {
      rows.push([
        client.name,
        planLabels[renewal.plan],
        format(renewal.date, 'dd/MM/yyyy HH:mm', { locale: ptBR }),
        format(renewal.previousExpiresAt, 'dd/MM/yyyy', { locale: ptBR }),
        format(renewal.newExpiresAt, 'dd/MM/yyyy', { locale: ptBR })
      ]);
    });
  });

  if (rows.length === 0) {
    return;
  }

  const csvContent = [
    headers.join(';'),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(';'))
  ].join('\n');

  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `historico_renovacoes_${format(new Date(), 'yyyy-MM-dd')}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
