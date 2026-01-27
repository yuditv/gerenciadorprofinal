import { useMemo, useEffect, useState } from 'react';
import { Client, getExpirationStatus, getDaysUntilExpiration, formatCurrency, planLabels } from '@/types/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  User, 
  Phone, 
  Mail, 
  Calendar, 
  CreditCard, 
  History, 
  RefreshCw, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Package,
  StickyNote,
  ExternalLink,
  UserPlus,
  UserCheck
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { AIMemoryPanel } from './AIMemoryPanel';
import { supabase } from '@/integrations/supabase/client';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ClientInfoPanelProps {
  client: Client | null;
  isLoading?: boolean;
  onRenew?: (id: string) => void;
  onEdit?: (client: Client) => void;
  onRegisterClient?: (phone: string, name?: string) => void;
  phone?: string;
  contactName?: string;
  contactAvatar?: string | null;
  agentId?: string | null;
}

// Helper function to get initials
const getInitials = (name?: string | null, phone?: string | null): string => {
  if (name) {
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
  if (phone) {
    return phone.slice(-2);
  }
  return '??';
};

export function ClientInfoPanel({ 
  client, 
  isLoading,
  onRenew, 
  onEdit,
  onRegisterClient,
  phone,
  contactName,
  contactAvatar,
  agentId
}: ClientInfoPanelProps) {
  const [existingClient, setExistingClient] = useState<{ name: string; whatsapp: string } | null>(null);
  const [checkingClient, setCheckingClient] = useState(false);

  // Check if client already exists when client is null but phone is available
  useEffect(() => {
    const checkExistingClient = async () => {
      if (client || !phone) {
        setExistingClient(null);
        return;
      }

      setCheckingClient(true);
      try {
        // Normalize phone for search
        const normalizedPhone = phone.replace(/[^\d]/g, '');
        
        // Search for client with similar phone patterns
        const { data } = await supabase
          .from('clients')
          .select('name, whatsapp')
          .or(`whatsapp.ilike.%${normalizedPhone.slice(-8)}%,whatsapp.ilike.%${normalizedPhone.slice(-9)}%`)
          .limit(1)
          .maybeSingle();

        setExistingClient(data);
      } catch (error) {
        console.error('Error checking existing client:', error);
      } finally {
        setCheckingClient(false);
      }
    };

    checkExistingClient();
  }, [client, phone]);

  const status = client ? getExpirationStatus(client.expiresAt) : null;
  const daysUntil = client ? getDaysUntilExpiration(client.expiresAt) : 0;

  const statusConfig = useMemo(() => {
    if (!status) return null;
    
    switch (status) {
      case 'active':
        return {
          label: 'Ativo',
          icon: CheckCircle,
          color: 'text-emerald-500',
          bgColor: 'bg-emerald-500/10',
          borderColor: 'border-emerald-500/30',
        };
      case 'expiring':
        return {
          label: `Expira em ${daysUntil} dia${daysUntil !== 1 ? 's' : ''}`,
          icon: AlertTriangle,
          color: 'text-amber-500',
          bgColor: 'bg-amber-500/10',
          borderColor: 'border-amber-500/30',
        };
      case 'expired':
        return {
          label: `Expirado há ${Math.abs(daysUntil)} dia${Math.abs(daysUntil) !== 1 ? 's' : ''}`,
          icon: XCircle,
          color: 'text-destructive',
          bgColor: 'bg-destructive/10',
          borderColor: 'border-destructive/30',
        };
    }
  }, [status, daysUntil]);

  if (isLoading) {
    return (
      <Card className="glass-card h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="h-4 w-4" />
            Dados do Cliente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 animate-pulse">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
            <div className="h-4 bg-muted rounded w-2/3" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Client not found - show WhatsApp profile info + register option
  if (!client) {
    return (
      <div className="space-y-3 h-full">
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <User className="h-4 w-4" />
              Dados do Cliente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-4">
              {/* Avatar do WhatsApp */}
              <Avatar className="h-16 w-16 mx-auto mb-3">
                <AvatarImage src={contactAvatar || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-lg">
                  {getInitials(contactName, phone)}
                </AvatarFallback>
              </Avatar>
              
              {/* Nome do contato */}
              {contactName && (
                <p className="font-medium text-sm mb-1">
                  {contactName}
                </p>
              )}
              
              {/* Número de telefone */}
              {phone && (
                <p className="text-xs text-muted-foreground mb-2">
                  {phone}
                </p>
              )}
              
              {/* Badge indicando status de cadastro */}
              {existingClient ? (
                <Badge variant="secondary" className="text-xs mb-4 gap-1 bg-amber-500/10 text-amber-600 border-amber-500/30">
                  <UserCheck className="h-3 w-3" />
                  Já cadastrado
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs mb-4">
                  Não cadastrado
                </Badge>
              )}
              
              {/* Botão Cadastrar com aviso se já existe */}
              {onRegisterClient && (
                existingClient ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        size="sm" 
                        variant="secondary"
                        onClick={() => onRegisterClient(phone || '', contactName)}
                        className="w-full gap-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 border border-amber-500/30"
                      >
                        <AlertTriangle className="h-4 w-4" />
                        Cliente Já Cadastrado
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[250px]">
                      <p className="text-xs">
                        <strong>{existingClient.name}</strong> já está cadastrado com o número {existingClient.whatsapp}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Button 
                    size="sm" 
                    onClick={() => onRegisterClient(phone || '', contactName)}
                    className="w-full gap-2"
                    disabled={checkingClient}
                  >
                    {checkingClient ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <UserPlus className="h-4 w-4" />
                    )}
                    Cadastrar Cliente
                  </Button>
                )
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* AI Memory Panel - also show for unregistered contacts */}
        <AIMemoryPanel phone={phone || null} agentId={agentId} />
      </div>
    );
  }

  return (
    <div className="space-y-3 h-full">
      <Card className={cn("glass-card", statusConfig?.borderColor)}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Dados do Cliente
            </div>
            {onEdit && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6"
                onClick={() => onEdit(client)}
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status Badge */}
          {statusConfig && (
            <div className={cn(
              "flex items-center gap-2 p-2 rounded-lg",
              statusConfig.bgColor
            )}>
              <statusConfig.icon className={cn("h-4 w-4", statusConfig.color)} />
              <span className={cn("text-sm font-medium", statusConfig.color)}>
                {statusConfig.label}
              </span>
            </div>
          )}

          {/* Client Info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm font-medium truncate">{client.name}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm text-muted-foreground">{client.whatsapp}</span>
            </div>
            
            {client.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-muted-foreground truncate">{client.email}</span>
              </div>
            )}
          </div>

          <Separator />

          {/* Plan Info */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Plano</span>
              </div>
              <Badge variant="outline" className="text-xs">
                {planLabels[client.plan]}
              </Badge>
            </div>
            
            {client.price !== null && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Valor</span>
                </div>
                <span className="text-sm font-medium">{formatCurrency(client.price)}</span>
              </div>
            )}
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Vencimento</span>
              </div>
              <span className="text-sm">{format(client.expiresAt, "dd/MM/yyyy")}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Cadastrado</span>
              </div>
              <span className="text-sm">{format(client.createdAt, "dd/MM/yyyy")}</span>
            </div>
          </div>

          {/* Notes */}
          {client.notes && (
            <>
              <Separator />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <StickyNote className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Notas</span>
                </div>
                <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded line-clamp-3">
                  {client.notes}
                </p>
              </div>
            </>
          )}

          {/* Renewal History */}
          {client.renewalHistory && client.renewalHistory.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Renovações ({client.renewalHistory.length})
                  </span>
                </div>
                <ScrollArea className="h-20">
                  <div className="space-y-1">
                    {client.renewalHistory.slice(0, 3).map((renewal, i) => (
                      <div key={renewal.id} className="text-xs text-muted-foreground flex justify-between">
                        <span>{format(renewal.date, "dd/MM/yy", { locale: ptBR })}</span>
                        <span>{planLabels[renewal.plan]}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </>
          )}

          {/* Actions */}
          {onRenew && (status === 'expiring' || status === 'expired') && (
            <>
              <Separator />
              <Button 
                size="sm" 
                className="w-full gap-2"
                variant={status === 'expired' ? 'destructive' : 'default'}
                onClick={() => onRenew(client.id)}
              >
                <RefreshCw className="h-4 w-4" />
                Renovar Plano
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* AI Memory Panel */}
      <AIMemoryPanel phone={phone || client.whatsapp} agentId={agentId} />
    </div>
  );
}
