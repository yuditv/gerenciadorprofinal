export type PlanType = 'monthly' | 'quarterly' | 'semiannual' | 'annual';

export type ServiceType = 'IPTV' | 'VPN';

export type ExpirationStatus = 'active' | 'expiring' | 'expired';

export const serviceLabels: Record<ServiceType, string> = {
  IPTV: 'IPTV',
  VPN: 'VPN',
};

export interface RenewalRecord {
  id: string;
  date: Date;
  previousExpiresAt: Date;
  newExpiresAt: Date;
  plan: PlanType;
}

export interface Client {
  id: string;
  name: string;
  whatsapp: string;
  email: string;
  service: ServiceType;
  plan: PlanType;
  price: number | null;
  notes: string | null;
  createdAt: Date;
  expiresAt: Date;
  renewalHistory: RenewalRecord[];
  // Service credentials
  serviceUsername: string | null;
  servicePassword: string | null;
  // IPTV specific fields
  appName: string | null;
  device: string | null;
}

export const planLabels: Record<PlanType, string> = {
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  annual: 'Anual',
};

export const planDurations: Record<PlanType, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
};

// Preços em reais
export const planPrices: Record<PlanType, number> = {
  monthly: 99.90,
  quarterly: 54.99,
  semiannual: 99.99,
  annual: 149.99,
};

// Preço mensal equivalente (para cálculo de MRR)
export const planMonthlyEquivalent: Record<PlanType, number> = {
  monthly: 99.90,
  quarterly: 54.99 / 3,
  semiannual: 99.99 / 6,
  annual: 149.99 / 12,
};

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const getExpirationStatus = (expiresAt: Date): ExpirationStatus => {
  const now = new Date();
  const daysUntilExpiration = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysUntilExpiration < 0) return 'expired';
  if (daysUntilExpiration <= 3) return 'expiring';
  return 'active';
};

export const getDaysUntilExpiration = (expiresAt: Date): number => {
  const now = new Date();
  return Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};
