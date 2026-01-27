import { useMemo } from 'react';
import { Client, getExpirationStatus } from '@/types/client';
import { WhatsAppInstance } from '@/hooks/useWhatsAppInstances';
import { Card, CardContent } from '@/components/ui/card';
import { Users, UserCheck, UserX, AlertTriangle, Wifi, WifiOff, MessageSquare, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickKPIsProps {
  clients: Client[];
  instances: WhatsAppInstance[];
  pendingMessages?: number;
  unreadConversations?: number;
}

export function QuickKPIs({ clients, instances, pendingMessages = 0, unreadConversations = 0 }: QuickKPIsProps) {
  const stats = useMemo(() => {
    const activeClients = clients.filter(c => getExpirationStatus(c.expiresAt) === 'active').length;
    const expiringClients = clients.filter(c => getExpirationStatus(c.expiresAt) === 'expiring').length;
    const expiredClients = clients.filter(c => getExpirationStatus(c.expiresAt) === 'expired').length;
    const connectedInstances = instances.filter(i => i.status === 'connected').length;
    const disconnectedInstances = instances.filter(i => i.status !== 'connected').length;

    return {
      total: clients.length,
      active: activeClients,
      expiring: expiringClients,
      expired: expiredClients,
      connected: connectedInstances,
      disconnected: disconnectedInstances,
      totalInstances: instances.length,
    };
  }, [clients, instances]);

  const kpis = [
    {
      label: 'Clientes Ativos',
      value: stats.active,
      icon: UserCheck,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30',
    },
    {
      label: 'Expirando',
      value: stats.expiring,
      icon: AlertTriangle,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/30',
      alert: stats.expiring > 0,
    },
    {
      label: 'Expirados',
      value: stats.expired,
      icon: UserX,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      borderColor: 'border-destructive/30',
      alert: stats.expired > 0,
    },
    {
      label: 'WhatsApp Online',
      value: `${stats.connected}/${stats.totalInstances}`,
      icon: stats.disconnected > 0 ? WifiOff : Wifi,
      color: stats.disconnected > 0 ? 'text-amber-500' : 'text-emerald-500',
      bgColor: stats.disconnected > 0 ? 'bg-amber-500/10' : 'bg-emerald-500/10',
      borderColor: stats.disconnected > 0 ? 'border-amber-500/30' : 'border-emerald-500/30',
      alert: stats.disconnected > 0,
    },
    {
      label: 'Conversas Não Lidas',
      value: unreadConversations,
      icon: MessageSquare,
      color: unreadConversations > 0 ? 'text-primary' : 'text-muted-foreground',
      bgColor: unreadConversations > 0 ? 'bg-primary/10' : 'bg-muted/50',
      borderColor: unreadConversations > 0 ? 'border-primary/30' : 'border-border',
      alert: unreadConversations > 0,
    },
    {
      label: 'Mensagens Pendentes',
      value: pendingMessages,
      icon: Clock,
      color: pendingMessages > 0 ? 'text-accent' : 'text-muted-foreground',
      bgColor: pendingMessages > 0 ? 'bg-accent/10' : 'bg-muted/50',
      borderColor: pendingMessages > 0 ? 'border-accent/30' : 'border-border',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {kpis.map((kpi, index) => (
        <Card 
          key={kpi.label}
          className={cn(
            "group relative overflow-hidden border transition-all duration-300",
            "hover:scale-[1.02] hover:-translate-y-1",
            kpi.borderColor,
            kpi.alert && "pulse-soft"
          )}
        >
          {/* Subtle gradient accent on hover */}
          <div className={cn(
            "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300",
            "bg-gradient-to-br from-transparent via-transparent to-primary/5"
          )} />
          
          <CardContent className="p-4 flex items-center gap-3 relative">
            <div className={cn(
              "p-2.5 rounded-xl transition-all duration-300",
              "group-hover:scale-110 group-hover:shadow-lg",
              kpi.bgColor
            )}>
              <kpi.icon className={cn("h-5 w-5", kpi.color)} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-2xl font-bold tracking-tight">{kpi.value}</p>
              <p className="text-xs text-muted-foreground truncate">{kpi.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
