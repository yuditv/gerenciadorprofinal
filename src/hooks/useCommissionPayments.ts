import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export type PaymentStatus = 'pending' | 'approved' | 'paid' | 'cancelled';

export interface CommissionPayment {
  id: string;
  resellerId: string;
  resellerName?: string;
  amount: number;
  referenceMonth: string;
  totalSales: number;
  commissionRate: number;
  status: PaymentStatus;
  paymentDate: Date | null;
  paymentMethod: string | null;
  notes: string | null;
  createdAt: Date;
}

const STORAGE_KEY = 'commission_payments_data';

export function useCommissionPayments() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<CommissionPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const getStorageKey = useCallback(() => {
    return user ? `${STORAGE_KEY}_${user.id}` : STORAGE_KEY;
  }, [user]);

  const loadPayments = useCallback(() => {
    try {
      const stored = localStorage.getItem(getStorageKey());
      if (stored) {
        const parsed = JSON.parse(stored);
        setPayments(
          parsed.map((p: CommissionPayment & { createdAt: string; paymentDate: string | null }) => ({
            ...p,
            createdAt: new Date(p.createdAt),
            paymentDate: p.paymentDate ? new Date(p.paymentDate) : null,
          }))
        );
      }
    } catch (error) {
      console.error('Error loading commission payments:', error);
    } finally {
      setIsLoading(false);
    }
  }, [getStorageKey]);

  useEffect(() => {
    if (user) {
      loadPayments();
    }
  }, [user, loadPayments]);

  const saveToStorage = useCallback(
    (data: CommissionPayment[]) => {
      try {
        localStorage.setItem(getStorageKey(), JSON.stringify(data));
      } catch (error) {
        console.error('Error saving commission payments:', error);
      }
    },
    [getStorageKey]
  );

  const createPayment = async (
    paymentData: Omit<CommissionPayment, 'id' | 'createdAt'>
  ): Promise<void> => {
    const newPayment: CommissionPayment = {
      ...paymentData,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    };

    const updated = [newPayment, ...payments];
    setPayments(updated);
    saveToStorage(updated);
    toast.success('Pagamento de comissão registrado!');
  };

  const updatePaymentStatus = async (
    id: string,
    status: PaymentStatus,
    paymentDate?: Date,
    paymentMethod?: string
  ): Promise<void> => {
    const updated = payments.map((p) =>
      p.id === id
        ? {
            ...p,
            status,
            paymentDate: paymentDate || p.paymentDate,
            paymentMethod: paymentMethod || p.paymentMethod,
          }
        : p
    );
    setPayments(updated);
    saveToStorage(updated);

    const statusLabels: Record<PaymentStatus, string> = {
      pending: 'Pendente',
      approved: 'Aprovado',
      paid: 'Pago',
      cancelled: 'Cancelado',
    };
    toast.success(`Status alterado para: ${statusLabels[status]}`);
  };

  const deletePayment = async (id: string): Promise<void> => {
    const updated = payments.filter((p) => p.id !== id);
    setPayments(updated);
    saveToStorage(updated);
    toast.success('Pagamento removido com sucesso!');
  };

  const getPaymentsByReseller = (resellerId: string): CommissionPayment[] => {
    return payments.filter((p) => p.resellerId === resellerId);
  };

  const getPaymentsByMonth = (referenceMonth: string): CommissionPayment[] => {
    return payments.filter((p) => p.referenceMonth === referenceMonth);
  };

  const getPaymentStats = () => {
    const pending = payments.filter((p) => p.status === 'pending');
    const approved = payments.filter((p) => p.status === 'approved');
    const paid = payments.filter((p) => p.status === 'paid');

    return {
      totalPending: pending.reduce((acc, p) => acc + p.amount, 0),
      totalApproved: approved.reduce((acc, p) => acc + p.amount, 0),
      totalPaid: paid.reduce((acc, p) => acc + p.amount, 0),
      pendingCount: pending.length,
      approvedCount: approved.length,
      paidCount: paid.length,
    };
  };

  return {
    payments,
    isLoading,
    createPayment,
    updatePaymentStatus,
    deletePayment,
    getPaymentsByReseller,
    getPaymentsByMonth,
    getPaymentStats,
    refetch: loadPayments,
  };
}
