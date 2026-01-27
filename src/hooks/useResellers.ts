import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface Reseller {
  id: string;
  name: string;
  email: string;
  phone: string;
  accessLevel: 'admin' | 'manager' | 'seller';
  commissionRate: number;
  clientLimit: number | null;
  monthlyGoal: number;
  revenueGoal: number;
  isActive: boolean;
  createdAt: Date;
  clientsCount: number;
  totalRevenue: number;
}

const STORAGE_KEY = 'resellers_data';

export function useResellers() {
  const { user } = useAuth();
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const getStorageKey = useCallback(() => {
    return user ? `${STORAGE_KEY}_${user.id}` : STORAGE_KEY;
  }, [user]);

  const loadResellers = useCallback(() => {
    try {
      const stored = localStorage.getItem(getStorageKey());
      if (stored) {
        const parsed = JSON.parse(stored);
        setResellers(
          parsed.map((r: Reseller & { createdAt: string }) => ({
            ...r,
            createdAt: new Date(r.createdAt),
          }))
        );
      }
    } catch (error) {
      console.error('Error loading resellers:', error);
    } finally {
      setIsLoading(false);
    }
  }, [getStorageKey]);

  useEffect(() => {
    if (user) {
      loadResellers();
    }
  }, [user, loadResellers]);

  const saveToStorage = useCallback(
    (data: Reseller[]) => {
      try {
        localStorage.setItem(getStorageKey(), JSON.stringify(data));
      } catch (error) {
        console.error('Error saving resellers:', error);
      }
    },
    [getStorageKey]
  );

  const createReseller = async (
    resellerData: Omit<Reseller, 'id' | 'createdAt' | 'clientsCount' | 'totalRevenue'>
  ): Promise<void> => {
    const newReseller: Reseller = {
      ...resellerData,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      clientsCount: 0,
      totalRevenue: 0,
    };

    const updated = [...resellers, newReseller];
    setResellers(updated);
    saveToStorage(updated);
    toast.success('Revendedor criado com sucesso!');
  };

  const updateReseller = async (id: string, data: Partial<Reseller>): Promise<void> => {
    const updated = resellers.map((r) => (r.id === id ? { ...r, ...data } : r));
    setResellers(updated);
    saveToStorage(updated);
    toast.success('Revendedor atualizado com sucesso!');
  };

  const deleteReseller = async (id: string): Promise<void> => {
    const updated = resellers.filter((r) => r.id !== id);
    setResellers(updated);
    saveToStorage(updated);
    toast.success('Revendedor removido com sucesso!');
  };

  const getResellerById = (id: string): Reseller | undefined => {
    return resellers.find((r) => r.id === id);
  };

  const getActiveResellers = (): Reseller[] => {
    return resellers.filter((r) => r.isActive);
  };

  const getResellerStats = () => {
    const active = resellers.filter((r) => r.isActive).length;
    const totalClients = resellers.reduce((acc, r) => acc + r.clientsCount, 0);
    const totalRevenue = resellers.reduce((acc, r) => acc + r.totalRevenue, 0);
    const avgCommission =
      resellers.length > 0
        ? resellers.reduce((acc, r) => acc + r.commissionRate, 0) / resellers.length
        : 0;

    return {
      total: resellers.length,
      active,
      inactive: resellers.length - active,
      totalClients,
      totalRevenue,
      avgCommission,
    };
  };

  return {
    resellers,
    isLoading,
    createReseller,
    updateReseller,
    deleteReseller,
    getResellerById,
    getActiveResellers,
    getResellerStats,
    refetch: loadResellers,
  };
}
