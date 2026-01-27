import { createContext, useContext, ReactNode } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { RestrictedFeature } from '@/types/subscription';

interface SubscriptionGateContextType {
  canAccess: (feature: RestrictedFeature) => boolean;
  isExpired: boolean;
  isLoading: boolean;
}

const SubscriptionGateContext = createContext<SubscriptionGateContextType>({
  canAccess: () => true,
  isExpired: false,
  isLoading: true,
});

export function SubscriptionGateProvider({ children }: { children: ReactNode }) {
  const { canAccessFeature, isActive, isLoading } = useSubscription();

  const isExpired = !isLoading && !isActive();

  return (
    <SubscriptionGateContext.Provider value={{
      canAccess: canAccessFeature,
      isExpired,
      isLoading,
    }}>
      {children}
    </SubscriptionGateContext.Provider>
  );
}

export function useSubscriptionGate() {
  return useContext(SubscriptionGateContext);
}
