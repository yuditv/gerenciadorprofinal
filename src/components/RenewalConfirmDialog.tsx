import { Client, planLabels, getExpirationStatus, getDaysUntilExpiration, formatCurrency, planDurations } from '@/types/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  RefreshCw, Calendar, User, Phone, Mail, CreditCard, 
  Clock, ExternalLink, ShoppingBag, StickyNote, Shield,
  AlertTriangle, CheckCircle
} from 'lucide-react';
import { format, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface RenewalConfirmDialogProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (clientId: string) => void;
  getPlanName?: (plan: string) => string;
}

const STORE_URL = 'https://loja-oficial-nine.vercel.app/';

export function RenewalConfirmDialog({ client, open, onOpenChange, onConfirm, getPlanName }: RenewalConfirmDialogProps) {
  if (!client) return null;

  const status = getExpirationStatus(client.expiresAt);
  const daysLeft = getDaysUntilExpiration(client.expiresAt);
  const planName = getPlanName ? getPlanName(client.plan) : planLabels[client.plan];
  const duration = planDurations[client.plan];
  const newExpiresAt = addMonths(new Date(), duration);

  const handleConfirm = () => {
    onConfirm(client.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md glass-card border-primary/20">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <RefreshCw className="h-5 w-5 text-primary" />
            🔄 Renovação de Plano
          </DialogTitle>
          <DialogDescription>
            Confira os detalhes do cliente antes de renovar
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Client Info */}
          <div className="p-3 rounded-lg bg-muted/50 border border-border/50 space-y-2">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <span className="font-semibold text-foreground">{client.name}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-3.5 w-3.5" />
              <span>{client.whatsapp}</span>
            </div>
            {client.email && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                <span>{client.email}</span>
              </div>
            )}
            {client.notes && (
              <div className="flex items-start gap-2 text-sm text-muted-foreground mt-1">
                <StickyNote className="h-3.5 w-3.5 mt-0.5 text-primary" />
                <span className="line-clamp-2">{client.notes}</span>
              </div>
            )}
          </div>

          <Separator />

          {/* Plan & Dates */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <CreditCard className="h-4 w-4 text-primary" />
                <span className="text-muted-foreground">📋 Plano Atual:</span>
              </div>
              <Badge variant="outline" className="font-medium">
                {planName}
              </Badge>
            </div>

            {client.price !== null && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">💰 Valor:</span>
                </div>
                <span className="font-semibold text-primary">{formatCurrency(client.price)}</span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-emerald-500" />
                <span className="text-muted-foreground">📅 Data de Ativação:</span>
              </div>
              <span className="text-sm font-medium">
                {format(client.createdAt, "dd/MM/yyyy", { locale: ptBR })}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Clock className={cn("h-4 w-4", status === 'expired' ? 'text-destructive' : status === 'expiring' ? 'text-yellow-500' : 'text-muted-foreground')} />
                <span className="text-muted-foreground">⏳ Data de Expiração:</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {format(client.expiresAt, "dd/MM/yyyy", { locale: ptBR })}
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs",
                    status === 'expired' && "border-destructive/50 text-destructive",
                    status === 'expiring' && "border-yellow-500/50 text-yellow-500",
                    status === 'active' && "border-emerald-500/50 text-emerald-500"
                  )}
                >
                  {status === 'expired' 
                    ? `❌ Expirado há ${Math.abs(daysLeft)} dias` 
                    : status === 'expiring' 
                      ? `⚠️ Expira em ${daysLeft} dias` 
                      : `✅ Ativo (${daysLeft} dias restantes)`}
                </Badge>
              </div>
            </div>

            {/* Service credentials */}
            {client.serviceUsername && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">👤 Usuário:</span>
                </div>
                <span className="text-sm font-medium font-mono">{client.serviceUsername}</span>
              </div>
            )}
          </div>

          <Separator />

          {/* New expiration after renewal */}
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
            <p className="text-sm font-medium text-primary flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              🆕 Após a renovação:
            </p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Nova expiração:</span>
              <span className="font-semibold text-foreground">
                {format(newExpiresAt, "dd/MM/yyyy", { locale: ptBR })}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Duração:</span>
              <span className="text-foreground">
                {duration} {duration === 1 ? 'mês' : 'meses'}
              </span>
            </div>
          </div>

          {/* Store Link */}
          <a
            href={STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border/50 hover:border-primary/30 transition-colors group"
          >
            <ShoppingBag className="h-4 w-4 text-primary" />
            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors flex-1">
              🛒 Acessar Loja Oficial
            </span>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
          </a>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 border-primary/30"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            className="flex-1 btn-futuristic gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            ✅ Confirmar Renovação
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
