import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export type ProviderType = 'uazapi' | 'evolution' | 'waha' | 'custom';

export interface WhatsAppProvider {
  id: string;
  user_id: string;
  name: string;
  provider_type: ProviderType;
  base_url: string;
  api_token: string;
  is_active: boolean;
  is_default: boolean;
  extra_config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type NewProvider = Omit<WhatsAppProvider, 'id' | 'created_at' | 'updated_at'>;

export function useWhatsAppProviders() {
  const { user } = useAuth();
  const [providers, setProviders] = useState<WhatsAppProvider[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProviders = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('whatsapp_api_providers')
        .select('*')
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Cast provider_type since DB enum may not match TS type directly
      setProviders((data ?? []).map(d => ({
        ...d,
        provider_type: d.provider_type as ProviderType,
        extra_config: (d.extra_config as Record<string, unknown>) ?? {},
      })));
    } catch (e) {
      console.error('Error fetching providers:', e);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const addProvider = async (provider: Omit<NewProvider, 'user_id'>) => {
    if (!user) return;
    try {
      // If setting as default, unset others first
      if (provider.is_default) {
        await supabase
          .from('whatsapp_api_providers')
          .update({ is_default: false } as any)
          .eq('user_id', user.id);
      }

      const { error } = await supabase
        .from('whatsapp_api_providers')
        .insert({ ...provider, user_id: user.id } as any);

      if (error) throw error;
      toast.success('Provedor adicionado com sucesso!');
      await fetchProviders();
    } catch (e: any) {
      console.error('Error adding provider:', e);
      toast.error('Erro ao adicionar provedor: ' + e.message);
    }
  };

  const updateProvider = async (id: string, updates: Partial<WhatsAppProvider>) => {
    if (!user) return;
    try {
      if (updates.is_default) {
        await supabase
          .from('whatsapp_api_providers')
          .update({ is_default: false } as any)
          .eq('user_id', user.id);
      }

      const { error } = await supabase
        .from('whatsapp_api_providers')
        .update(updates as any)
        .eq('id', id);

      if (error) throw error;
      toast.success('Provedor atualizado!');
      await fetchProviders();
    } catch (e: any) {
      console.error('Error updating provider:', e);
      toast.error('Erro ao atualizar provedor: ' + e.message);
    }
  };

  const deleteProvider = async (id: string) => {
    try {
      const { error } = await supabase
        .from('whatsapp_api_providers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Provedor removido!');
      await fetchProviders();
    } catch (e: any) {
      console.error('Error deleting provider:', e);
      toast.error('Erro ao remover provedor: ' + e.message);
    }
  };

  const setDefault = async (id: string) => {
    if (!user) return;
    await supabase
      .from('whatsapp_api_providers')
      .update({ is_default: false } as any)
      .eq('user_id', user.id);

    await supabase
      .from('whatsapp_api_providers')
      .update({ is_default: true } as any)
      .eq('id', id);

    toast.success('Provedor padrão atualizado!');
    await fetchProviders();
  };

  return {
    providers,
    isLoading,
    addProvider,
    updateProvider,
    deleteProvider,
    setDefault,
    refetch: fetchProviders,
  };
}
