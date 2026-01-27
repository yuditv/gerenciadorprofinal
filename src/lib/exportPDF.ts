import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Client, planLabels, getExpirationStatus, formatCurrency, planPrices, planMonthlyEquivalent, planDurations } from '@/types/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface RetentionMetrics {
  totalClients: number;
  activeClients: number;
  expiringClients: number;
  expiredClients: number;
  retainedClients: number;
  totalRenewals: number;
  retentionRate: number;
  churnRate: number;
  atRiskRate: number;
  mrr: number;
  atRiskMrr: number;
  ltv: number;
}

function calculateMetrics(clients: Client[]): RetentionMetrics {
  const activeClients = clients.filter(c => getExpirationStatus(c.expiresAt) === 'active');
  const expiringClients = clients.filter(c => getExpirationStatus(c.expiresAt) === 'expiring');
  const expiredClients = clients.filter(c => getExpirationStatus(c.expiresAt) === 'expired');
  const totalRenewals = clients.reduce((acc, c) => acc + (c.renewalHistory?.length || 0), 0);
  const retainedClients = clients.filter(c => c.renewalHistory && c.renewalHistory.length > 0);

  const retentionRate = clients.length > 0 
    ? (retainedClients.length / clients.length) * 100 
    : 0;

  const churnRate = clients.length > 0 
    ? (expiredClients.length / clients.length) * 100 
    : 0;

  const atRiskRate = clients.length > 0 
    ? (expiringClients.length / clients.length) * 100 
    : 0;

  const mrr = activeClients.reduce((acc, client) => {
    const monthlyValue = client.price !== null 
      ? client.price / planDurations[client.plan]
      : planMonthlyEquivalent[client.plan];
    return acc + monthlyValue;
  }, 0);

  const atRiskMrr = expiringClients.reduce((acc, client) => {
    const monthlyValue = client.price !== null 
      ? client.price / planDurations[client.plan]
      : planMonthlyEquivalent[client.plan];
    return acc + monthlyValue;
  }, 0);

  const avgMonthlyRevenue = clients.length > 0 
    ? clients.reduce((acc, c) => {
        const monthlyValue = c.price !== null 
          ? c.price / planDurations[c.plan]
          : planMonthlyEquivalent[c.plan];
        return acc + monthlyValue;
      }, 0) / clients.length 
    : 0;

  const ltv = avgMonthlyRevenue * 12; // Simplified LTV estimate

  return {
    totalClients: clients.length,
    activeClients: activeClients.length,
    expiringClients: expiringClients.length,
    expiredClients: expiredClients.length,
    retainedClients: retainedClients.length,
    totalRenewals,
    retentionRate,
    churnRate,
    atRiskRate,
    mrr,
    atRiskMrr,
    ltv,
  };
}

export function exportReportToPDF(clients: Client[], getPlanName?: (plan: string) => string): void {
  const doc = new jsPDF();
  const metrics = calculateMetrics(clients);
  const today = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  // Title
  doc.setFontSize(20);
  doc.setTextColor(99, 102, 241); // Primary color
  doc.text('Relatório de Clientes', 14, 20);

  // Date
  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  doc.text(`Gerado em: ${today}`, 14, 28);

  // Metrics Section
  doc.setFontSize(14);
  doc.setTextColor(17, 24, 39);
  doc.text('Métricas de Retenção', 14, 42);

  // Metrics table
  autoTable(doc, {
    startY: 46,
    head: [['Métrica', 'Valor']],
    body: [
      ['Total de Clientes', metrics.totalClients.toString()],
      ['Clientes Ativos', metrics.activeClients.toString()],
      ['Clientes Próximo de Expirar', metrics.expiringClients.toString()],
      ['Clientes Expirados', metrics.expiredClients.toString()],
      ['Taxa de Retenção', `${metrics.retentionRate.toFixed(1)}%`],
      ['Taxa de Churn', `${metrics.churnRate.toFixed(1)}%`],
      ['MRR Ativo', formatCurrency(metrics.mrr)],
      ['MRR Próximo de Expirar', formatCurrency(metrics.atRiskMrr)],
      ['LTV Médio', formatCurrency(metrics.ltv)],
      ['Total de Renovações', metrics.totalRenewals.toString()],
    ],
    theme: 'striped',
    headStyles: { fillColor: [99, 102, 241] },
    styles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 50, halign: 'right' },
    },
  });

  // Get current Y position after table
  const metricsEndY = (doc as any).lastAutoTable.finalY + 15;

  // Clients Section
  doc.setFontSize(14);
  doc.setTextColor(17, 24, 39);
  doc.text('Lista de Clientes', 14, metricsEndY);

  // Prepare client data
  const clientData = clients.map(client => {
    const status = getExpirationStatus(client.expiresAt);
    const statusLabel = status === 'active' ? 'Ativo' : status === 'expiring' ? 'Expirando' : 'Expirado';
    const planName = getPlanName ? getPlanName(client.plan) : planLabels[client.plan];
    
    return [
      client.name,
      client.email,
      planName,
      formatCurrency(planPrices[client.plan]),
      format(client.expiresAt, 'dd/MM/yyyy'),
      statusLabel,
      (client.renewalHistory?.length || 0).toString(),
    ];
  });

  // Clients table
  autoTable(doc, {
    startY: metricsEndY + 4,
    head: [['Nome', 'Email', 'Plano', 'Valor', 'Vencimento', 'Status', 'Renovações']],
    body: clientData,
    theme: 'striped',
    headStyles: { fillColor: [99, 102, 241] },
    styles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 45 },
      2: { cellWidth: 25 },
      3: { cellWidth: 22, halign: 'right' },
      4: { cellWidth: 22 },
      5: { cellWidth: 20 },
      6: { cellWidth: 18, halign: 'center' },
    },
    didParseCell: function(data) {
      if (data.section === 'body' && data.column.index === 5) {
        const status = data.cell.raw as string;
        if (status === 'Expirado') {
          data.cell.styles.textColor = [239, 68, 68];
        } else if (status === 'Expirando') {
          data.cell.styles.textColor = [245, 158, 11];
        } else {
          data.cell.styles.textColor = [34, 197, 94];
        }
      }
    },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(
      `Página ${i} de ${pageCount}`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    );
  }

  // Save
  doc.save(`relatorio-clientes-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}
