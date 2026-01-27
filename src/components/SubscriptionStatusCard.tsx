import { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, CreditCard, Crown, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { formatCurrencyBRL } from '@/types/subscription';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useSubscription } from '@/hooks/useSubscription';
import { SubscriptionPlansDialog } from '@/components/SubscriptionPlansDialog';

const statusConfig = {
  trial: {
    label: 'Período de Teste',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    icon: Clock,
  },
  active: {
    label: 'Ativo',
    color: 'bg-green-500/20 text-green-400 border-green-500/30',
    icon: Crown,
  },
  expired: {
    label: 'Expirado',
    color: 'bg-red-500/20 text-red-400 border-red-500/30',
    icon: Zap,
  },
  cancelled: {
    label: 'Cancelado',
    color: 'bg-muted text-muted-foreground border-border',
    icon: CreditCard,
  },
};

export function SubscriptionStatusCard() {
  const [showPlans, setShowPlans] = useState(false);
  const { subscription, isActive, isOnTrial, getRemainingDays, isLoading } = useSubscription();

  if (isLoading || !subscription) return null;

  const active = isActive();
  const onTrial = isOnTrial();
  const daysRemaining = getRemainingDays();

  const status = active ? subscription.status : 'expired';
  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.expired;
  const Icon = config.icon;

  const endDate = subscription.status === 'trial'
    ? subscription.trial_ends_at
    : subscription.current_period_end;

  // Calcular progresso (para trial de 1 dia ou assinatura)
  const totalDays = onTrial ? 1 : (subscription.plan?.duration_months || 1) * 30;
  const usedDays = totalDays - daysRemaining;
  const progressPercentage = Math.min(100, (usedDays / totalDays) * 100);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="glass-card border-primary/20 overflow-hidden relative">
          {/* Header com gradiente */}
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary/70 to-primary" />
          
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Icon className="h-5 w-5 text-primary" />
                Sua Assinatura
              </CardTitle>
              <Badge className={cn('border', config.color)}>
                {config.label}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Plano atual */}
            {subscription.plan && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm text-muted-foreground">Plano</p>
                  <p className="font-semibold">{subscription.plan.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Valor</p>
                  <p className="font-semibold text-primary">
                    {formatCurrencyBRL(subscription.plan.price)}
                  </p>
                </div>
              </div>
            )}

            {/* Dias restantes */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {onTrial ? 'Trial restante' : 'Dias restantes'}
                </span>
                <span className={cn(
                  'font-semibold',
                  daysRemaining <= 3 ? 'text-red-400' : 'text-foreground'
                )}>
                  {daysRemaining} {daysRemaining === 1 ? 'dia' : 'dias'}
                </span>
              </div>
              <Progress 
                value={100 - progressPercentage} 
                className="h-2"
              />
            </div>

            {/* Data de expiração */}
            {endDate && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>
                  {active ? 'Expira em' : 'Expirou em'}{' '}
                  {format(new Date(endDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </span>
              </div>
            )}

            {/* Botão de ação */}
            <Button
              onClick={() => setShowPlans(true)}
              className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            >
              {active ? (
                <>
                  <CreditCard className="h-4 w-4 mr-2" />
                  {onTrial ? 'Assinar Agora' : 'Gerenciar Assinatura'}
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Renovar Assinatura
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      <SubscriptionPlansDialog open={showPlans} onOpenChange={setShowPlans} />
    </>
  );
}
