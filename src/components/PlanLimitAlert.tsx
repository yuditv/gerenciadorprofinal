import { AlertTriangle, Lock, Sparkles, Zap } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { SubscriptionPlansDialog } from "./SubscriptionPlansDialog";
import { PlanType } from "@/hooks/usePlanLimits";

interface PlanLimitAlertProps {
  type: 'blocked' | 'limit_reached' | 'limit_warning' | 'trial_blocked';
  feature: string;
  planType?: PlanType;
  currentCount?: number;
  maxCount?: number;
  className?: string;
}

export function PlanLimitAlert({ 
  type, 
  feature, 
  planType,
  currentCount, 
  maxCount,
  className = ""
}: PlanLimitAlertProps) {
  const [showPlansDialog, setShowPlansDialog] = useState(false);

  const getContent = () => {
    switch (type) {
      case 'trial_blocked':
        return {
          icon: Lock,
          variant: 'destructive' as const,
          title: 'Recurso não disponível no período de teste',
          description: `${feature} não está disponível durante o período de teste gratuito. Faça upgrade para um plano pago para desbloquear este recurso.`,
        };
      case 'blocked':
        return {
          icon: Lock,
          variant: 'destructive' as const,
          title: 'Recurso bloqueado',
          description: `${feature} não está disponível no seu plano atual${planType ? ` (${planType})` : ''}. Faça upgrade para desbloquear.`,
        };
      case 'limit_reached':
        return {
          icon: AlertTriangle,
          variant: 'destructive' as const,
          title: 'Limite atingido',
          description: `Você atingiu o limite de ${feature} (${currentCount}/${maxCount}). Faça upgrade para aumentar seu limite.`,
        };
      case 'limit_warning':
        return {
          icon: Zap,
          variant: 'default' as const,
          title: 'Limite próximo',
          description: `Você está próximo do limite de ${feature} (${currentCount}/${maxCount}).`,
        };
      default:
        return {
          icon: AlertTriangle,
          variant: 'default' as const,
          title: 'Aviso',
          description: feature,
        };
    }
  };

  const content = getContent();
  const Icon = content.icon;

  return (
    <>
      <Alert variant={content.variant} className={className}>
        <Icon className="h-4 w-4" />
        <AlertTitle>{content.title}</AlertTitle>
        <AlertDescription className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mt-2">
          <span className="flex-1">{content.description}</span>
          <Button 
            size="sm" 
            onClick={() => setShowPlansDialog(true)}
            className="gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90"
          >
            <Sparkles className="h-4 w-4" />
            Ver Planos
          </Button>
        </AlertDescription>
      </Alert>

      <SubscriptionPlansDialog 
        open={showPlansDialog} 
        onOpenChange={setShowPlansDialog} 
      />
    </>
  );
}
