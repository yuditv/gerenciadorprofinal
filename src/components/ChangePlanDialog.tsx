import { useState } from 'react';
import { Client, PlanType, planLabels, planPrices, planDurations, formatCurrency } from '@/types/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { addMonths, differenceInDays } from 'date-fns';

interface ChangePlanDialogProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (clientId: string, newPlan: PlanType, newExpiresAt: Date) => void;
}

const planOrder: PlanType[] = ['monthly', 'quarterly', 'semiannual', 'annual'];

export function ChangePlanDialog({ client, open, onOpenChange, onConfirm }: ChangePlanDialogProps) {
  const [selectedPlan, setSelectedPlan] = useState<PlanType | null>(null);

  if (!client) return null;

  const currentPlanIndex = planOrder.indexOf(client.plan);

  const calculateNewExpiration = (newPlan: PlanType): Date => {
    const now = new Date();
    const currentExpiration = client.expiresAt;
    
    // If expired, start from today
    if (currentExpiration < now) {
      return addMonths(now, planDurations[newPlan]);
    }

    // Calculate remaining days in current plan
    const remainingDays = differenceInDays(currentExpiration, now);
    
    // Calculate the daily value of the remaining time
    const currentPlanDailyValue = planPrices[client.plan] / (planDurations[client.plan] * 30);
    const remainingValue = remainingDays * currentPlanDailyValue;
    
    // Calculate how many days the remaining value buys in the new plan
    const newPlanDailyValue = planPrices[newPlan] / (planDurations[newPlan] * 30);
    const equivalentDays = Math.round(remainingValue / newPlanDailyValue);
    
    // Add the new plan duration plus equivalent days
    const newExpiration = new Date(now);
    newExpiration.setDate(newExpiration.getDate() + equivalentDays + (planDurations[newPlan] * 30));
    
    return newExpiration;
  };

  const getPlanChangeType = (newPlan: PlanType) => {
    const newPlanIndex = planOrder.indexOf(newPlan);
    if (newPlanIndex > currentPlanIndex) return 'upgrade';
    if (newPlanIndex < currentPlanIndex) return 'downgrade';
    return 'same';
  };

  const handleConfirm = () => {
    if (!selectedPlan || selectedPlan === client.plan) return;
    const newExpiresAt = calculateNewExpiration(selectedPlan);
    onConfirm(client.id, selectedPlan, newExpiresAt);
    onOpenChange(false);
    setSelectedPlan(null);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setSelectedPlan(null); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Alterar Plano</DialogTitle>
          <DialogDescription>
            Escolha o novo plano para <strong>{client.name}</strong>. 
            O vencimento será recalculado proporcionalmente.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="mb-4 p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Plano atual</p>
            <p className="font-semibold">{planLabels[client.plan]} - {formatCurrency(planPrices[client.plan])}</p>
          </div>

          <RadioGroup
            value={selectedPlan || ''}
            onValueChange={(v) => setSelectedPlan(v as PlanType)}
            className="space-y-3"
          >
            {planOrder.map((plan) => {
              const changeType = getPlanChangeType(plan);
              const isCurrentPlan = plan === client.plan;
              
              return (
                <div
                  key={plan}
                  className={cn(
                    "flex items-center space-x-3 p-3 rounded-lg border transition-colors",
                    selectedPlan === plan && "border-primary bg-primary/5",
                    isCurrentPlan && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <RadioGroupItem 
                    value={plan} 
                    id={plan} 
                    disabled={isCurrentPlan}
                  />
                  <Label 
                    htmlFor={plan} 
                    className={cn(
                      "flex-1 flex items-center justify-between cursor-pointer",
                      isCurrentPlan && "cursor-not-allowed"
                    )}
                  >
                    <div>
                      <p className="font-medium">{planLabels[plan]}</p>
                      <p className="text-sm text-muted-foreground">{formatCurrency(planPrices[plan])}</p>
                    </div>
                    {!isCurrentPlan && (
                      <div className={cn(
                        "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded",
                        changeType === 'upgrade' && "bg-plan-semiannual/10 text-plan-semiannual",
                        changeType === 'downgrade' && "bg-plan-annual/10 text-plan-annual"
                      )}>
                        {changeType === 'upgrade' && <TrendingUp className="h-3 w-3" />}
                        {changeType === 'downgrade' && <TrendingDown className="h-3 w-3" />}
                        {changeType === 'upgrade' ? 'Upgrade' : 'Downgrade'}
                      </div>
                    )}
                    {isCurrentPlan && (
                      <span className="text-xs text-muted-foreground">Atual</span>
                    )}
                  </Label>
                </div>
              );
            })}
          </RadioGroup>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedPlan || selectedPlan === client.plan}
            className="flex-1 gap-2"
          >
            <ArrowRight className="h-4 w-4" />
            Confirmar Alteração
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
