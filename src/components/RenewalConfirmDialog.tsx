import { Client, planLabels, getExpirationStatus, getDaysUntilExpiration, formatCurrency, planDurations } from '@/types/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  RefreshCw, Calendar, User, Phone, Mail, CreditCard, 
  Clock, ExternalLink, ShoppingBag, StickyNote, Shield,
  AlertTriangle, CheckCircle, Link2, Copy, Check, MessageSquare
} from 'lucide-react';
import { toast } from 'sonner';
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
const WHATSAPP_CHANNEL_URL = 'https://whatsapp.com/channel/0029VaiMJxt8F2pDwXgnbY2r';

export function RenewalConfirmDialog({ client, open, onOpenChange, onConfirm, getPlanName }: RenewalConfirmDialogProps) {
  const [copiedRef, setCopiedRef] = useState(false);

  if (!client) return null;

  const status = getExpirationStatus(client.expiresAt);
  const daysLeft = getDaysUntilExpiration(client.expiresAt);
  const planName = getPlanName ? getPlanName(client.plan) : planLabels[client.plan];
  const duration = planDurations[client.plan];
  const newExpiresAt = addMonths(new Date(), duration);
  const referralLink = `${STORE_URL}?ref=${client.referralCode}`;

  const handleCopyReferral = () => {
    navigator.clipboard.writeText(referralLink);
    setCopiedRef(true);
    toast.success('Link de indicação copiado!');
    setTimeout(() => setCopiedRef(false), 2000);
  };

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

          {/* WhatsApp Channel Link */}
          <a
            href={WHATSAPP_CHANNEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 hover:border-emerald-500/40 transition-colors group"
          >
            <MessageSquare className="h-4 w-4 text-emerald-500" />
            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors flex-1">
              📢 Canal de Atualizações no WhatsApp
            </span>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-emerald-500 transition-colors" />
          </a>

          {/* Referral Link */}
          <div className="p-3 rounded-lg bg-muted/50 border border-border/50 space-y-2">
            <p className="text-sm font-medium flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" />
              🔗 Link de Indicação
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-background/50 rounded px-2 py-1.5 text-muted-foreground truncate border border-border/30">
                {referralLink}
              </code>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5 border-primary/20"
                onClick={handleCopyReferral}
              >
                {copiedRef ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedRef ? 'Copiado!' : 'Copiar'}
              </Button>
            </div>
          </div>
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
