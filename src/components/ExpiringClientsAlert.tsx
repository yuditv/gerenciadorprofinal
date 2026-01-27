import { Client, getDaysUntilExpiration, getExpirationStatus } from '@/types/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface ExpiringClientsAlertProps {
  expiringClients: Client[];
  expiredClients: Client[];
  onClientClick: (client: Client) => void;
}

export function ExpiringClientsAlert({ 
  expiringClients, 
  expiredClients,
  onClientClick 
}: ExpiringClientsAlertProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed || (expiringClients.length === 0 && expiredClients.length === 0)) {
    return null;
  }

  const hasExpired = expiredClients.length > 0;
  const hasExpiring = expiringClients.length > 0;

  return (
    <Alert 
      variant={hasExpired ? "destructive" : "default"} 
      className={cn(
        "relative",
        hasExpired 
          ? "bg-destructive/5 border-destructive/30" 
          : "bg-plan-annual/5 border-plan-annual/30"
      )}
    >
      <div className="flex items-start gap-3">
        {hasExpired ? (
          <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
        ) : (
          <Clock className="h-5 w-5 text-plan-annual mt-0.5" />
        )}
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <AlertTitle className={cn(
              "font-semibold",
              hasExpired ? "text-destructive" : "text-plan-annual"
            )}>
              {hasExpired 
                ? `${expiredClients.length} cliente${expiredClients.length > 1 ? 's' : ''} com plano vencido`
                : `${expiringClients.length} cliente${expiringClients.length > 1 ? 's' : ''} com plano próximo do vencimento`
              }
            </AlertTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setIsDismissed(true)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {isExpanded && (
            <AlertDescription className="mt-3 space-y-3">
              {expiredClients.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-destructive mb-2">Vencidos:</p>
                  <div className="flex flex-wrap gap-2">
                    {expiredClients.map(client => (
                      <button
                        key={client.id}
                        onClick={() => onClientClick(client)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-destructive/10 hover:bg-destructive/20 rounded-md text-sm transition-colors"
                      >
                        <span className="font-medium">{client.name}</span>
                        <span className="text-muted-foreground">
                          ({Math.abs(getDaysUntilExpiration(client.expiresAt))}d atrás)
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {expiringClients.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-plan-annual mb-2">Próximos a vencer:</p>
                  <div className="flex flex-wrap gap-2">
                    {expiringClients.map(client => (
                      <button
                        key={client.id}
                        onClick={() => onClientClick(client)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-plan-annual/10 hover:bg-plan-annual/20 rounded-md text-sm transition-colors"
                      >
                        <span className="font-medium">{client.name}</span>
                        <span className="text-muted-foreground">
                          ({getDaysUntilExpiration(client.expiresAt)}d restantes)
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </AlertDescription>
          )}
        </div>
      </div>
    </Alert>
  );
}
