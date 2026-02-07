import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Crown, CheckCircle, Calendar, CreditCard } from 'lucide-react';
import { SubscriptionPlan, formatCurrencyBRL } from '@/types/subscription';
import { cn } from '@/lib/utils';
import { format, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface UserSubscriptionData {
  id: string;
  user_id: string;
  status: 'trial' | 'active' | 'expired' | 'cancelled';
  plan_id?: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  plan?: SubscriptionPlan;
  user_email?: string;
  user_name?: string;
}

interface AdminChangePlanDialogProps {
  subscription: UserSubscriptionData | null;
  plans: SubscriptionPlan[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (subscriptionId: string, planId: string, status: string, periodEnd: string) => void;
}

export function AdminChangePlanDialog({
  subscription,
  plans,
  open,
  onOpenChange,
  onConfirm,
}: AdminChangePlanDialogProps) {
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('active');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  if (!subscription) return null;

  const selectedPlan = plans.find(p => p.id === selectedPlanId);

  const calculatedEndDate = selectedPlan
    ? format(addMonths(new Date(), selectedPlan.duration_months), 'yyyy-MM-dd')
    : '';

  const finalEndDate = customEndDate || calculatedEndDate;

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      // Pre-fill with current plan if exists
      setSelectedPlanId(subscription.plan?.id || (plans[0]?.id ?? ''));
      setSelectedStatus(subscription.status === 'trial' ? 'active' : subscription.status);
      setCustomEndDate('');
    }
    onOpenChange(isOpen);
  };

  const handleConfirm = () => {
    if (!selectedPlanId || !finalEndDate) return;
    onConfirm(
      subscription.id,
      selectedPlanId,
      selectedStatus,
      new Date(finalEndDate + 'T23:59:59').toISOString()
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-lg glass-card border-primary/20">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            Gerenciar Assinatura
          </DialogTitle>
          <DialogDescription>
            Altere o plano e status de <strong>{subscription.user_name || subscription.user_email}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Current Info */}
          <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
            <p className="text-sm text-muted-foreground">Situação atual</p>
            <p className="font-medium">
              {subscription.plan?.name || 'Sem plano'} — 
              <Badge variant="outline" className="ml-2 capitalize">
                {subscription.status}
              </Badge>
            </p>
            {subscription.current_period_end && (
              <p className="text-xs text-muted-foreground mt-1">
                Expira em: {format(new Date(subscription.current_period_end), 'dd/MM/yyyy', { locale: ptBR })}
              </p>
            )}
          </div>

          {/* Plan Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Selecionar Plano
            </Label>
            <RadioGroup
              value={selectedPlanId}
              onValueChange={setSelectedPlanId}
              className="space-y-2"
            >
              {plans.map((plan) => {
                const isSelected = selectedPlanId === plan.id;
                return (
                  <div
                    key={plan.id}
                    className={cn(
                      'flex items-center space-x-3 p-3 rounded-lg border transition-colors cursor-pointer',
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border/50 hover:border-border'
                    )}
                  >
                    <RadioGroupItem value={plan.id} id={`plan-${plan.id}`} />
                    <Label
                      htmlFor={`plan-${plan.id}`}
                      className="flex-1 flex items-center justify-between cursor-pointer"
                    >
                      <div>
                        <p className="font-medium">{plan.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {plan.duration_months} {plan.duration_months === 1 ? 'mês' : 'meses'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-primary">
                          {formatCurrencyBRL(plan.price)}
                        </p>
                        {plan.discount_percentage > 0 && (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                            {plan.discount_percentage}% off
                          </Badge>
                        )}
                      </div>
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          </div>

          {/* Status Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Status da Assinatura
            </Label>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="border-primary/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">✅ Ativo</SelectItem>
                <SelectItem value="trial">🕐 Trial</SelectItem>
                <SelectItem value="expired">❌ Expirado</SelectItem>
                <SelectItem value="cancelled">🚫 Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Expiration Date */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Data de Expiração
            </Label>
            <Input
              type="date"
              value={customEndDate || calculatedEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="border-primary/20"
            />
            {!customEndDate && selectedPlan && (
              <p className="text-xs text-muted-foreground">
                Calculado automaticamente: {selectedPlan.duration_months} meses a partir de hoje
              </p>
            )}
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
            disabled={!selectedPlanId || !finalEndDate}
            className="flex-1 btn-futuristic"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Confirmar Alteração
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
