import { createContext, useContext, ReactNode } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { useUserPermissions } from '@/hooks/useUserPermissions';
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
  const { isAdmin, isLoading: isPermissionsLoading } = useUserPermissions();

  // Evita “flash” enquanto permissões/assinatura estão carregando e garante bypass para Admin.
  const isExpired = !isLoading && !isPermissionsLoading && !isAdmin && !isActive();

  return (
    <SubscriptionGateContext.Provider value={{
      canAccess: canAccessFeature,
      isExpired,
      isLoading: isLoading || isPermissionsLoading,
    }}>
      {children}
    </SubscriptionGateContext.Provider>
  );
}

export function useSubscriptionGate() {
  return useContext(SubscriptionGateContext);
}
