export interface SubscriptionPlan {
  id: string;
  name: string;
  duration_months: number;
  price: number;
  discount_percentage: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  plan_type?: 'starter' | 'pro' | 'enterprise';
}

export interface UserSubscription {
  id: string;
  user_id: string;
  plan_id: string | null;
  status: 'trial' | 'active' | 'expired' | 'cancelled';
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  plan?: SubscriptionPlan;
}

export interface SubscriptionPayment {
  id: string;
  subscription_id: string;
  user_id: string;
  plan_id: string;
  amount: number;
  payment_method: string;
  status: 'pending' | 'paid' | 'failed' | 'refunded' | 'expired';
  pix_code: string | null;
  pix_qr_code: string | null;
  external_id: string | null;
  paid_at: string | null;
  expires_at: string | null;
  created_at: string;
  plan?: SubscriptionPlan;
}

// Funcionalidades que podem ser restritas
export const restrictedFeatures = {
  can_create_clients: false,
  can_edit_clients: false,
  can_delete_clients: false,
  can_send_whatsapp: false,
  can_manage_campaigns: false,
  can_manage_dispatches: false,
  can_manage_warming: false,
  can_access_settings: false,
  can_use_ai_agent: false,
  // Sempre permitido
  can_view_dashboard: true,
  can_view_clients: true,
  can_view_profile: true,
  can_manage_subscription: true,
} as const;

export type RestrictedFeature = keyof typeof restrictedFeatures;

export const formatCurrencyBRL = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};
