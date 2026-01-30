import { useState, useEffect } from 'react';
import { Client, planLabels, getExpirationStatus, getDaysUntilExpiration, planPrices, formatCurrency } from '@/types/client';
import { PlanBadge } from './PlanBadge';
import { ExpirationBadge } from './ExpirationBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Phone, Mail, Pencil, Trash2, Calendar, RefreshCw, History, ArrowRightLeft, Bell, StickyNote, MessageSquare, Bot } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ClientCardProps {
  client: Client;
  onEdit: (client: Client) => void;
  onDelete: (id: string) => void;
  onRenew: (id: string) => void;
  onViewHistory: (client: Client) => void;
  onChangePlan: (client: Client) => void;
  onViewNotifications: (client: Client) => void;
  onSendEmail: (client: Client) => void;
  onSendWhatsApp?: (client: Client) => void;
  onActivateAI?: (client: Client) => void;
  getPlanName?: (plan: string) => string;
}

export function ClientCard({ client, onEdit, onDelete, onRenew, onViewHistory, onChangePlan, onViewNotifications, onSendEmail, onSendWhatsApp, onActivateAI, getPlanName }: ClientCardProps) {
  const whatsappLink = `https://wa.me/${client.whatsapp.replace(/\D/g, '')}`;
  const status = getExpirationStatus(client.expiresAt);
   const needsAttention = status === 'expiring' || status === 'expired';
  const hasHistory = client.renewalHistory && client.renewalHistory.length > 0;
  const planName = getPlanName ? getPlanName(client.plan) : planLabels[client.plan];

  return (
    <Card className={cn(
      "group relative overflow-hidden transition-all duration-300 glass-card border-border/30 hover:border-primary/50 hover:shadow-[0_0_30px_hsl(260_100%_65%/0.15)]",
      status === 'expired' && "border-destructive/50 bg-destructive/5",
      status === 'expiring' && "border-plan-annual/50 bg-plan-annual/5"
    )}>
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <CardContent className="p-5 relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-lg truncate mb-1">
              {client.name}
            </h3>
            {client.price !== null && (
              <p className="text-sm text-muted-foreground mb-2">
                {formatCurrency(client.price)}
              </p>
            )}
            <div className="flex flex-wrap gap-1.5">
              <PlanBadge plan={client.plan} />
              <ExpirationBadge expiresAt={client.expiresAt} />
            </div>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onActivateAI && status === 'expired' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-primary"
                onClick={() => onActivateAI(client)}
                title="Ativar IA"
              >
                <Bot className="h-4 w-4" />
              </Button>
            )}
            {onSendWhatsApp && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-emerald-500"
                onClick={() => onSendWhatsApp(client)}
                title="Enviar WhatsApp"
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
            )}
            {client.email && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-primary"
                onClick={() => onSendEmail(client)}
                title="Enviar email"
              >
                <Mail className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-blue-600"
              onClick={() => onViewNotifications(client)}
              title="Ver notificações"
            >
              <Bell className="h-4 w-4" />
            </Button>
            {hasHistory && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-primary"
                onClick={() => onViewHistory(client)}
                title="Ver histórico de renovações"
              >
                <History className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-primary"
              onClick={() => onEdit(client)}
              title="Editar"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(client.id)}
              title="Excluir"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
          >
            <Phone className="h-4 w-4" />
            <span>{client.whatsapp}</span>
          </a>
          {client.email && (
            <a
              href={`mailto:${client.email}`}
              className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
            >
              <Mail className="h-4 w-4" />
              <span className="truncate">{client.email}</span>
            </a>
          )}
          
          {/* Notes section */}
          {client.notes && (
            <div className="flex items-start gap-2 text-muted-foreground bg-secondary/30 rounded-lg p-2 mt-2">
              <StickyNote className="h-4 w-4 flex-shrink-0 mt-0.5 text-primary" />
              <p className="text-xs leading-relaxed line-clamp-2">{client.notes}</p>
            </div>
          )}
          
          <div className="pt-2 border-t border-border/50 space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span className="text-xs">
                  Cadastrado em {format(client.createdAt, "dd 'de' MMM, yyyy", { locale: ptBR })}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span className="text-xs">
                  Vence em {format(client.expiresAt, "dd 'de' MMM, yyyy", { locale: ptBR })}
                </span>
              </div>
              {hasHistory && (
                <button
                  onClick={() => onViewHistory(client)}
                  className="text-xs text-primary hover:underline"
                >
                  {client.renewalHistory.length} renovação{client.renewalHistory.length > 1 ? 'ões' : ''}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 mt-4">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5"
              onClick={() => onChangePlan(client)}
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              Trocar Plano
            </Button>
            <Button
              variant={needsAttention ? "default" : "outline"}
              size="sm"
              className={cn(
                "flex-1 gap-1.5",
                needsAttention && status === 'expired' && "bg-destructive hover:bg-destructive/90",
                needsAttention && status === 'expiring' && "bg-plan-annual hover:bg-plan-annual/90"
              )}
              onClick={() => onRenew(client.id)}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Renovar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
