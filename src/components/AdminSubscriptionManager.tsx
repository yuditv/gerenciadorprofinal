import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  CreditCard, 
  Crown, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Edit,
  RefreshCw
} from 'lucide-react';
import { SubscriptionPlan, formatCurrencyBRL } from '@/types/subscription';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { AdminChangePlanDialog } from './AdminChangePlanDialog';

interface UserSubscriptionData {
  id: string;
  user_id: string;
  status: 'trial' | 'active' | 'expired' | 'cancelled';
  trial_ends_at: string | null;
  current_period_end: string | null;
  plan?: SubscriptionPlan;
  user_email?: string;
  user_name?: string;
}

interface AdminSubscriptionManagerProps {
  subscriptions: UserSubscriptionData[];
  plans: SubscriptionPlan[];
  onRefresh: () => void;
  isLoading?: boolean;
}

const statusConfig = {
  trial: {
    label: 'Trial',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    icon: Clock,
  },
  active: {
    label: 'Ativo',
    color: 'bg-green-500/20 text-green-400 border-green-500/30',
    icon: CheckCircle,
  },
  expired: {
    label: 'Expirado',
    color: 'bg-red-500/20 text-red-400 border-red-500/30',
    icon: AlertTriangle,
  },
  cancelled: {
    label: 'Cancelado',
    color: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    icon: XCircle,
  },
};

export function AdminSubscriptionManager({
  subscriptions,
  plans,
  onRefresh,
  isLoading,
}: AdminSubscriptionManagerProps) {
  const [editingSub, setEditingSub] = useState<UserSubscriptionData | null>(null);

  const handleChangePlan = async (
    subscriptionId: string,
    planId: string,
    status: string,
    periodEnd: string
  ) => {
    const updateData: Record<string, unknown> = {
      plan_id: planId,
      status,
      current_period_start: new Date().toISOString(),
      current_period_end: periodEnd,
    };

    // If setting to trial, also update trial_ends_at
    if (status === 'trial') {
      updateData.trial_ends_at = periodEnd;
    }

    const { error } = await supabase
      .from('user_subscriptions')
      .update(updateData)
      .eq('id', subscriptionId);

    if (error) {
      toast({
        title: 'Erro',
        description: 'Falha ao atualizar assinatura',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Sucesso',
        description: 'Assinatura atualizada com sucesso',
      });
      onRefresh();
    }
  };

  const stats = {
    total: subscriptions.length,
    active: subscriptions.filter(s => s.status === 'active').length,
    trial: subscriptions.filter(s => s.status === 'trial').length,
    expired: subscriptions.filter(s => s.status === 'expired' || s.status === 'cancelled').length,
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-card glow-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/20">
                <CreditCard className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card glow-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/20">
                <CheckCircle className="h-6 w-6 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.active}</p>
                <p className="text-sm text-muted-foreground">Ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card glow-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-500/20">
                <Clock className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.trial}</p>
                <p className="text-sm text-muted-foreground">Em Trial</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card glow-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-red-500/20">
                <AlertTriangle className="h-6 w-6 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.expired}</p>
                <p className="text-sm text-muted-foreground">Expirados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plans Overview */}
      <Card className="glass-card glow-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            Planos Disponíveis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {plans.map((plan) => (
              <div 
                key={plan.id}
                className="p-4 rounded-lg border border-border/50 bg-card/50"
              >
                <h4 className="font-semibold">{plan.name}</h4>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrencyBRL(plan.price)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {plan.duration_months} {plan.duration_months === 1 ? 'mês' : 'meses'}
                </p>
                {plan.discount_percentage > 0 && (
                  <Badge className="mt-2 bg-green-500/20 text-green-400 border-green-500/30">
                    {plan.discount_percentage}% off
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Subscriptions Table */}
      <Card className="glass-card glow-border overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between border-b border-primary/10">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Assinaturas dos Usuários
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            className="border-primary/30"
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
            Atualizar
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-primary/10 hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Usuário</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-muted-foreground">Plano</TableHead>
                  <TableHead className="text-muted-foreground">Expira em</TableHead>
                  <TableHead className="text-muted-foreground text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((sub) => {
                  const config = statusConfig[sub.status] || statusConfig.expired;
                  const StatusIcon = config.icon;
                  const endDate = sub.status === 'trial' 
                    ? sub.trial_ends_at 
                    : sub.current_period_end;

                  return (
                    <TableRow key={sub.id} className="border-primary/10 hover:bg-primary/5">
                      <TableCell>
                        <div>
                          <p className="font-medium">{sub.user_name || 'Sem nome'}</p>
                          <p className="text-sm text-muted-foreground">{sub.user_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn('border', config.color)}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {sub.plan?.name || 'Sem plano'}
                      </TableCell>
                      <TableCell>
                        {endDate 
                          ? format(new Date(endDate), "dd/MM/yyyy", { locale: ptBR })
                          : '-'
                        }
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingSub(sub)}
                          className="border-primary/30"
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Gerenciar
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {subscriptions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhuma assinatura encontrada
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Change Plan Dialog */}
      <AdminChangePlanDialog
        subscription={editingSub}
        plans={plans}
        open={!!editingSub}
        onOpenChange={(open) => !open && setEditingSub(null)}
        onConfirm={handleChangePlan}
      />
    </div>
  );
}
