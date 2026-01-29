import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { 
  SubscriptionPlan, 
  UserSubscription, 
  SubscriptionPayment,
  RestrictedFeature,
  restrictedFeatures 
} from '@/types/subscription';
import { differenceInDays, isPast } from 'date-fns';

export function useSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPlans = useCallback(async () => {
    // Avoid exposing pricing through direct table reads in the app.
    // The edge function enforces authentication for this data.
    if (!user) {
      setPlans([]);
      return;
    }

    const { data, error } = await supabase.functions.invoke('get-subscription-plans', {
      method: 'GET',
    });

    if (!error && data?.plans) {
      setPlans(data.plans as SubscriptionPlan[]);
    }
  }, [user]);

  const fetchSubscription = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('user_subscriptions')
      .select(`
        *,
        plan:subscription_plans(*)
      `)
      .eq('user_id', user.id)
      .single();

    if (!error && data) {
      setSubscription(data as unknown as UserSubscription);
    }
  }, [user]);

  const fetchPayments = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('subscription_payments')
      .select(`
        *,
        plan:subscription_plans(*)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!error && data) {
      setPayments(data as unknown as SubscriptionPayment[]);
    }
  }, [user]);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([fetchPlans(), fetchSubscription(), fetchPayments()]);
    setIsLoading(false);
  }, [fetchPlans, fetchSubscription, fetchPayments]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // Verifica se a assinatura está ativa
  const isActive = useCallback((): boolean => {
    if (!subscription) return false;

    if (subscription.status === 'active') {
      if (subscription.current_period_end) {
        return !isPast(new Date(subscription.current_period_end));
      }
      return true;
    }

    if (subscription.status === 'trial') {
      if (subscription.trial_ends_at) {
        return !isPast(new Date(subscription.trial_ends_at));
      }
      return true;
    }

    return false;
  }, [subscription]);

  // Verifica se está no período de trial
  const isOnTrial = useCallback((): boolean => {
    if (!subscription) return false;
    return subscription.status === 'trial' && isActive();
  }, [subscription, isActive]);

  // Dias restantes do trial ou assinatura
  const getRemainingDays = useCallback((): number => {
    if (!subscription) return 0;

    let endDate: Date | null = null;

    if (subscription.status === 'trial' && subscription.trial_ends_at) {
      endDate = new Date(subscription.trial_ends_at);
    } else if (subscription.status === 'active' && subscription.current_period_end) {
      endDate = new Date(subscription.current_period_end);
    }

    if (!endDate) return 0;

    const days = differenceInDays(endDate, new Date());
    return Math.max(0, days);
  }, [subscription]);

  // Verifica se o trial está acabando (menos de 3 dias)
  const isTrialExpiring = useCallback((): boolean => {
    if (!isOnTrial()) return false;
    return getRemainingDays() <= 3;
  }, [isOnTrial, getRemainingDays]);

  // Verifica se pode acessar uma funcionalidade
  const canAccessFeature = useCallback((feature: RestrictedFeature): boolean => {
    // Features sempre permitidas
    if (restrictedFeatures[feature] === true) return true;

    // Se assinatura ativa, tudo liberado
    if (isActive()) return true;

    // Se expirado, bloqueia features restritas
    return false;
  }, [isActive]);

  // Cria uma assinatura para o usuário (caso não tenha)
  const createSubscription = useCallback(async () => {
    if (!user) return null;

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 1);

    const { data, error } = await supabase
      .from('user_subscriptions')
      .insert({
        user_id: user.id,
        status: 'trial',
        trial_ends_at: trialEndsAt.toISOString(),
      })
      .select()
      .single();

    if (!error && data) {
      setSubscription(data as UserSubscription);
      return data;
    }

    return null;
  }, [user]);

  // Inicia processo de pagamento PIX
  const initiatePixPayment = useCallback(async (planId: string) => {
    if (!user || !subscription) return null;

    const plan = plans.find(p => p.id === planId);
    if (!plan) return null;

    // Criar registro de pagamento pendente
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30); // PIX expira em 30 min

    const { data, error } = await supabase
      .from('subscription_payments')
      .insert({
        subscription_id: subscription.id,
        user_id: user.id,
        plan_id: planId,
        amount: plan.price,
        payment_method: 'pix',
        status: 'pending',
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (!error && data) {
      // TODO: Integrar com gateway PIX para gerar código
      // Por enquanto retorna o payment criado
      await fetchPayments();
      return data as SubscriptionPayment;
    }

    return null;
  }, [user, subscription, plans, fetchPayments]);

  // Ativa assinatura após pagamento
  const activateSubscription = useCallback(async (planId: string, paymentId: string) => {
    if (!user || !subscription) return false;

    const plan = plans.find(p => p.id === planId);
    if (!plan) return false;

    const periodStart = new Date();
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + plan.duration_months);

    // Atualizar assinatura
    const { error: subError } = await supabase
      .from('user_subscriptions')
      .update({
        plan_id: planId,
        status: 'active',
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
      })
      .eq('id', subscription.id);

    if (subError) return false;

    // Atualizar pagamento
    const { error: payError } = await supabase
      .from('subscription_payments')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
      })
      .eq('id', paymentId);

    if (payError) return false;

    await refetch();
    return true;
  }, [user, subscription, plans, refetch]);

  // Cancelar assinatura
  const cancelSubscription = useCallback(async () => {
    if (!subscription) return false;

    const { error } = await supabase
      .from('user_subscriptions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', subscription.id);

    if (!error) {
      await fetchSubscription();
      return true;
    }

    return false;
  }, [subscription, fetchSubscription]);

  return {
    subscription,
    plans,
    payments,
    isLoading,
    isActive,
    isOnTrial,
    getRemainingDays,
    isTrialExpiring,
    canAccessFeature,
    createSubscription,
    initiatePixPayment,
    activateSubscription,
    cancelSubscription,
    refetch,
  };
}
